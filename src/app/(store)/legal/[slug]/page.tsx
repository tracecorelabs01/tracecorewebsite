import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getStoreSettings } from "@/lib/catalog/server";
import { getLegalDoc, isLegalSlug, LEGAL_DOCS } from "@/lib/legal";
import { formatPrice } from "@/lib/utils";

// The store's policies, edited in the admin under Legal pages (src/lib/legal.ts has the format and the drafts).

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return isLegalSlug(slug) ? { title: LEGAL_DOCS[slug] } : {};
}

export default function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
      <LegalContent params={params} />
    </Suspense>
  );
}

type Block = { list: string[] } | { text: string };
type Section = { title: string; blocks: Block[] };

/** "## " lines start sections; blank lines separate paragraphs; "- " lines are bullets. */
function parse(body: string): Section[] {
  const sections: Section[] = [{ title: "", blocks: [] }];
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    while (lines[0]?.startsWith("## ")) sections.push({ title: lines.shift()!.slice(3).trim(), blocks: [] });
    if (!lines.length) continue;
    const blocks = sections.at(-1)!.blocks;
    if (lines.every((l) => l.startsWith("- "))) blocks.push({ list: lines.map((l) => l.slice(2)) });
    else blocks.push({ text: lines.join(" ") });
  }
  return sections.filter((s) => s.title || s.blocks.length);
}

const SAFE_HREF = /^(https?:\/\/|mailto:|\/)/;

/** **bold** and [text](link); everything else is plain text. */
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} className="font-semibold text-fg">{m[1]}</strong>);
    else if (SAFE_HREF.test(m[3])) {
      const cls = "text-fg underline underline-offset-4 hover:text-blaze";
      parts.push(m[3].startsWith("/") ? <Link key={m.index} href={m[3]} className={cls}>{m[2]}</Link> : <a key={m.index} href={m[3]} className={cls}>{m[2]}</a>);
    } else parts.push(m[2]);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((b, i) =>
    "list" in b ? (
      <ul key={i} className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted marker:text-blaze">
        {b.list.map((item, j) => (
          <li key={j}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i} className="mt-4 leading-relaxed text-muted">
        <Inline text={b.text} />
      </p>
    ),
  );
}

async function LegalContent({ params }: Pick<PageProps<"/legal/[slug]">, "params">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const title = LEGAL_DOCS[slug];
  const [{ body, updatedAt }, settings] = await Promise.all([getLegalDoc(slug), getStoreSettings()]);
  const filled = body
    .replaceAll("{{supportEmail}}", `[${settings.supportEmail}](mailto:${settings.supportEmail})`)
    .replaceAll("{{freeShippingThreshold}}", formatPrice(settings.freeShippingThreshold))
    .replaceAll("{{flatShipping}}", formatPrice(settings.flatShipping));
  const sections = parse(filled);
  const titled = sections.filter((s) => s.title);

  return (
    <>
      <PageHero
        kicker="Legal"
        crumbs={[{ label: "Home", href: "/" }, { label: title }]}
        lines={[title]}
        description={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}` : undefined}
      />
      <section className="container-x pb-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <nav className="hidden lg:col-span-3 lg:block" aria-label="On this page">
            <ul className="sticky top-28 space-y-2 text-sm text-muted">
              {titled.map((s, i) => (
                <li key={i}>
                  <a href={`#s${i}`} className="hover:text-fg">
                    <span className="mr-2 font-mono text-xs text-blaze">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="space-y-12 lg:col-span-8">
            {sections.map((s, i) =>
              s.title ? (
                <div key={i} id={`s${titled.indexOf(s)}`} className="scroll-mt-32 border-t border-line pt-8">
                  <h2 className="font-display text-3xl uppercase">
                    <span className="mr-3 text-gradient">{String(titled.indexOf(s) + 1).padStart(2, "0")}</span>
                    {s.title}
                  </h2>
                  <Blocks blocks={s.blocks} />
                </div>
              ) : (
                <div key={i}>
                  <Blocks blocks={s.blocks} />
                </div>
              ),
            )}
          </article>
        </div>
      </section>
    </>
  );
}
