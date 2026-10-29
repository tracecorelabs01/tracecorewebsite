import { Suspense } from "react";
import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { PageHero } from "@/components/ui/PageHero";
import { ShopClient, ShopSkeleton } from "@/components/shop/ShopClient";
import { getCatalog, getSetupBuilder } from "@/lib/catalog/server";
import { builderProductSlugs } from "@/lib/setup-builder";

export const metadata: Metadata = {
  title: "Shop",
  description: "DMA cards, input devices, bundles and accessories — tested in our lab and shipped worldwide.",
};

export default async function ShopPage() {
  const [{ products, categories }, builder] = await Promise.all([getCatalog(), getSetupBuilder()]);
  const builderSlugs = builderProductSlugs(builder);
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
      <SetupBuilder config={builder} products={products.filter((p) => builderSlugs.has(p.slug))} />
      <Suspense fallback={<ShopSkeleton />}>
        <ShopClient products={products} categories={categories} />
      </Suspense>
    </>
  );
}
