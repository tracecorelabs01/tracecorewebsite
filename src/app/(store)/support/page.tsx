import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getStoreSettings } from "@/lib/catalog/server";
import { contactPageLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/ui/PageHero";
import { SupportContent } from "@/components/support/ContactForm";

export const metadata: Metadata = pageMetadata({
  title: "Support: Order Help, Hardware Setup and Warranty Claims",
  description: "Contact the TraceCoreLab team about orders, DMA card, video fuser or USB passthrough setup, and warranty claims, on Discord or by email.",
  path: "/support",
});

export default async function SupportPage() {
  const settings = await getStoreSettings();
  return (
    <>
      <JsonLd data={contactPageLd({ path: "/support", name: "TraceCoreLab support", description: "Order help, hardware setup and warranty claims.", settings })} />
      <PageHero
        kicker="Support"
        crumbs={[{ label: "Home", href: "/" }, { label: "Support" }]}
        lines={[
          "We've got",
          <span key="b" className="text-gradient">
            your back.
          </span>,
        ]}
        description="Order questions, setup help or a warranty claim: pick the channel that suits you."
      />
      <SupportContent />
    </>
  );
}
