"use client";

import { useCallback, useMemo } from "react";
import { create } from "zustand";
import type { PartnerPricing } from "@/actions/partner";

// The prices of the partner who referred this visitor (their link or code), for display. The server prices every
// order itself (src/actions/store.ts), so these only keep the shop, cart and checkout showing the same numbers.

export const usePartnerPricing = create<{ partner: PartnerPricing; set: (partner: PartnerPricing) => void }>((set) => ({
  partner: null,
  set: (partner) => set({ partner }),
}));

/** What this visitor pays for a product: the partner price if there is one, with the regular price struck out. */
export function usePrice(product: { slug: string; price: number; compareAt?: number }) {
  const partnerPrice = usePartnerPricing((s) => s.partner?.prices[product.slug]);
  if (partnerPrice == null) return { price: product.price, compareAt: product.compareAt };
  return { price: partnerPrice, compareAt: partnerPrice < product.price ? product.price : undefined };
}

/** A function giving each product's price for this visitor, for lists and totals. */
export function usePriceOf() {
  const prices = usePartnerPricing((s) => s.partner?.prices);
  return useCallback((product: { slug: string; price: number }) => prices?.[product.slug] ?? product.price, [prices]);
}

/** The products at this visitor's prices, for components that add prices up (the Setup Builder). */
export function usePartnerProducts<T extends { slug: string; price: number; compareAt?: number }>(products: T[]): T[] {
  const prices = usePartnerPricing((s) => s.partner?.prices);
  return useMemo(
    () => (prices ? products.map((p) => (prices[p.slug] != null ? { ...p, price: prices[p.slug], compareAt: prices[p.slug] < p.price ? p.price : undefined } : p)) : products),
    [products, prices],
  );
}

export const partnerPriceNow = (slug: string) => usePartnerPricing.getState().partner?.prices[slug];
