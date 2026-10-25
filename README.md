# X Reader MCP

Let Claude (or ChatGPT, Cursor, any MCP client) read **public X posts and full X Articles**.
Paste a post link in chat and the AI gets clean Markdown: title, author, date, engagement,
text, images, best-quality video links, polls, quoted posts, and the **entire long-form article body**.

- Free: uses the public [FxTwitter](https://github.com/FxEmbed/FxEmbed) API, no X API key
- Tiny: zero runtime dependencies, about 17 KB, runs on Cloudflare Workers' free plan
- Read-only: it only reads public posts

> Why I built it: other tweet MCPs returned only the article *link* for X Articles, never the text.
> This one renders X's article format (Draft.js) into proper Markdown with headings, lists,
> bold/italic, links, code blocks, images and videos.

If this saves you time, you can [buy me a coffee](https://roastedrants.gumroad.com/l/coffee) ☕

---

## Example output

```markdown
# I built a free MCP that lets Claude read X Articles

**Author:** roastedrants (@roastedrants), 1,234 followers
**Posted:** 2026-10-21 15:08 UTC
**Engagement:** 150 likes, 12 reposts, 5 replies, 2 quotes, 1,300 bookmarks, 45,678 views
**Type:** X Article

---

## Why TweetSave was not enough

It only returned the **article link**, never the body.

1. Deploy it on [**Cloudflare**](https://workers.cloudflare.com)
2. Add the connector in Claude
3. Paste any post link
```

## Deploy (about 5 minutes)

You need [Node.js](https://nodejs.org) 22.18 or newer and a free [Cloudflare](https://dash.cloudflare.com/sign-up) account.

```bash
npm install
npx wrangler login      # opens the browser once
npm run deploy
```

Wrangler prints your URL, something like `https://x-reader-mcp.<your-subdomain>.workers.dev`.

Quick check in any browser (phone works too):

```
https://x-reader-mcp.<your-subdomain>.workers.dev/read?url=https://x.com/<user>/status/<id>
```

## Connect it

Your MCP endpoint is the URL above plus `/mcp`.

**Claude app (web, desktop, mobile):** Settings → Connectors → Add custom connector → paste the `/mcp` URL.
Then enable it in a chat and paste any post link.

**Claude Code:**

```bash
claude mcp add --transport http x-reader https://x-reader-mcp.<your-subdomain>.workers.dev/mcp
```

**ChatGPT:** Settings → Apps & Connectors (Developer mode) → create a connector with the `/mcp` URL, no auth.

**Cursor / other clients:** add a remote server with `"url": "https://.../mcp"`.

## Tool

| Tool | Input | Returns |
|---|---|---|
| `read_x_post` | `url`: post URL (x.com, twitter.com, mobile, fxtwitter...) or numeric ID | Markdown of the post, and the full article if it's an X Article |

Other endpoints: `GET /read?url=...` returns plain Markdown, `GET /` shows an info page.

## Limits (honest list)

- Public posts only. Private accounts and deleted posts return a clear error.
- No replies and no full multi-post threads (FxTwitter only returns the single post).
- Bare article links (`x.com/i/article/...`) can't be resolved; paste the post that shares the article.
- Depends on FxTwitter, a free community service. If it is down, the tool says so.
- The endpoint is public. Cloudflare's free plan allows 100,000 requests a day, plenty for personal use.

## Develop

```bash
npm test          # offline tests with a sample article (no network)
npm run dev       # local server at http://localhost:8787
npm run typecheck
```

Code map: `src/index.ts` (MCP over Streamable HTTP, stateless), `src/fxtwitter.ts` (URL parsing and fetch),
`src/markdown.ts` (post and Draft.js article to Markdown).

## Credits

Data comes from [FxTwitter / FxEmbed](https://github.com/FxEmbed/FxEmbed). Please be kind to their servers.
Not affiliated with X Corp.

Made by [@roastedrants](https://x.com/roastedrants). [Buy me a coffee](https://roastedrants.gumroad.com/l/coffee) ☕

MIT License
