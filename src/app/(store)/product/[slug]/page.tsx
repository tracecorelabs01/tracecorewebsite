import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Markdown } from "@/components/content/Markdown";
import { ProductView } from "@/components/product/ProductView";
import { JsonLd } from "@/components/seo/JsonLd";
import { findSlugRedirect, getCatalog, getProductBySlug, getProductDetail, getTokenContext } from "@/lib/catalog/server";
import { relatedProducts, type Product } from "@/lib/catalog/types";
import { guidesForProduct } from "@/lib/guides";
import { breadcrumbLd, productLd } from "@/lib/jsonld";
import { pageMetadata, type OgImage } from "@/lib/seo";
import { fillTokens } from "@/lib/tokens";

// Content is rendered straight into the HTML (no Suspense around it): search engines get the product, its specs
// and long description in the first response, and an unknown slug gets a real 404 status.
export const instant = false;

export async function generateStaticParams() {
  const { products } = await getCatalog();
  // Cache Components requires at least one param; unknown slugs render on demand.
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "__none__" }];
}

/** The product's photos as share images; the site image as a fallback for products without one. */
function shareImages(product: Product): OgImage[] {
  const photos = (product.gallery ?? [product.visual]).flatMap((v) => (v.kind === "image" ? [{ url: v.src, alt: v.alt || product.name }] : []));
  return [...photos.slice(0, 1), "/opengraph-image.png"];
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const tokens = await getTokenContext();
  return pageMetadata({
    title: product.seoTitle || product.name,
    description: fillTokens(product.seoDescription || product.summary || product.tagline, tokens),
    path: `/product/${product.slug}`,
    images: shareImages(product),
  });
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const { products } = await getCatalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    const renamed = await findSlugRedirect("product", slug);
    if (renamed) permanentRedirect(`/product/${renamed}`);
    notFound();
  }
  const [detail, tokens, guides] = await Promise.all([getProductDetail(product.slug), getTokenContext(), guidesForProduct(product.slug)]);
  const description = detail?.description ? fillTokens(detail.description, tokens) : "";

  return (
    <>
      <JsonLd
        data={[
          productLd({ product, detail, tokens, rating: product.reviewCount > 0 ? { average: product.rating, count: product.reviewCount } : null }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: product.categoryLabel, path: `/shop/${product.category}` },
            { name: product.name },
          ]),
        ]}
      />
      <ProductView
        key={product.slug}
        product={product}
        related={relatedProducts(products, product)}
        details={
          description || guides.length ? (
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
              {description && (
                <div className="lg:col-span-7">
                  <h2 className="type-kicker text-dim">About the {product.name}</h2>
                  <Markdown source={description} className="mt-6" />
                </div>
              )}
              {guides.length > 0 && (
                <aside className={description ? "lg:col-span-5" : "lg:col-span-12"} aria-labelledby="product-guides">
                  <h2 id="product-guides" className="type-kicker text-dim">
                    Setup and guides
                  </h2>
                  <ul className="mt-6 grid gap-3">
                    {guides.map((g) => (
                      <li key={g.slug}>
                        <Link
                          href={`/guides/${g.slug}`}
                          className="group flex items-start gap-4 rounded-2xl border border-line bg-ink-900/60 p-5 transition-colors hover:border-blaze/50"
                        >
                          <BookOpen className="mt-0.5 size-5 shrink-0 text-blaze" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{g.title}</span>
                            <span className="mt-1 line-clamp-2 block text-sm text-muted">{g.description}</span>
                          </span>
                          <ArrowUpRight className="size-4 shrink-0 text-dim transition-colors group-hover:text-fg" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          ) : null
        }
      />
    </>
  );
}
