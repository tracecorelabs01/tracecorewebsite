import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { FaqBrowser } from "@/components/support/FaqBrowser";
import { SupportCta } from "@/components/support/SupportCta";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about ordering, shipping, setup, warranty and support at TraceCoreLab.",
};

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
