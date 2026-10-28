import { Suspense } from "react";
import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { PageHero } from "@/components/ui/PageHero";
import { ShopClient, ShopSkeleton } from "@/components/shop/ShopClient";
import { getCatalog } from "@/lib/catalog/server";
import { SETUP_PRODUCT_SLUGS } from "@/lib/setup-builder";

export const metadata: Metadata = {
  title: "Shop",
  description: "DMA cards, input devices, bundles and accessories — tested in our lab and shipped worldwide.",
};

export default async function ShopPage() {
  const { products, categories } = await getCatalog();
  return (
    <>
      <PageHero
        kicker="The store"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
        lines={[
          "Shop the",
          <span key="b" className="text-gradient">
            lab.
          </span>,
        ]}
        description="Every card, device and accessory we make — tested before dispatch, shipped worldwide, and backed by our team."
      />
      <SetupBuilder products={products.filter((p) => SETUP_PRODUCT_SLUGS.has(p.slug))} />
      <Suspense fallback={<ShopSkeleton />}>
        <ShopClient products={products} categories={categories} />
      </Suspense>
    </>
  );
}
