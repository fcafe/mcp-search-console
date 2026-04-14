#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google, searchconsole_v1 } from "googleapis";
import { z } from "zod";
import { getAuthenticatedClient } from "./auth.js";

let searchConsole: searchconsole_v1.Searchconsole;

async function initSearchConsole() {
  const auth = await getAuthenticatedClient();
  searchConsole = google.searchconsole({ version: "v1", auth });
}

const server = new McpServer({
  name: "search-console",
  version: "0.1.0",
});

// ── Tool: list_sites ──────────────────────────────────────────────
server.tool(
  "list_sites",
  "List all sites (properties) you have access to in Google Search Console",
  {},
  async () => {
    const res = await searchConsole.sites.list();
    const sites = res.data.siteEntry || [];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(sites, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_site ────────────────────────────────────────────────
server.tool(
  "get_site",
  "Get details of a specific site in Google Search Console",
  {
    siteUrl: z.string().describe("The site URL (e.g. 'https://example.com/' or 'sc-domain:example.com')"),
  },
  async ({ siteUrl }) => {
    const res = await searchConsole.sites.get({ siteUrl });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }
);

// ── Tool: search_analytics ────────────────────────────────────────
server.tool(
  "search_analytics",
  "Query Google Search Console search analytics data. Returns clicks, impressions, CTR, and position for the specified dimensions and filters.",
  {
    siteUrl: z
      .string()
      .describe("The site URL (e.g. 'https://example.com/' or 'sc-domain:example.com')"),
    startDate: z
      .string()
      .describe("Start date in YYYY-MM-DD format"),
    endDate: z
      .string()
      .describe("End date in YYYY-MM-DD format"),
    dimensions: z
      .array(z.enum(["query", "page", "country", "device", "date", "searchAppearance"]))
      .optional()
      .describe("Dimensions to group by (e.g. ['query', 'page'])"),
    dimensionFilterGroups: z
      .array(
        z.object({
          groupType: z.enum(["and"]).optional(),
          filters: z.array(
            z.object({
              dimension: z.enum(["query", "page", "country", "device", "searchAppearance"]),
              operator: z.enum(["equals", "notEquals", "contains", "notContains", "includingRegex", "excludingRegex"]),
              expression: z.string(),
            })
          ),
        })
      )
      .optional()
      .describe("Filters to apply to dimensions"),
    rowLimit: z
      .number()
      .min(1)
      .max(25000)
      .optional()
      .describe("Maximum number of rows to return (default: 1000, max: 25000)"),
    startRow: z
      .number()
      .min(0)
      .optional()
      .describe("Zero-based index of the first row to return (for pagination)"),
    type: z
      .enum(["web", "image", "video", "news", "discover", "googleNews"])
      .optional()
      .describe("Search type to filter by (default: 'web')"),
    aggregationType: z
      .enum(["auto", "byPage", "byProperty"])
      .optional()
      .describe("How data is aggregated"),
  },
  async (params) => {
    const res = await searchConsole.searchanalytics.query({
      siteUrl: params.siteUrl,
      requestBody: {
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions,
        dimensionFilterGroups: params.dimensionFilterGroups,
        rowLimit: params.rowLimit ?? 1000,
        startRow: params.startRow,
        type: params.type,
        aggregationType: params.aggregationType,
      },
    });

    const rows = res.data.rows || [];
    const summary = {
      totalRows: rows.length,
      responseAggregationType: res.data.responseAggregationType,
      rows,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }
);

// ── Tool: list_sitemaps ───────────────────────────────────────────
server.tool(
  "list_sitemaps",
  "List all sitemaps submitted for a site",
  {
    siteUrl: z.string().describe("The site URL"),
  },
  async ({ siteUrl }) => {
    const res = await searchConsole.sitemaps.list({ siteUrl });
    const sitemaps = res.data.sitemap || [];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(sitemaps, null, 2),
        },
      ],
    };
  }
);

// ── Tool: inspect_url ─────────────────────────────────────────────
server.tool(
  "inspect_url",
  "Inspect a URL's indexing status in Google Search Console",
  {
    inspectionUrl: z.string().describe("The fully-qualified URL to inspect"),
    siteUrl: z.string().describe("The site URL that owns this URL"),
  },
  async ({ inspectionUrl, siteUrl }) => {
    const res = await searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
      },
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────
async function main() {
  await initSearchConsole();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err.message);
  process.exit(1);
});
