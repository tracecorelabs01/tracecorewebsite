import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";

// PLACEHOLDER — these pages are scaffolding only. Have your actual policies
// written (or reviewed) for the jurisdictions you sell into.
const docs = {
  terms: {
    title: "Terms of service",
    sections: ["Overview", "Orders & pricing", "Shipping & delivery", "Warranty", "Limitation of liability", "Contact"],
  },
  privacy: {
    title: "Privacy policy",
    sections: ["What we collect", "How we use it", "Payments", "Cookies & analytics", "Your rights", "Contact"],
  },
  refunds: {
    title: "Refund policy",
    sections: ["Returns window", "Condition of items", "Warranty claims", "How refunds are issued", "Exchanges", "Contact"],
  },
} as const;

type Slug = keyof typeof docs;

export function generateStaticParams() {
  return Object.keys(docs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs[slug as Slug];
  return doc ? { title: doc.title } : {};
}

export default function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
      <LegalContent params={params} />
    </Suspense>
  );
}

async function LegalContent({ params }: Pick<PageProps<"/legal/[slug]">, "params">) {
  const { slug } = await params;
  const doc = docs[slug as Slug];
  if (!doc) notFound();

  return (
    <>
      <PageHero kicker="Legal" crumbs={[{ label: "Home", href: "/" }, { label: doc.title }]} lines={[doc.title]} />
      <section className="container-x pb-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <nav className="hidden lg:col-span-3 lg:block" aria-label="On this page">
            <ul className="sticky top-28 space-y-2 text-sm text-muted">
              {doc.sections.map((s, i) => (
                <li key={s}>
                  <a href={`#s${i}`} className="hover:text-fg">
                    <span className="mr-2 font-mono text-xs text-blaze">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="space-y-12 lg:col-span-8">
            <p className="rounded-2xl border border-warn/30 bg-warn/[0.06] p-4 text-sm text-fg/85">
              Placeholder text. Replace this page with your own {doc.title.toLowerCase()} before launch.
            </p>
            {doc.sections.map((s, i) => (
              <div key={s} id={`s${i}`} className="scroll-mt-32 border-t border-line pt-8">
                <h2 className="font-display text-3xl uppercase">
                  <span className="mr-3 text-gradient">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </h2>
                <p className="mt-4 leading-relaxed text-muted">
                  Describe your policy for “{s.toLowerCase()}” here in plain language: what applies, any time limits, and how customers can reach you about it.
                </p>
              </div>
            ))}
          </article>
        </div>
      </section>
    </>
  );
}
