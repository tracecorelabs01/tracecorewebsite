import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { isDbConfigured } from "@/db";
import { isRazorpayConfigured } from "@/lib/razorpay";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <>
      <PageHero
        kicker="Secure checkout"
        crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: "Checkout" }]}
        lines={[
          <span key="a">
            Almost <span className="text-gradient">yours.</span>
          </span>,
        ]}
      />
      <CheckoutClient demo={!isDbConfigured()} cardOnline={isDbConfigured() && isRazorpayConfigured()} />
    </>
  );
}
