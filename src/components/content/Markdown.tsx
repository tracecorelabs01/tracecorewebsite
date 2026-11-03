// GitHub-flavoured Markdown for guides, legal pages, category intros and product descriptions. Renders on the
// server (no "use client"; an admin preview may render it in the browser too). Fill tokens first (fillTokens).
//
// - Headings get ids (rehype-slug) and a hover # link; extractToc() gives the same ids for a table of contents.
//   A "#" heading renders as h2: the page has its own h1.
// - GitHub alerts (> [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]), tables that scroll sideways, numbered
//   lists drawn as steps, footnotes and task lists.
// - Images use next/image when `imageDims` has the size of a site image, otherwise a lazy <img>. Alt text comes
//   from the Markdown (![alt](src)).
// - Links: site paths through next/link, outside links open in a new tab. Only http(s), mailto and relative URLs
//   survive; anything else is dropped. Raw HTML isn't rendered (react-markdown shows it as text).
// - ```youtube blocks (src/lib/markdown.ts, parseVideoBlock) become click-to-load youtube-nocookie embeds; other
//   code blocks get a copy button.

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { Element, ElementContent, Root } from "hast";
import { parseVideoBlock } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { CopyButton, YouTubeEmbed } from "./MarkdownClient";

export { extractToc, extractVideos, type TocEntry } from "@/lib/markdown";

/** Pixel sizes of site images by URL (e.g. "/media/guides/x.webp"), so they can use next/image. */
export type ImageDims = Record<string, { width: number; height: number }>;

const ALERTS = {
  note: { label: "Note", box: "border-line-strong bg-ink-900/70", text: "text-muted" },
  tip: { label: "Tip", box: "border-ok/30 bg-ok/[0.05]", text: "text-ok" },
  important: { label: "Important", box: "border-blaze/40 bg-blaze/[0.06]", text: "text-blaze" },
  warning: { label: "Warning", box: "border-warn/40 bg-warn/[0.06]", text: "text-warn" },
  caution: { label: "Caution", box: "border-ember/40 bg-ember/[0.06]", text: "text-ember" },
} as const;
type AlertKind = keyof typeof ALERTS;

const HEADING = {
  h2: "mt-12 border-t border-line pt-8 font-display text-3xl uppercase",
  h3: "mt-8 font-display text-2xl uppercase",
  h4: "mt-6 font-semibold text-fg",
  h5: "mt-6 font-semibold text-fg",
  h6: "mt-6 font-semibold text-fg",
};

const LINK = "text-fg underline underline-offset-4 hover:text-blaze";

// Numbered lists as steps: a numbered badge beside each item, counted with a CSS counter.
const STEPS =
  "mt-6 space-y-4 leading-relaxed text-muted [&>li]:relative [&>li]:min-h-8 [&>li]:pl-12 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[-0.15rem] [&>li]:before:grid [&>li]:before:size-8 [&>li]:before:place-items-center [&>li]:before:rounded-full [&>li]:before:border [&>li]:before:border-blaze/40 [&>li]:before:font-mono [&>li]:before:text-xs [&>li]:before:text-blaze [&>li]:before:content-[counter(step)]";

const SAFE_PROTOCOL = /^(?:https?|mailto)$/i;

/** Keeps http(s), mailto and relative URLs; drops the rest (javascript:, data:, //other-host...). */
function safeUrl(url: string): string | undefined {
  if (/^\s*[\\/]{2}/.test(url)) return undefined;
  const colon = url.indexOf(":");
  if (colon === -1) return url;
  // A colon after the first /, ? or # isn't a protocol.
  if ([..."/?#"].some((c) => url.includes(c) && url.indexOf(c) < colon)) return url;
  return SAFE_PROTOCOL.test(url.slice(0, colon)) ? url : undefined;
}

const textOf = (n: ElementContent | Element): string => (n.type === "text" ? n.value : "children" in n ? n.children.map(textOf).join("") : "");

/** Marks GitHub alerts with data-alert (dropping the [!NOTE] marker) and footnote lists, so the components can style them. */
function rehypeMarkers() {
  return (tree: Root) => {
    const visit = (parent: Root | Element) => {
      for (const child of parent.children) {
        if (child.type !== "element") continue;
        if (child.tagName === "blockquote") markAlert(child);
        if (child.tagName === "section" && child.properties.dataFootnotes) {
          for (const c of child.children) if (c.type === "element" && c.tagName === "ol") c.properties.dataFootnotes = true;
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

function markAlert(quote: Element) {
  const p = quote.children.find((c): c is Element => c.type === "element");
  if (p?.tagName !== "p") return;
  const first = p.children[0];
  if (first?.type !== "text") return;
  const m = /^\[!(note|tip|important|warning|caution)\][ \t]*\r?\n?/i.exec(first.value);
  if (!m) return;
  first.value = first.value.slice(m[0].length);
  quote.properties.dataAlert = m[1].toLowerCase();
  // "> [!NOTE]" on a line of its own, then a blank quoted line: drop the empty paragraph left behind.
  if (!first.value.trim() && p.children.length === 1) quote.children.splice(quote.children.indexOf(p), 1);
}

function heading(Tag: keyof typeof HEADING) {
  return function MarkdownHeading({ id, className, children }: { id?: string; className?: string; children?: ReactNode }) {
    // The footnotes' own heading stays visually hidden.
    if (className?.includes("sr-only")) return <Tag id={id} className="sr-only">{children}</Tag>;
    return (
      <Tag id={id} className={cn("group scroll-mt-32", HEADING[Tag])}>
        {children}
        {id && (
          <a href={`#${id}`} aria-label="Link to this section" className="ml-3 text-[0.6em] text-blaze no-underline opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
            #
          </a>
        )}
      </Tag>
    );
  };
}

/** react-markdown hands every component its source `node`; it mustn't reach the DOM. */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  h1: heading("h2"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  p: ({ children }) => <p className="mt-4 leading-relaxed text-muted">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  hr: () => <hr className="my-10 border-line" />,
  ul: ({ className, children }) => (
    <ul className={cn("mt-4 space-y-2 leading-relaxed text-muted", className?.includes("contains-task-list") ? "list-none" : "list-disc pl-5 marker:text-blaze")}>{children}</ul>
  ),
  ol: ({ node, start, children }) =>
    node?.properties.dataFootnotes ? (
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-dim">{children}</ol>
    ) : (
      <ol start={start} style={{ counterReset: `step ${(start ?? 1) - 1}` }} className={STEPS}>
        {children}
      </ol>
    ),
  input: ({ type, checked }) => (type === "checkbox" ? <input type="checkbox" defaultChecked={checked} disabled className="mr-2 accent-blaze" /> : null),
  a: (props) => {
    const { href, children, ...rest } = withoutNode(props);
    if (!href) return <>{children}</>;
    if (href.startsWith("/"))
      return (
        <Link href={href} {...rest} className={LINK}>
          {children}
        </Link>
      );
    if (/^https?:/i.test(href))
      return (
        <a href={href} {...rest} className={LINK} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    // #fragments (footnotes), mailto: and relative paths.
    return (
      <a href={href} {...rest} className={cn(LINK, rest.className)}>
        {children}
      </a>
    );
  },
  blockquote: ({ node, children }) => {
    const kind = node?.properties.dataAlert as AlertKind | undefined;
    const alert = kind ? ALERTS[kind] : undefined;
    if (!alert) return <blockquote className="mt-6 border-l-2 border-blaze/60 pl-5 [&>p:first-of-type]:mt-0">{children}</blockquote>;
    return (
      <div role="note" className={cn("mt-6 rounded-2xl border p-5 [&>p:first-of-type]:mt-2", alert.box)}>
        <span className={cn("type-kicker block", alert.text)}>{alert.label}</span>
        {children}
      </div>
    );
  },
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
      <table className="w-full border-collapse text-left text-sm [&_tbody_tr:last-child>td]:border-b-0">{children}</table>
    </div>
  ),
  th: ({ style, children }) => (
    <th style={style} className="border-b border-line bg-ink-900 px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-dim">
      {children}
    </th>
  ),
  td: ({ style, children }) => (
    <td style={style} className="border-b border-line px-4 py-3 align-top text-fg/90">
      {children}
    </td>
  ),
  code: ({ children }) => <code className="rounded-md border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[0.85em] text-fg">{children}</code>,
  // Block code is drawn here from its text, so `code` above only ever styles inline code.
  pre: ({ node }) => {
    const code = node?.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
    const text = code ? textOf(code).replace(/\n$/, "") : "";
    const language = (code?.properties.className as string[] | undefined)?.find((c) => c.startsWith("language-"))?.slice("language-".length);
    if (language === "youtube") {
      const video = parseVideoBlock(text);
      return video ? <YouTubeEmbed id={video.id} title={video.title} /> : null;
    }
    return (
      <div className="relative mt-6">
        <pre className="overflow-x-auto rounded-2xl border border-line bg-ink-900 p-5 pr-28 font-mono text-[13px] leading-relaxed text-fg/90">
          <code>{text}</code>
        </pre>
        <CopyButton text={text} />
      </div>
    );
  },
  section: ({ className, children }) => <section className={cn("mt-12 border-t border-line pt-6 text-sm", className)}>{children}</section>,
};

function MarkdownImage({ src, alt, title, dims }: { src?: unknown; alt?: string; title?: string; dims: ImageDims }) {
  if (typeof src !== "string" || !src) return null;
  const size = src.startsWith("/") ? dims[src] : undefined;
  const className = "mt-6 block h-auto w-full rounded-2xl border border-line";
  if (size) return <Image src={src} alt={alt ?? ""} title={title} width={size.width} height={size.height} sizes="(min-width: 1024px) 760px, 100vw" className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- size unknown (or an outside URL), which next/image needs
  return <img src={src} alt={alt ?? ""} title={title} loading="lazy" decoding="async" className={className} />;
}

export function Markdown({ source, imageDims = {}, className }: { source: string; imageDims?: ImageDims; className?: string }) {
  return (
    <div className={cn("[&>:first-child]:mt-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeMarkers]}
        urlTransform={safeUrl}
        components={{ ...components, img: ({ src, alt, title }) => <MarkdownImage src={src} alt={alt} title={title} dims={imageDims} /> }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
