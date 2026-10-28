import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getProductBySlug } from "@/lib/catalog/server";
import { relatedProducts } from "@/lib/catalog/types";
import { ProductView } from "@/components/product/ProductView";

export async function generateStaticParams() {
  const { products } = await getCatalog();
  // Cache Components requires at least one param; unknown slugs render on demand.
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const description = product.seoDescription ?? product.summary;
  return {
    title: product.seoTitle ?? product.name,
    description,
    openGraph: { title: product.seoTitle ?? `${product.name} — ${product.tagline}`, description },
  };
}

// `params` is URL data, so it's read inside Suspense: the route's shared App
// Shell (used for prefetching) stays URL-independent.
export default function ProductPage({ params }: PageProps<"/product/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: Pick<PageProps<"/product/[slug]">, "params">) {
  const { slug } = await params;
  const { products } = await getCatalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductView key={product.slug} product={product} related={relatedProducts(products, product)} />;
}

function ProductSkeleton() {
  return (
    <section className="container-x pb-28 pt-[130px] md:pt-[150px]" aria-busy="true">
      <div className="mb-8 h-3 w-64 rounded bg-white/5" />
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="aspect-square animate-pulse rounded-[32px] border border-line bg-ink-900 md:aspect-[5/4] lg:col-span-7" />
        <div className="space-y-5 lg:col-span-5">
          <div className="h-6 w-40 rounded bg-white/5" />
          <div className="h-24 w-full rounded bg-white/5" />
          <div className="h-12 w-48 rounded bg-white/5" />
          <div className="h-28 w-full rounded bg-white/5" />
        </div>
      </div>
    </section>
  );
}
