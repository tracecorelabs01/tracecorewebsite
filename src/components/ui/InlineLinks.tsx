import Link from "next/link";
import type { ReactNode } from "react";

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const linkClass = "text-fg underline decoration-blaze/60 underline-offset-4 transition-colors hover:text-blaze";

/**
 * Short copy (FAQ answers) with Markdown-style [label](/path) links turned into real links. Only site paths and
 * http(s) URLs become links; anything else stays as its label text.
 */
export function withLinks(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const [all, label, href] = m;
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (href.startsWith("/")) {
      out.push(
        <Link key={at} href={href} className={linkClass}>
          {label}
        </Link>,
      );
    } else if (/^https?:\/\//.test(href)) {
      out.push(
        <a key={at} href={href} rel="noopener noreferrer" className={linkClass}>
          {label}
        </a>,
      );
    } else out.push(label);
    last = at + all.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}
