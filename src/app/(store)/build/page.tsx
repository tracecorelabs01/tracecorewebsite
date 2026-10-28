import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { PageHero } from "@/components/ui/PageHero";
import { getCatalog } from "@/lib/catalog/server";
import { SETUP_PRODUCT_SLUGS } from "@/lib/setup-builder";

export const metadata: Metadata = {
  title: "Setup Builder",
  description: "Answer four quick questions and we'll put together a complete DMA setup that fits your budget and your monitor.",
};

export default async function BuildPage() {
  const { products } = await getCatalog();
  return (
    <>
      <PageHero
        kicker="Setup builder"
        crumbs={[{ label: "Home", href: "/" }, { label: "Setup Builder" }]}
        lines={[
          "Build your",
          <span key="b" className="text-gradient">
            setup.
          </span>,
        ]}
        description="Not sure what you need? Answer four quick questions and we'll put together the right setup for you, with a discount when you take the whole thing."
      />
      <SetupBuilder products={products.filter((p) => SETUP_PRODUCT_SLUGS.has(p.slug))} />
    </>
  );
}
