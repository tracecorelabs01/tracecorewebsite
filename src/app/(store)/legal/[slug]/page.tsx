import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { extractToc, Markdown } from "@/components/content/Markdown";
import { PageHero } from "@/components/ui/PageHero";
import { getStoreSettings } from "@/lib/catalog/server";
import { getLegalDoc, isLegalSlug, LEGAL_DOCS, type LegalSlug } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import { fillTokens } from "@/lib/tokens";

// The store's policies, edited in the admin under Legal pages (src/lib/legal.ts has the format and the drafts).

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

// Rendered straight into the HTML (no Suspense around the content), with a real 404 for an unknown slug.
export const instant = false;

const LEGAL_DESCRIPTIONS: Record<LegalSlug, string> = {
  terms: "The terms for buying from TraceCoreLab: orders, payment, worldwide shipping, the 3-month warranty and acceptable use of the hardware.",
  refunds: "How cancellations, refunds and warranty replacements work at TraceCoreLab, including the 3-month warranty on every product.",
  shipping: "TraceCoreLab shipping and delivery: worldwide tracked shipping, dispatch times, the free-shipping threshold, duties and lost parcels.",
  privacy: "How TraceCoreLab collects, uses and protects your personal data when you browse, order, sign in or contact support.",
  affiliate: "The terms of the TraceCoreLab partner program: sign-up, partner prices, commission, payouts and the rules partners agree to.",
  warranty: "The TraceCoreLab 3-month warranty: what it covers, how to make a claim, replacements for defective or damaged items and what isn't covered.",
};

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return isLegalSlug(slug) ? pageMetadata({ title: LEGAL_DOCS[slug], description: LEGAL_DESCRIPTIONS[slug], path: `/legal/${slug}` }) : {};
}

// Section numbers ("01", "02"...) before each policy heading, matching the list beside it.
const NUMBERED_SECTIONS =
  "[counter-reset:legal] [&_h2]:[counter-increment:legal] [&_h2]:before:mr-3 [&_h2]:before:text-gradient [&_h2]:before:content-[counter(legal,decimal-leading-zero)]";

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const title = LEGAL_DOCS[slug];
  const [{ body, updatedAt }, settings] = await Promise.all([getLegalDoc(slug), getStoreSettings()]);
  const source = fillTokens(body, { settings });
  const sections = extractToc(source).filter((h) => h.depth === 2);

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
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-fg">
                    <span className="mr-2 font-mono text-xs text-blaze">{String(i + 1).padStart(2, "0")}</span>
                    {s.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="lg:col-span-8">
            <Markdown source={source} className={NUMBERED_SECTIONS} />
          </article>
        </div>
      </section>
    </>
  );
}
