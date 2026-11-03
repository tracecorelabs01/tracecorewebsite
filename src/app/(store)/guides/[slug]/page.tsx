import Image from "next/image";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { extractToc, extractVideos, Markdown, type ImageDims, type TocEntry } from "@/components/content/Markdown";
import { GuideCard, readingMinutes } from "@/components/guides/GuideCard";
import { ProductCard } from "@/components/product/ProductCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { SupportCta } from "@/components/support/SupportCta";
import { PageHero } from "@/components/ui/PageHero";
import { findSlugRedirect, getCatalog, getTokenContext } from "@/lib/catalog/server";
import { getGuide, getGuides, GUIDE_KIND_LABELS, GUIDE_SECTION_LABELS } from "@/lib/guides";
import { breadcrumbLd, techArticleLd, videoObjectLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { fillTokens } from "@/lib/tokens";

// One guide. Rendered straight into the HTML (no Suspense around it): search engines get the whole guide in the
// first response, and an unknown slug gets a real 404 status. Renamed guides redirect to their new slug.
export const instant = false;

export async function generateStaticParams() {
  const guides = await getGuides();
  // Cache Components requires at least one param; guides published after the build render on demand.
  return guides.length ? guides.map((g) => ({ slug: g.slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return {};
  const tokens = await getTokenContext();
  const { openGraph, twitter, ...meta } = pageMetadata({
    title: guide.seoTitle || guide.title,
    description: fillTokens(guide.description, tokens),
    path: `/guides/${guide.slug}`,
    type: "article",
    article: {
      publishedTime: guide.publishedAt ?? undefined,
      modifiedTime: guide.contentUpdatedAt ?? guide.publishedAt ?? undefined,
      section: GUIDE_SECTION_LABELS[guide.section],
    },
  });
  // The share image is this segment's opengraph-image.tsx. Next only uses a file image when the page's own metadata
  // sets no `images`, so they're left out here (Twitter then takes the Open Graph image).
  return { ...meta, openGraph: openGraph && withoutImages(openGraph), twitter: twitter && withoutImages(twitter) };
}

function withoutImages<T extends { images?: unknown }>(value: T): Omit<T, "images"> {
  const rest = { ...value };
  delete rest.images;
  return rest;
}

/** Guide uploads carry their pixel size in the file name (uploadGuideImage): /media/guides/2026/11/<id>.<w>x<h>.webp */
function mediaDims(text: string): ImageDims {
  const dims: ImageDims = {};
  for (const m of text.matchAll(/\/media\/guides\/[\w/]+\.(\d+)x(\d+)\.webp/g)) dims[m[0]] = { width: Number(m[1]), height: Number(m[2]) };
  return dims;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) {
    const renamed = await findSlugRedirect("guide", slug);
    if (renamed) permanentRedirect(`/guides/${renamed}`);
    notFound();
  }
  const [tokens, { products: catalog }, guides] = await Promise.all([getTokenContext(), getCatalog(), getGuides()]);
  const source = fillTokens(guide.body, tokens);
  const toc = extractToc(source).filter((h) => h.depth === 2);
  const videos = extractVideos(source);
  const dims = mediaDims(`${source}\n${guide.coverUrl ?? ""}`);
  const cover = guide.coverUrl ? dims[guide.coverUrl] : undefined;
  const products = guide.relatedProducts.flatMap((s) => catalog.find((p) => p.slug === s) ?? []);
  const moreGuides = guides.filter((g) => g.section === guide.section && g.slug !== guide.slug).slice(0, 3);
  const section = GUIDE_SECTION_LABELS[guide.section];
  const description = fillTokens(guide.description, tokens);
  const path = `/guides/${guide.slug}`;

  return (
    <>
      <JsonLd
        data={[
          techArticleLd({
            path,
            headline: guide.title,
            description,
            image: guide.coverUrl ?? "/opengraph-image.png",
            datePublished: guide.publishedAt ?? undefined,
            dateModified: guide.contentUpdatedAt ?? undefined,
            about: products,
            section,
          }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: guide.title }]),
          ...videos.map((v) => videoObjectLd(v, { name: guide.title, description })),
        ]}
      />
      <PageHero
        kicker={`${section} · ${GUIDE_KIND_LABELS[guide.kind]}`}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: section, href: `/guides#${guide.section}` },
        ]}
        lines={[
          <span key="t" className="block max-w-5xl text-[clamp(2.2rem,4.6vw,4.25rem)]">
            {guide.title}
          </span>,
        ]}
        description={description}
      >
        <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          <span className="text-muted">By the TraceCoreLab team</span>
          {guide.reviewedAt ? (
            <span>
              <span aria-hidden className="mr-3 text-blaze">/</span>Last reviewed <time dateTime={guide.reviewedAt}>{longDate(guide.reviewedAt)}</time>
            </span>
          ) : guide.contentUpdatedAt ? (
            <span>
              <span aria-hidden className="mr-3 text-blaze">/</span>Updated <time dateTime={guide.contentUpdatedAt}>{longDate(guide.contentUpdatedAt)}</time>
            </span>
          ) : null}
          <span>
            <span aria-hidden className="mr-3 text-blaze">/</span>
            {readingMinutes(source)} min read
          </span>
        </p>
      </PageHero>

      <section className="container-x pb-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {toc.length > 1 && (
            <aside className="lg:col-span-3">
              <details className="rounded-2xl border border-line bg-ink-900/60 p-5 lg:hidden">
                <summary className="cursor-pointer type-kicker text-muted">On this page</summary>
                <TocList toc={toc} className="mt-4" />
              </details>
              <nav aria-label="On this page" className="sticky top-28 hidden lg:block">
                <p className="type-kicker text-dim">On this page</p>
                <TocList toc={toc} className="mt-4" />
              </nav>
            </aside>
          )}
          <article className={toc.length > 1 ? "min-w-0 lg:col-span-8" : "min-w-0 lg:col-span-8 lg:col-start-3"}>
            {guide.coverUrl &&
              (cover ? (
                <Image
                  src={guide.coverUrl}
                  alt={guide.coverAlt}
                  width={cover.width}
                  height={cover.height}
                  sizes="(min-width: 1024px) 760px, 100vw"
                  loading="eager"
                  fetchPriority="high"
                  className="mb-10 h-auto w-full rounded-2xl border border-line"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- size unknown (an outside URL), which next/image needs
                <img src={guide.coverUrl} alt={guide.coverAlt} className="mb-10 h-auto w-full rounded-2xl border border-line" />
              ))}
            <Markdown source={source} imageDims={dims} />
          </article>
        </div>
      </section>

      {products.length > 0 && (
        <section aria-labelledby="guide-products" className="container-x pb-20">
          <h2 id="guide-products" className="type-h2">
            Hardware in this guide
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {moreGuides.length > 0 && (
        <section aria-labelledby="guide-more" className="container-x pb-20">
          <h2 id="guide-more" className="type-h2">
            More in {section}
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {moreGuides.map((g) => (
              <li key={g.slug}>
                <GuideCard guide={g} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <SupportCta />
    </>
  );
}

function TocList({ toc, className }: { toc: TocEntry[]; className?: string }) {
  return (
    <ol className={className}>
      {toc.map((h, i) => (
        <li key={h.id} className="border-l border-line py-1.5 pl-4 text-sm leading-snug">
          <a href={`#${h.id}`} className="text-muted transition-colors hover:text-fg">
            <span className="mr-2 font-mono text-[11px] text-blaze">{String(i + 1).padStart(2, "0")}</span>
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
