import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { ShopClient, ShopSkeleton } from "@/components/shop/ShopClient";
import { getCatalog } from "@/lib/catalog/server";

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
      <Suspense fallback={<ShopSkeleton />}>
        <ShopClient products={products} categories={categories} />
      </Suspense>
    </>
  );
}
