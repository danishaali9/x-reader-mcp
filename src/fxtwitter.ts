// Thin client for the free, public FxTwitter API (https://github.com/FxEmbed/FxEmbed).
// No API key needed. We only read public posts.

export const USER_AGENT = "x-reader-mcp/1.0 (+https://github.com/danishaali9/x-reader-mcp)";

export interface ParsedInput {
  id: string;
  user: string; // screen name if known, otherwise "i"
}

export class ReaderError extends Error {}

/**
 * Accepts a post URL (x.com, twitter.com, mobile, fxtwitter, vxtwitter, ...) or a bare numeric ID.
 */
export function parsePostInput(raw: string): ParsedInput {
  const input = (raw || "").trim();
  if (!input) throw new ReaderError("Please give a post URL or numeric post ID.");

  if (/^\d{5,25}$/.test(input)) return { id: input, user: "i" };

  if (/\/i\/article\/\d+/.test(input)) {
    throw new ReaderError(
      "That is an article link (x.com/i/article/...). X only maps articles back to their post for signed-in readers. " +
        "Please paste the link of the post that shares the article instead (x.com/<user>/status/<id>).",
    );
  }

  const match = input.match(/(?:^|\/)(?:([A-Za-z0-9_]{1,15})\/)?status(?:es)?\/(\d{5,25})/);
  if (match) {
    const user = match[1] && match[1] !== "i" && match[1] !== "web" ? match[1] : "i";
    return { id: match[2], user };
  }

  throw new ReaderError(`Could not find a post ID in "${input}". Expected something like https://x.com/user/status/123...`);
}

// Loose types: FxTwitter's response is large and evolves, so we only describe what we read.
export type Json = any;

export async function fetchPost(input: ParsedInput, fetchImpl: typeof fetch = fetch): Promise<Json> {
  const url = `https://api.fxtwitter.com/${input.user}/status/${input.id}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new ReaderError(`Could not reach FxTwitter (${(err as Error).message}). Try again in a minute.`);
  }

  let body: Json;
  try {
    body = await res.json();
  } catch {
    throw new ReaderError(`FxTwitter returned a non-JSON response (HTTP ${res.status}).`);
  }

  const code = body?.code ?? res.status;
  if (code === 200 && body?.tweet) return body.tweet;
  if (code === 401) throw new ReaderError("This post is from a private (protected) account, so it can't be read.");
  if (code === 404) throw new ReaderError("Post not found. It may be deleted, or the link is wrong.");
  throw new ReaderError(`FxTwitter error ${code}: ${body?.message ?? "unknown error"}. X may be rate limiting it; try again later.`);
}
