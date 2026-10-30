import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { isDbConfigured } from "@/db";
import { getCheckoutDetails } from "@/lib/account";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { enabledProviders } from "@/lib/auth/oauth";
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
      <Suspense fallback={<div className="container-x min-h-[60vh] pb-32" />}>
        <Checkout />
      </Suspense>
    </>
  );
}

/** Reads the session to fill in a signed-in customer's details, so it streams in after the static hero. */
async function Checkout() {
  const customer = await getCurrentCustomer();
  const details = customer ? await getCheckoutDetails(customer.id) : null;
  return <CheckoutClient demo={!isDbConfigured()} cardOnline={isDbConfigured() && isRazorpayConfigured()} details={details} providers={enabledProviders()} />;
}
