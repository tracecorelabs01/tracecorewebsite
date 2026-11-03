import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { ShopClient } from "@/components/shop/ShopClient";
import { PaymentLogos, TrustBadges } from "@/components/ui/Badges";
import { getCatalog, getSetupBuilder } from "@/lib/catalog/server";
import { breadcrumbLd, collectionPageLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { builderProductSlugs } from "@/lib/setup-builder";

export const metadata: Metadata = pageMetadata({
  title: "Shop FPGA DMA Cards, Video Fusers and USB Passthrough Devices",
  description:
    "Shop PCIe DMA cards on Xilinx Artix-7, HDMI and DisplayPort video fusers, USB input passthrough devices and accessories. Lab-tested, shipped worldwide.",
  path: "/shop",
});

export default async function ShopPage() {
  const [{ products, categories }, builder] = await Promise.all([getCatalog(), getSetupBuilder()]);
  const builderSlugs = builderProductSlugs(builder);
  return (
    <>
      <JsonLd
        data={[
          collectionPageLd({
            path: "/shop",
            name: "TraceCoreLab shop",
            description: "FPGA DMA cards, video fusers, USB input passthrough devices and accessories.",
            items: products.map((p) => ({ name: p.name, path: `/product/${p.slug}` })),
          }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop" }]),
        ]}
      />
      <PageHero
        kicker="The store"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
        lines={[
          "Shop the",
          <span key="b" className="text-gradient">
            lab.
          </span>,
        ]}
        description="FPGA DMA cards, video fusers, USB input passthrough devices and accessories. Every unit is tested before dispatch, shipped worldwide and backed by our team."
      />
      <section className="container-x pb-16">
        <div className="rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
          <TrustBadges />
          <PaymentLogos size="sm" label="Pay your way" className="mt-6 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between" />
        </div>
      </section>
      <SetupBuilder config={builder} products={products.filter((p) => builderSlugs.has(p.slug))} />
      <ShopClient products={products} categories={categories} />
    </>
  );
}
