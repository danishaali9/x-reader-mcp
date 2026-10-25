// Offline tests: no network. FxTwitter is mocked with real saved responses.
// Run with: npm test   (Node 22.18+ runs .ts files directly)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { strict as assert } from "node:assert";
import { handleRequest } from "../src/index.ts";
import { parsePostInput } from "../src/fxtwitter.ts";

const here = new URL(".", import.meta.url);
const articleFixture = readFileSync(new URL("fixtures/article-post.json", here), "utf8");

const simplePost = {
  code: 200,
  message: "OK",
  tweet: {
    url: "https://x.com/demo/status/111111111111",
    id: "111111111111",
    text: "Shipping my boilerplate this week. Which payments provider?",
    author: { name: "Demo", screen_name: "demo", followers: 42 },
    replies: 3, retweets: 1, likes: 10, views: 900,
    created_timestamp: 1792595296,
    media: { all: [{ type: "photo", url: "https://pbs.twimg.com/media/x.jpg", altText: "screenshot" }] },
    poll: { choices: [{ label: "Lemon Squeezy", count: 6, percentage: 60 }, { label: "Dodo", count: 4, percentage: 40 }], total_votes: 10, time_left_en: "Final results" },
    quote: { url: "https://x.com/other/status/222", text: "Quoted text", author: { name: "Other", screen_name: "other" } },
  },
};

let calls: string[] = [];
const mockFetch = (async (input: RequestInfo | URL) => {
  const u = String(input);
  calls.push(u);
  if (u.includes("2100000000000000001")) return new Response(articleFixture, { status: 200 });
  if (u.includes("111111111111")) return new Response(JSON.stringify(simplePost), { status: 200 });
  return new Response(JSON.stringify({ code: 404, message: "NOT_FOUND" }), { status: 404 });
}) as typeof fetch;

const rpc = async (body: unknown) =>
  handleRequest(
    new Request("https://x-reader.example.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    }),
    mockFetch,
  );

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
};

await test("parses real URL shapes", () => {
  const id = "2112923932256792890";
  assert.deepEqual(parsePostInput(`https://x.com/dsqjaffa/status/${id}?s=46`), { id, user: "dsqjaffa" });
  assert.deepEqual(parsePostInput(`https://mobile.twitter.com/dsqjaffa/status/${id}`), { id, user: "dsqjaffa" });
  assert.deepEqual(parsePostInput(`https://fxtwitter.com/dsqjaffa/status/${id}/photo/1`), { id, user: "dsqjaffa" });
  assert.deepEqual(parsePostInput(`https://x.com/i/status/${id}`), { id, user: "i" });
  assert.deepEqual(parsePostInput(`https://twitter.com/i/web/status/${id}`), { id, user: "i" });
  assert.deepEqual(parsePostInput(id), { id, user: "i" });
  assert.throws(() => parsePostInput("https://x.com/i/article/2112915155277283328"), /article link/);
  assert.throws(() => parsePostInput("hello"), /Could not find/);
});

await test("initialize negotiates protocol version", async () => {
  const res = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  const body = await res.json() as any;
  assert.equal(res.status, 200);
  assert.equal(body.result.protocolVersion, "2025-06-18");
  assert.equal(body.result.serverInfo.name, "x-reader");
  assert.ok(body.result.capabilities.tools);
  const old = await (await rpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } })).json() as any;
  assert.equal(old.result.protocolVersion, "2025-06-18");
});

await test("notifications get 202 with no body", async () => {
  const res = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

await test("tools/list exposes read_x_post", async () => {
  const body = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/list" })).json() as any;
  assert.equal(body.result.tools.length, 1);
  assert.equal(body.result.tools[0].name, "read_x_post");
  assert.deepEqual(body.result.tools[0].inputSchema.required, ["url"]);
});

let articleMd = "";
await test("tools/call renders the full X Article", async () => {
  calls = [];
  const body = await (await rpc({
    jsonrpc: "2.0", id: 4, method: "tools/call",
    params: { name: "read_x_post", arguments: { url: "https://x.com/roastedrants/status/2100000000000000001?s=46" } },
  })).json() as any;
  assert.equal(body.result.isError, false);
  assert.equal(calls[0], "https://api.fxtwitter.com/roastedrants/status/2100000000000000001");
  articleMd = body.result.content[0].text;

  const has = (s: string, why = s) => assert.ok(articleMd.includes(s), `missing: ${why}`);
  assert.ok(articleMd.startsWith("# I built a free MCP that lets Claude read X Articles"));
  has("**Engagement:** 150 likes, 12 reposts, 5 replies, 2 quotes, 1,300 bookmarks, 45,678 views");
  has("**Type:** X Article");
  has("![cover](https://pbs.twimg.com/media/sample-cover.jpg)");
  has("## Why TweetSave was not enough");
  has("It only returned the **article link**, never the body.");
  has("![image](https://pbs.twimg.com/media/sample-image.jpg)");
  has("- *Full* article body\n- Images and best-quality video links");
  has("1. Deploy it on [**Cloudflare**](https://workers.cloudflare.com)\n2. Add the connector in Claude\n3. Paste any post link");
  has('> ***"Ship small, ship often."***\n> \n> ***Then ship again.***', "multi-line bold quote");
  has("```bash\nclaude mcp add --transport http x-reader");
  has("\n---\n", "divider");
  has("[Video, 0:08](https://video.twimg.com/sample/1600x1000.mp4) (thumbnail: https://pbs.twimg.com/sample-thumb.jpg)", "best video");
  has("Unicode check: café… done → next 💜");
  assert.ok(!articleMd.includes("https://x.com/i/article/"), "should not repeat the bare article link");
});

await test("tools/call renders a normal post with photo, poll and quote", async () => {
  const body = await (await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "read_x_post", arguments: { url: "111111111111" } } })).json() as any;
  const md = body.result.content[0].text as string;
  assert.ok(md.startsWith("# Post by Demo (@demo)"));
  assert.ok(md.includes("Shipping my boilerplate this week."));
  assert.ok(md.includes("![screenshot](https://pbs.twimg.com/media/x.jpg)"));
  assert.ok(md.includes("- Lemon Squeezy: 60% (6 votes)"));
  assert.ok(md.includes("> **Quoted post by Other (@other)**"));
});

await test("errors come back as tool errors, not crashes", async () => {
  const a = await (await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "read_x_post", arguments: { url: "https://x.com/i/article/2112915155277283328" } } })).json() as any;
  assert.equal(a.result.isError, true);
  assert.match(a.result.content[0].text, /article link/);
  const b = await (await rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "read_x_post", arguments: { url: "https://x.com/a/status/999999999999" } } })).json() as any;
  assert.equal(b.result.isError, true);
  assert.match(b.result.content[0].text, /not found/);
  const c = await (await rpc({ jsonrpc: "2.0", id: 8, method: "nope" })).json() as any;
  assert.equal(c.error.code, -32601);
});

await test("batch requests and HTTP edges", async () => {
  const batch = await (await rpc([
    { jsonrpc: "2.0", id: 9, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 10, method: "tools/list" },
  ])).json() as any[];
  assert.equal(batch.length, 2);
  const rootPost = await (await handleRequest(new Request("https://h.dev/", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/list" }) }), mockFetch)).json() as any;
  assert.equal(rootPost.result.tools[0].name, "read_x_post", "MCP on root URL");
  const get = await handleRequest(new Request("https://h.dev/mcp"), mockFetch);
  assert.equal(get.status, 405);
  const bad = await handleRequest(new Request("https://h.dev/mcp", { method: "POST", body: "{nope" }), mockFetch);
  assert.equal(bad.status, 400);
  const read = await handleRequest(new Request("https://h.dev/read?url=https://x.com/roastedrants/status/2100000000000000001"), mockFetch);
  assert.equal(read.status, 200);
  assert.match(read.headers.get("Content-Type") ?? "", /markdown/);
  const homeRes = await handleRequest(new Request("https://h.dev/"), mockFetch);
  assert.match(homeRes.headers.get("Content-Type") ?? "", /text\/html/);
  const home = await homeRes.text();
  assert.ok(home.includes('<input id="url"'), "input box missing");
  assert.ok(home.includes("https://h.dev/mcp"), "connector URL missing");
  assert.ok(home.includes("roastedrants.gumroad.com/l/coffee"), "coffee link missing");
});

mkdirSync(new URL("output/", here), { recursive: true });
writeFileSync(new URL("output/article.md", here), articleMd);
console.log(`\n${passed} tests passed. Rendered article saved to test/output/article.md`);
