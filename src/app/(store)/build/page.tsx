import type { Metadata } from "next";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { PageHero } from "@/components/ui/PageHero";
import { getCatalog } from "@/lib/catalog/server";
import { SETUP_PRODUCT_SLUGS } from "@/lib/setup-builder";

export const metadata: Metadata = {
  title: "Setup Builder",
  description: "Answer five quick questions about your PC and display, and we'll put together the DMA card, fuser and controller that fit.",
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
        description="Tell us about your PC and display. We'll match the card, fuser and controller that fit, with a discount when you take the full setup."
      />
      <SetupBuilder products={products.filter((p) => SETUP_PRODUCT_SLUGS.has(p.slug))} />
    </>
  );
}
