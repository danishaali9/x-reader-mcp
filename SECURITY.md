# Security

X Reader MCP is read-only. It fetches public X posts through the FxTwitter API and returns them as Markdown. It has no accounts, no sign-in and no database, and it stores nothing: no posts, no links you paste, no user data. Requests are handled statelessly.

The hosted instance runs on Cloudflare Workers, which keeps its own platform-level request logs.

## Reporting an issue

Please report security issues by opening a [GitHub issue](https://github.com/danishaali9/x-reader-mcp/issues) or by messaging [@roastedrants](https://x.com/roastedrants) on X. For anything sensitive, use the X message and leave details out of public issues.
