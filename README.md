# mcp-search-console

Google Search Console の MCP サーバー。Claude Code から Search Console のデータを直接操作できます。

## できること

| ツール | 説明 |
|--------|------|
| `list_sites` | アクセス可能なサイト一覧を取得 |
| `get_site` | サイトの詳細情報を取得 |
| `search_analytics` | 検索パフォーマンスデータを取得（クリック数、表示回数、CTR、掲載順位） |
| `list_sitemaps` | サイトマップ一覧を取得 |
| `inspect_url` | URL のインデックス状況を確認 |

## セットアップ

### 1. Google Cloud Console で認証情報を作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（または新規作成）
3. 「APIとサービス」→「ライブラリ」から **Google Search Console API** を有効化
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
5. アプリケーションの種類: **デスクトップアプリ**
6. 作成後、**クライアント ID** と **クライアント シークレット** をメモ

### 2. 初回認証

```bash
# 環境変数を設定
export GSC_CLIENT_ID=your_client_id
export GSC_CLIENT_SECRET=your_client_secret

# 初回認証（ブラウザが開きます）
npx @fcafe/mcp-search-console auth
```

### 3. Claude Code に登録

`~/.claude/settings.json` に以下を追加:

```json
{
  "mcpServers": {
    "search-console": {
      "command": "npx",
      "args": ["-y", "@fcafe/mcp-search-console"],
      "env": {
        "GSC_CLIENT_ID": "your_client_id",
        "GSC_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

これだけで完了です。

## 使用例

Claude Code で以下のように聞くだけで使えます:

- 「Search Console に登録されてるサイト一覧を見せて」
- 「example.com の過去30日のクエリ別パフォーマンスを教えて」
- 「example.com/page のインデックス状況を確認して」
- 「CTR が低いページ上位20件を出して」

## 認証トークンについて

- トークンは `~/.gsc-tokens.json` に保存されます（パーミッション 600）
- リフレッシュトークンで自動更新されるため、再認証は基本不要です
- 再認証が必要な場合は、ステップ2のコマンドを再度実行してください
