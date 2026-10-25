// x-reader-mcp: a tiny, zero-dependency MCP server on Cloudflare Workers.
// It reads public X (Twitter) posts and X Articles through the free FxTwitter API
// and returns clean Markdown to Claude, ChatGPT, Cursor or any MCP client.
//
// Endpoints:
//   POST /mcp          MCP over Streamable HTTP (stateless, JSON responses)
//   GET  /read?url=... Plain Markdown, handy for testing in a browser
//   GET  /             Web page: paste a post URL, read it, copy or download the Markdown

import { fetchPost, parsePostInput, ReaderError } from "./fxtwitter.ts";
import { renderPost } from "./markdown.ts";
import { homePage } from "./page.ts";

const SERVER_INFO = { name: "x-reader", title: "X Reader", version: "1.0.0" };
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const COFFEE_URL = "https://roastedrants.gumroad.com/l/coffee";
const REPO_URL = "https://github.com/danishaali9/x-reader-mcp";

const TOOLS = [
  {
    name: "read_x_post",
    title: "Read X post or article",
    description:
      "Reads a public X (Twitter) post and returns it as Markdown: author, date, engagement, text, images, video links, " +
      "polls, quoted post, and the FULL body of X Articles (long-form posts). Use it whenever the user shares an " +
      "x.com or twitter.com status link. Does not return replies or full multi-post threads.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Post URL like https://x.com/user/status/123... (twitter.com, fxtwitter.com etc. also work) or a bare numeric post ID.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    annotations: { title: "Read X post or article", readOnlyHint: true, openWorldHint: true },
  },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

export async function readPostMarkdown(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const post = await fetchPost(parsePostInput(url), fetchImpl);
  return renderPost(post);
}

async function handleRpc(msg: RpcMessage, fetchImpl: typeof fetch): Promise<object | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });

  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    // A response or malformed message from the client: nothing to answer unless it had an id.
    return isNotification ? null : fail(-32600, "Invalid Request");
  }
  if (isNotification) return null; // e.g. notifications/initialized

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "When the user shares an x.com or twitter.com post link, call read_x_post to get the full post or X Article as Markdown.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = msg.params?.name;
      if (name !== "read_x_post") return fail(-32602, `Unknown tool: ${name}`);
      const url = msg.params?.arguments?.url;
      if (typeof url !== "string" || !url.trim()) {
        return reply({ content: [{ type: "text", text: "Missing 'url' argument." }], isError: true });
      }
      try {
        const text = await readPostMarkdown(url, fetchImpl);
        return reply({ content: [{ type: "text", text }], isError: false });
      } catch (err) {
        const text = err instanceof ReaderError ? err.message : `Unexpected error: ${(err as Error).message}`;
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

export async function handleRequest(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // MCP lives at /mcp, but also accept POSTs to the root so a connector added without "/mcp" still works
  // (otherwise the 404 makes clients assume sign-in is required and attempt OAuth).
  if (path === "/mcp" || (path === "/" && request.method === "POST")) {
    if (request.method !== "POST") {
      // Stateless server: no server-initiated SSE stream and no sessions to delete.
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
    }

    if (Array.isArray(payload)) {
      const results = (await Promise.all(payload.map((m) => handleRpc(m as RpcMessage, fetchImpl)))).filter(Boolean);
      return results.length ? json(results) : new Response(null, { status: 202, headers: CORS });
    }
    const result = await handleRpc(payload as RpcMessage, fetchImpl);
    return result ? json(result) : new Response(null, { status: 202, headers: CORS });
  }

  if (path === "/read" && request.method === "GET") {
    const target = url.searchParams.get("url") ?? url.searchParams.get("id") ?? "";
    try {
      const md = await readPostMarkdown(target, fetchImpl);
      return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", ...CORS } });
    } catch (err) {
      const status = err instanceof ReaderError ? 400 : 500;
      return new Response((err as Error).message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } });
    }
  }

  if (path === "/" && request.method === "GET") {
    const html = homePage(`${url.protocol}//${url.host}`, COFFEE_URL, REPO_URL);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } });
  }

  if (path === "/robots.txt") {
    return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain", ...CORS } });
  }

  return new Response("Not found", { status: 404, headers: CORS });
}

export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
