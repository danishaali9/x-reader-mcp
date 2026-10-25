// Turns an FxTwitter post (including X Articles, which arrive as a Draft.js document) into clean Markdown.

import type { Json } from "./fxtwitter.ts";

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : "0");

function duration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function postedAt(post: Json): string {
  if (typeof post.created_timestamp === "number") {
    return new Date(post.created_timestamp * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
  return post.created_at ?? "unknown";
}

// ---------- normal post parts ----------

function renderMedia(media: Json): string[] {
  const out: string[] = [];
  for (const item of media?.all ?? []) {
    if (item.type === "photo") {
      out.push(`![${item.altText ? item.altText.replace(/\n/g, " ") : "image"}](${item.url})`);
    } else if (item.type === "video" || item.type === "gif") {
      const label = item.type === "gif" ? "GIF" : `Video${item.duration ? ", " + duration(item.duration) : ""}`;
      out.push(`[${label}](${item.url})` + (item.thumbnail_url ? ` (thumbnail: ${item.thumbnail_url})` : ""));
    }
  }
  return out;
}

function renderPoll(poll: Json): string[] {
  if (!poll?.choices?.length) return [];
  const lines = poll.choices.map((c: Json) => `- ${c.label}: ${c.percentage ?? 0}% (${n(c.count)} votes)`);
  const status = poll.time_left_en ?? (poll.ends_at ? `ends ${poll.ends_at}` : "");
  return [`**Poll** (${n(poll.total_votes)} votes${status ? ", " + status : ""})`, ...lines];
}

function engagement(post: Json): string {
  const parts = [
    `${n(post.likes)} likes`,
    `${n(post.retweets)} reposts`,
    `${n(post.replies)} replies`,
  ];
  if (post.quotes != null) parts.push(`${n(post.quotes)} quotes`);
  if (post.bookmarks != null) parts.push(`${n(post.bookmarks)} bookmarks`);
  if (post.views != null) parts.push(`${n(post.views)} views`);
  return parts.join(", ");
}

// ---------- X Article (Draft.js) ----------

type Entity = { type: string; data: Json };

function entityLookup(entityMap: Json): (key: unknown) => Entity | undefined {
  const map = new Map<string, Entity>();
  if (Array.isArray(entityMap)) {
    for (const e of entityMap) if (e?.value) map.set(String(e.key), e.value);
  } else if (entityMap && typeof entityMap === "object") {
    for (const [k, v] of Object.entries(entityMap)) map.set(k, v as Entity);
  }
  return (key) => map.get(String(key));
}

function bestMp4(variants: Json[] = []): string | undefined {
  return variants
    .filter((v) => v.content_type === "video/mp4" && v.url)
    .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0]?.url;
}

function renderArticleMedia(mediaId: string, mediaEntities: Json[]): string {
  const found = mediaEntities.find((m) => String(m.media_id) === String(mediaId));
  const info = found?.media_info;
  if (!info) return "";
  if (info.__typename === "ApiImage" || info.original_img_url) {
    return `![image](${info.original_img_url})`;
  }
  const mp4 = bestMp4(info.variants);
  const thumb = info.preview_image?.original_img_url;
  const len = info.duration_millis ? ", " + duration(info.duration_millis / 1000) : "";
  if (mp4) return `[Video${len}](${mp4})` + (thumb ? ` (thumbnail: ${thumb})` : "");
  return thumb ? `![video thumbnail](${thumb})` : "";
}

/** Wraps a run of text in Markdown markers, keeping outer whitespace outside the markers. */
function wrap(text: string, styles: Set<string>): string {
  if (!styles.size) return text;
  // Markdown emphasis can't span line breaks, so style each line on its own.
  if (text.includes("\n")) return text.split("\n").map((line) => wrap(line, styles)).join("\n");
  const lead = text.match(/^\s*/)![0];
  const trail = text.slice(lead.length).match(/\s*$/)![0];
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  let t = core;
  if (styles.has("code")) t = "`" + t + "`";
  if (styles.has("strikethrough")) t = `~~${t}~~`;
  if (styles.has("italic")) t = `*${t}*`;
  if (styles.has("bold")) t = `**${t}**`;
  return lead + t + trail;
}

function renderInline(block: Json, getEntity: (k: unknown) => Entity | undefined): string {
  const text: string = block.text ?? "";
  if (!text) return "";
  const len = text.length; // Draft.js offsets are UTF-16 code units, same as JS string indices
  const styles: Set<string>[] = Array.from({ length: len }, () => new Set<string>());
  const links: (string | null)[] = new Array(len).fill(null);

  for (const r of block.inlineStyleRanges ?? []) {
    const style = String(r.style ?? "").toLowerCase();
    for (let i = r.offset; i < Math.min(len, r.offset + r.length); i++) styles[i].add(style);
  }
  for (const r of block.entityRanges ?? []) {
    const ent = getEntity(r.key);
    if (ent?.type !== "LINK" || !ent.data?.url) continue;
    for (let i = r.offset; i < Math.min(len, r.offset + r.length); i++) links[i] = ent.data.url;
  }

  const sameStyle = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((s) => b.has(s));
  let out = "";
  let i = 0;
  while (i < len) {
    // group by link first so one link is never split into several
    let j = i;
    while (j < len && links[j] === links[i]) j++;
    let inner = "";
    let k = i;
    while (k < j) {
      let m = k;
      while (m < j && sameStyle(styles[m], styles[k])) m++;
      inner += wrap(text.slice(k, m), styles[k]);
      k = m;
    }
    out += links[i] ? `[${inner.trim()}](${links[i]})` : inner;
    i = j;
  }
  return out;
}

export function renderArticle(article: Json): string {
  const getEntity = entityLookup(article.content?.entityMap);
  const mediaEntities: Json[] = article.media_entities ?? [];
  const blocks: Json[] = article.content?.blocks ?? [];

  const parts: { list: false | "ul" | "ol"; text: string }[] = [];
  let olCounter = 0;

  for (const block of blocks) {
    const type: string = block.type ?? "unstyled";
    if (type !== "ordered-list-item") olCounter = 0;
    const indent = "  ".repeat(block.depth ?? 0);

    switch (type) {
      case "atomic": {
        const ent = getEntity(block.entityRanges?.[0]?.key);
        if (!ent) break;
        if (ent.type === "MEDIA") {
          const items = (ent.data?.mediaItems ?? [])
            .map((mi: Json) => renderArticleMedia(mi.mediaId, mediaEntities))
            .filter(Boolean);
          if (items.length) parts.push({ list: false, text: items.join("\n") });
        } else if (ent.type === "MARKDOWN" && ent.data?.markdown) {
          parts.push({ list: false, text: String(ent.data.markdown).trim() });
        } else if (ent.type === "DIVIDER") {
          parts.push({ list: false, text: "---" });
        } else if (ent.type === "TWEET" && (ent.data?.tweetId || ent.data?.id)) {
          parts.push({ list: false, text: `[Embedded post](https://x.com/i/status/${ent.data.tweetId ?? ent.data.id})` });
        } else if (ent.type === "LINK" && ent.data?.url) {
          parts.push({ list: false, text: ent.data.url });
        }
        break;
      }
      case "header-one":
        parts.push({ list: false, text: `## ${renderInline(block, getEntity)}` });
        break;
      case "header-two":
        parts.push({ list: false, text: `### ${renderInline(block, getEntity)}` });
        break;
      case "header-three":
        parts.push({ list: false, text: `#### ${renderInline(block, getEntity)}` });
        break;
      case "unordered-list-item":
        parts.push({ list: "ul", text: `${indent}- ${renderInline(block, getEntity)}` });
        break;
      case "ordered-list-item":
        olCounter++;
        parts.push({ list: "ol", text: `${indent}${olCounter}. ${renderInline(block, getEntity)}` });
        break;
      case "blockquote":
        parts.push({
          list: false,
          text: renderInline(block, getEntity).split("\n").map((l) => `> ${l}`).join("\n"),
        });
        break;
      case "code-block":
        parts.push({ list: false, text: "```\n" + (block.text ?? "") + "\n```" });
        break;
      default: {
        const t = renderInline(block, getEntity);
        if (t.trim()) parts.push({ list: false, text: t });
      }
    }
  }

  let body = "";
  parts.forEach((p, idx) => {
    if (idx > 0) body += p.list && p.list === parts[idx - 1].list ? "\n" : "\n\n";
    body += p.text;
  });

  const head: string[] = [];
  const cover = article.cover_media?.media_info?.original_img_url;
  if (cover) head.push(`![cover](${cover})`);
  return [...head, body].filter(Boolean).join("\n\n");
}

// ---------- whole post ----------

function quoteBlock(quote: Json): string {
  const inner = [
    `**Quoted post by ${quote.author?.name ?? "unknown"} (@${quote.author?.screen_name ?? "?"})**, ${quote.url ?? ""}`,
    quote.text ?? "",
    ...renderMedia(quote.media),
  ]
    .filter(Boolean)
    .join("\n\n");
  return inner.split("\n").map((l) => `> ${l}`).join("\n");
}

export function renderPost(post: Json): string {
  const a = post.author ?? {};
  const article = post.article;
  const out: string[] = [];

  out.push(article?.title ? `# ${article.title}` : `# Post by ${a.name ?? "unknown"} (@${a.screen_name ?? "?"})`);

  const meta = [
    `**Author:** ${a.name ?? "unknown"} (@${a.screen_name ?? "?"}), ${n(a.followers)} followers`,
    `**Posted:** ${postedAt(post)}`,
    `**Link:** ${post.url ?? ""}`,
    `**Engagement:** ${engagement(post)}`,
  ];
  if (post.replying_to) meta.push(`**Replying to:** @${post.replying_to}`);
  if (article) meta.push(`**Type:** X Article`);
  out.push(meta.join("  \n"));

  if (post.community_note?.text) out.push(`**Community note:** ${post.community_note.text}`);

  // For article posts the text is just the article link, so skip it.
  if (!article && post.text) out.push(post.text);

  const media = renderMedia(post.media);
  if (media.length) out.push(media.join("\n"));

  const poll = renderPoll(post.poll);
  if (poll.length) out.push(poll.join("\n"));

  if (post.quote) out.push(quoteBlock(post.quote));

  if (article) out.push("---", renderArticle(article));

  return out.filter(Boolean).join("\n\n").trim() + "\n";
}
