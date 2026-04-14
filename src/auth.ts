#!/usr/bin/env node

import { google } from "googleapis";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".gsc-tokens.json"
);
const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Error: GSC_CLIENT_ID and GSC_CLIENT_SECRET environment variables are required.\n\n" +
        "1. Go to https://console.cloud.google.com/apis/credentials\n" +
        "2. Create an OAuth 2.0 Client ID (Desktop app)\n" +
        "3. Set the environment variables:\n" +
        "   export GSC_CLIENT_ID=your_client_id\n" +
        "   export GSC_CLIENT_SECRET=your_client_secret"
    );
    process.exit(1);
  }

  return { clientId, clientSecret };
}

export function createOAuth2Client() {
  const { clientId, clientSecret } = getClientCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

export function loadTokens(): TokenData | null {
  try {
    const data = fs.readFileSync(TOKEN_PATH, "utf-8");
    return JSON.parse(data) as TokenData;
  } catch {
    return null;
  }
}

function saveTokens(tokens: TokenData): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
  console.log(`Tokens saved to ${TOKEN_PATH}`);
}

export async function getAuthenticatedClient() {
  const oauth2Client = createOAuth2Client();
  const tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "Not authenticated. Run `npm run auth` first to authorize with Google."
    );
  }

  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    saveTokens(merged as TokenData);
  });

  return oauth2Client;
}

/**
 * Interactive auth flow — run as `npm run auth`
 */
async function authenticate(): Promise<void> {
  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\nOpening browser for Google authorization...\n");
  console.log("If the browser does not open, visit this URL manually:");
  console.log(authUrl + "\n");

  // Open browser
  const { exec } = await import("child_process");
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${openCmd} "${authUrl}"`);

  // Start local server to receive callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const query = url.parse(req.url || "", true).query;
      if (query.code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>Authorization successful!</h1><p>You can close this tab.</p>"
        );
        server.close();
        resolve(query.code as string);
      } else {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Authorization failed</h1>");
        server.close();
        reject(new Error("No authorization code received"));
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(
        `Waiting for authorization on http://localhost:${REDIRECT_PORT}/callback ...`
      );
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out after 120 seconds"));
    }, 120000);
  });

  const { tokens } = await oauth2Client.getToken(code);
  saveTokens(tokens as TokenData);
  console.log("\nAuthentication complete!");
}

// Run auth flow when executed directly
const isDirectRun =
  require.main === module ||
  process.argv[1]?.endsWith("/auth.js") ||
  process.argv[1]?.endsWith("/auth.ts");

if (isDirectRun) {
  authenticate().catch((err) => {
    console.error("Authentication failed:", err.message);
    process.exit(1);
  });
}
