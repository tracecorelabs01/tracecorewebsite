import { Suspense } from "react";
import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { PageHero } from "@/components/ui/PageHero";
import { ShopClient, ShopSkeleton } from "@/components/shop/ShopClient";
import { PaymentLogos, TrustBadges } from "@/components/ui/Badges";
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
      <section className="container-x pb-16">
        <div className="rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
          <TrustBadges />
          <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="type-kicker text-dim">Pay your way</span>
            <PaymentLogos size="sm" />
          </div>
        </div>
      </section>
      <SetupBuilder config={builder} products={products.filter((p) => builderSlugs.has(p.slug))} />
      <Suspense fallback={<ShopSkeleton />}>
        <ShopClient products={products} categories={categories} />
      </Suspense>
    </>
  );
}
