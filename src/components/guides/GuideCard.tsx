import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GUIDE_KIND_LABELS } from "@/lib/guide-labels";
import type { GuideSummary } from "@/lib/guides";
import { plainText } from "@/lib/markdown";

// A guide in a list: the /guides hub sections and the "more guides" block under a guide.

const WORDS_PER_MINUTE = 220;

/** Words a reader sees (code, tables and image syntax left out). */
export const wordCount = (markdown: string) => plainText(markdown).split(" ").filter(Boolean).length;

export const readingMinutes = (markdown: string) => Math.max(1, Math.round(wordCount(markdown) / WORDS_PER_MINUTE));

export function GuideCard({ guide, minutes }: { guide: GuideSummary; minutes?: number }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-ink-900/80 p-6 transition-colors duration-300 hover:border-line-strong">
      <div className="flex items-center justify-between gap-3 type-kicker !tracking-[0.16em] text-dim">
        <span className="text-blaze">{GUIDE_KIND_LABELS[guide.kind]}</span>
        {minutes !== undefined && <span>{minutes} min read</span>}
      </div>
      <h3 className="mt-4 font-display text-2xl uppercase leading-tight text-fg">
        <Link href={`/guides/${guide.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-blaze">
          {guide.title}
        </Link>
      </h3>
      {guide.description && <p className="mt-3 text-sm leading-relaxed text-muted">{guide.description}</p>}
      <span className="mt-auto flex items-center gap-1.5 pt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors group-hover:text-fg" aria-hidden>
        Read the guide <ArrowUpRight className="size-3.5 text-blaze" />
      </span>
    </article>
  );
}
