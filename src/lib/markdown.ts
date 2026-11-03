// Pure helpers for the GitHub-flavoured Markdown that guides, legal pages, category intros and product descriptions
// are written in. The renderer is src/components/content/Markdown.tsx; these read the same source without rendering
// it (tables of contents, embedded videos, plain text for descriptions, unfilled placeholders). No server-only
// import: admin forms use them too. Self-check: npx tsx scripts/self-check.ts

import GithubSlugger from "github-slugger";

export interface TocEntry {
  /** 1 to 6, from the number of #s. */
  depth: number;
  text: string;
  /** The id the rendered heading gets (rehype-slug), for #links. */
  id: string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const lf = (s: string) => s.replace(/\r\n?/g, "\n");

/** Inline Markdown as the text it renders to: link and emphasis syntax gone, code kept, images dropped. */
function inlineText(md: string): string {
  const strip = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      .replace(/\[\^[^\]]+\]/g, "")
      .replace(/<((?:https?:\/\/|mailto:)[^>\s]+|[^>\s@]+@[^>\s]+)>/g, "$1")
      .replace(/(?<!\\)(\*\*|__)(?=\S)(.+?)(?<=\S)(?<!\\)\1/g, "$2")
      .replace(/(?<![\\*])\*(?=[^\s*])(.+?)(?<=[^\s\\])\*/g, "$1")
      .replace(/(?<![\w\\])_(?=\S)(.+?)(?<=\S)(?<!\\)_(?!\w)/g, "$1")
      .replace(/(?<!\\)~~(.+?)(?<!\\)~~/g, "$1")
      .replace(/\\([!-/:-@[-`{-~])/g, "$1")
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]);
  // Code spans keep their content exactly; everything between them is stripped.
  return md
    .split(/(`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part.slice(1, -1) : strip(part)))
    .join("")
    .trim();
}

/**
 * The document's headings, in order, with the ids the renderer gives them (the same github-slugger over the same
 * text as rehype-slug), for a table of contents. Reads ATX headings ("## Title"); headings inside fenced code are
 * skipped. Pass the same source the page renders (tokens already filled).
 */
export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const toc: TocEntry[] = [];
  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(f[0].length).trim()) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    const h = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!h) continue;
    const text = inlineText(h[2]);
    const id = slugger.slug(text);
    if (text) toc.push({ depth: h[1].length, text, id });
  }
  return toc;
}

export interface MarkdownVideo {
  /** YouTube video id. */
  id: string;
  title?: string;
  /** Upload date, YYYY-MM-DD (VideoObject uploadDate). */
  date?: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(value: string): string | undefined {
  if (YOUTUBE_ID.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(?:www|m)\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : /^(?:youtube\.com|youtube-nocookie\.com)$/.test(host)
          ? (url.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1])
          : undefined;
    return id && YOUTUBE_ID.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The contents of a ```youtube block: the video id or a YouTube link, then optional "title:" and "date:" lines.
 *
 *     ```youtube
 *     id: dQw4w9WgXcQ
 *     title: Fitting the Thermal Kit to a 75T DMA card
 *     date: 2026-11-01
 *     ```
 */
export function parseVideoBlock(text: string): MarkdownVideo | null {
  let id: string | undefined;
  let title: string | undefined;
  let date: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const kv = /^(id|title|date)\s*:\s*(.+)$/i.exec(line);
    const key = kv?.[1].toLowerCase();
    const value = kv?.[2].trim() ?? line;
    if (key === "title") title = value;
    else if (key === "date") date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    else id ??= youtubeId(value);
  }
  return id ? { id, ...(title ? { title } : {}), ...(date ? { date } : {}) } : null;
}

/** Every ```youtube block in the document, in order (for VideoObject JSON-LD). */
export function extractVideos(markdown: string): MarkdownVideo[] {
  const videos: MarkdownVideo[] = [];
  for (const m of lf(markdown).matchAll(/^ {0,3}(`{3,}|~{3,})[ \t]*youtube[ \t]*\n([\s\S]*?)^ {0,3}\1[ \t]*$/gm)) {
    const video = parseVideoBlock(m[2]);
    if (video) videos.push(video);
  }
  return videos;
}

/** Fenced code blocks and code spans removed: their brackets and underscores are literal. */
function withoutCode(markdown: string): string {
  return lf(markdown).replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[ \t]*$|(?![\s\S]))/gm, "").replace(/`[^`\n]*`/g, "");
}

/**
 * Markdown as plain text on one line, for meta descriptions and structured data: code, tables, images and
 * definitions dropped; headings, lists, quotes and links reduced to their words.
 */
export function plainText(markdown: string): string {
  return withoutCode(markdown)
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\||\[[^\]]+\]:|(?:[-*_]\s*){3,}$)/.test(line))
    .map((line) =>
      inlineText(
        line
          .replace(/^\s*>\s?(?:\[![a-zA-Z]+\]\s*)?/, "")
          .replace(/^\s*#{1,6}\s+/, "")
          .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, ""),
      ),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bracketed text left for the owner to replace, like "[Registered business name]" or "[your address]", and blanks
 * of three or more underscores. Markdown's own brackets don't count: links ([text](url), [text][ref], defined
 * [ref]s), images, GitHub alerts ([!NOTE]), task items ([ ], [x]), footnotes ([^1]) and anything in code.
 */
export function findPlaceholders(markdown: string): string[] {
  const prose = withoutCode(markdown).replace(/^ {0,3}(?:_[ \t]*){3,}$/gm, "");
  const label = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const defined = new Set([...prose.matchAll(/^ {0,3}\[([^\]\n]+)\]:/gm)].map((m) => label(m[1])));
  const found: string[] = [];
  for (const m of prose.matchAll(/(?<![\\\]!])\[([^\]\n]+)\](?![([:])/g)) {
    const inner = m[1];
    if (/^[ xX]$/.test(inner) || /^\s*[!^]/.test(inner) || /^\s*\d+\s*$/.test(inner) || defined.has(label(inner))) continue;
    found.push(m[0]);
  }
  for (const m of prose.matchAll(/(?<!\w)_{3,}(?!\w)/g)) found.push(m[0]);
  return [...new Set(found)];
}
