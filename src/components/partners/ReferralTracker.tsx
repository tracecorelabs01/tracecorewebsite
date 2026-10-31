"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { referralPricing, trackReferral, type PartnerPricing } from "@/actions/partner";
import { useCart } from "@/lib/cart-store";
import { usePartnerPricing } from "@/lib/partner-pricing";

/**
 * A visit through a partner's link (?ref=CODE): remembers the partner and counts the click, then drops the
 * parameter from the address. Later visits load that partner's prices, so the shop, cart and checkout show them.
 */
export function ReferralTracker() {
  const router = useRouter();
  const setPartner = usePartnerPricing((s) => s.set);
  const reprice = useCart((s) => s.reprice);

  useEffect(() => {
    const apply = (p: PartnerPricing) => {
      setPartner(p);
      if (p) reprice(p.prices);
    };
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) {
      url.searchParams.delete("ref");
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
      trackReferral(ref).then(apply, () => {});
    } else if (document.cookie.split("; ").some((c) => c.startsWith("tcl_partner="))) {
      referralPricing().then(apply, () => {});
    }
  }, [router, setPartner, reprice]);

  return null;
}
