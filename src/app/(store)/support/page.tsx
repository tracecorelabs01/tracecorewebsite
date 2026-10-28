import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { SupportContent } from "@/components/support/ContactForm";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with orders, setup and warranty from the TraceCoreLab team.",
};

export default function SupportPage() {
  return (
    <>
      <PageHero
        kicker="Support"
        crumbs={[{ label: "Home", href: "/" }, { label: "Support" }]}
        lines={[
          "We've got",
          <span key="b" className="text-gradient">
            your back.
          </span>,
        ]}
        description="Order questions, setup help or a warranty claim — pick the channel that suits you."
      />
      <SupportContent />
    </>
  );
}
