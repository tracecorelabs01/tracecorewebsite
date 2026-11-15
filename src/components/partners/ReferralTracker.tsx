"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { referralPricing, trackReferral, type PartnerPricing } from "@/actions/partner";
import { useCart } from "@/lib/cart-store";
import { usePartnerPricing } from "@/lib/partner-pricing";

/**
 * A visit through a partner's link (?ref=CODE): remembers the partner and counts the click. The proxy has already
 * redirected to the address without the code and left it in a short-lived cookie; a code still in the address (no
 * proxy in front) is dropped here. Later visits load that partner's prices, so the shop, cart and checkout show them.
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
    const handedOver = /(?:^|; )tcl_ref_code=([^;]+)/.exec(document.cookie)?.[1];
    if (handedOver) document.cookie = "tcl_ref_code=; Max-Age=0; path=/";
    const ref = url.searchParams.get("ref") ?? handedOver;
    if (url.searchParams.has("ref")) {
      url.searchParams.delete("ref");
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }
    if (ref) {
      trackReferral(ref).then(apply, () => {});
    } else if (document.cookie.split("; ").some((c) => c.startsWith("tcl_partner="))) {
      referralPricing().then(apply, () => {});
    }
  }, [router, setPartner, reprice]);

  return null;
}
