import type { MetadataRoute } from "next";
import { getCatalog, getContentDates } from "@/lib/catalog/server";
import { getGuideSlugsForSitemap } from "@/lib/guides";
import { getLegalDoc, LEGAL_DOCS, type LegalSlug } from "@/lib/legal";
import { site } from "@/lib/site";

// Every indexable URL. lastmod is when a page's copy last changed (content_updated_at), never stock or price
// edits, so search engines can trust it. Noindex pages (account, partner portal, near-empty categories) are left out.

/** Same rule as the category page's noindex (src/app/(store)/shop/[category]/page.tsx). */
const MIN_INDEXABLE = 2;

const abs = (path: string) => (path.startsWith("http") ? path : `${site.url}${path}`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ products, categories }, dates, guides, legal] = await Promise.all([
    getCatalog(),
    getContentDates(),
    getGuideSlugsForSitemap(),
    Promise.all((Object.keys(LEGAL_DOCS) as LegalSlug[]).map(async (slug) => ({ slug, updatedAt: (await getLegalDoc(slug)).updatedAt }))),
  ]);
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

  const pages = ["", "/shop", "/guides", "/tools/pixel-clock-calculator", "/faq", "/support", "/about", "/partners"].map((path) => ({ url: abs(path) }));
  return [
    ...pages,
    ...categories.filter((c) => (counts.get(c.id) ?? 0) >= MIN_INDEXABLE).map((c) => ({ url: abs(`/shop/${c.id}`), lastModified: dates.categories[c.id] })),
    ...products.map((p) => ({
      url: abs(`/product/${p.slug}`),
      lastModified: dates.products[p.slug],
      images: (p.gallery ?? [p.visual]).flatMap((v) => (v.kind === "image" ? [abs(v.src)] : [])),
    })),
    ...guides.map((g) => ({ url: abs(`/guides/${g.slug}`), lastModified: g.contentUpdatedAt ?? undefined, images: g.coverUrl ? [abs(g.coverUrl)] : undefined })),
    ...legal.map((l) => ({ url: abs(`/legal/${l.slug}`), lastModified: l.updatedAt ?? undefined })),
  ];
}
