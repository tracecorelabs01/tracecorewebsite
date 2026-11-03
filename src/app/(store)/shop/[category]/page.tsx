import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Markdown } from "@/components/content/Markdown";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShopClient } from "@/components/shop/ShopClient";
import { PageHero } from "@/components/ui/PageHero";
import { findSlugRedirect, getCatalog, getCategoryPage, getTokenContext } from "@/lib/catalog/server";
import { breadcrumbLd, collectionPageLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { fillTokens } from "@/lib/tokens";

// A category's own landing page: its intro, then the shop grid filtered to it. Rendered into the HTML with a real
// 404 for unknown slugs (no Suspense around the content), like product pages.
export const instant = false;

/** Categories with fewer products than this stay out of search results (a near-empty listing is thin content). */
const MIN_INDEXABLE = 2;

export async function generateStaticParams() {
  const { categories } = await getCatalog();
  return categories.length ? categories.map((c) => ({ category: c.id })) : [{ category: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const [page, { products }] = await Promise.all([getCategoryPage(category), getCatalog()]);
  if (!page) return {};
  const tokens = await getTokenContext();
  const count = products.filter((p) => p.category === page.id).length;
  return pageMetadata({
    title: page.seoTitle || page.label,
    description: fillTokens(page.seoDescription || page.blurb || page.intro, tokens),
    path: `/shop/${page.id}`,
    noindex: count < MIN_INDEXABLE,
  });
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  const [page, { products, categories }] = await Promise.all([getCategoryPage(category), getCatalog()]);
  if (!page) {
    const renamed = await findSlugRedirect("category", category);
    if (renamed) permanentRedirect(`/shop/${renamed}`);
    notFound();
  }
  const tokens = await getTokenContext();
  const inCategory = products.filter((p) => p.category === page.id);
  const intro = page.intro ? fillTokens(page.intro, tokens) : "";

  return (
    <>
      <JsonLd
        data={[
          collectionPageLd({
            path: `/shop/${page.id}`,
            name: page.label,
            description: page.seoDescription || page.blurb,
            dateModified: page.contentUpdatedAt,
            items: inCategory.map((p) => ({ name: p.name, path: `/product/${p.slug}` })),
          }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: page.label }]),
        ]}
      />
      <PageHero
        kicker="The store"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: page.label }]}
        lines={[page.label]}
        description={page.blurb}
      />
      {intro && (
        <section className="container-x pb-16">
          <Markdown source={intro} className="max-w-3xl" />
        </section>
      )}
      <ShopClient products={products} categories={categories} category={page.id} />
    </>
  );
}
