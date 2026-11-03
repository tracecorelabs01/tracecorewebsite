import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/ui/PageHero";
import { FaqBrowser } from "@/components/support/FaqBrowser";
import { SupportCta } from "@/components/support/SupportCta";

export const metadata: Metadata = pageMetadata({
  title: "FAQ: Orders, Shipping, Hardware Setup and Warranty",
  description: "Answers about ordering, worldwide shipping, DMA card, video fuser and USB passthrough setup, the 3-month warranty and support at TraceCoreLab.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHero
        kicker="Help centre"
        crumbs={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
        lines={[
          "Questions,",
          <span key="b" className="text-gradient">
            answered.
          </span>,
        ]}
        description="Everything about orders, shipping, setup and warranty. Still stuck? 24/7 support is one message away."
      />
      <FaqBrowser />
      <SupportCta />
    </>
  );
}
