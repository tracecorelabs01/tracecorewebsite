"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product, ProductVisual } from "@/lib/catalog/types";

export interface CartLine {
  key: string;
  slug: string;
  name: string;
  option?: string;
  /** Display price only — the server re-prices every line at checkout. */
  price: number;
  qty: number;
  visual: ProductVisual;
  /** Stock cap at the time of adding (undefined = no limit). */
  maxQty?: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, qty?: number, option?: string) => boolean;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const cap = (qty: number, max?: number) => Math.max(1, Math.min(99, max ?? 99, qty));

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (product, qty = 1, option) => {
        if (product.status === "sold-out" || product.maxQty === 0) return false;
        const key = option ? `${product.slug}:${option}` : product.slug;
        const existing = get().lines.find((l) => l.key === key);
        if (existing) {
          set({ lines: get().lines.map((l) => (l.key === key ? { ...l, maxQty: product.maxQty, qty: cap(l.qty + qty, product.maxQty) } : l)) });
        } else {
          set({
            lines: [
              ...get().lines,
              { key, slug: product.slug, name: product.name, option, price: product.price, qty: cap(qty, product.maxQty), visual: product.visual, maxQty: product.maxQty },
            ],
          });
        }
        return true;
      },
      setQty: (key, qty) => set((state) => ({ lines: state.lines.map((l) => (l.key === key ? { ...l, qty: cap(qty, l.maxQty) } : l)) })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "tracecore-cart",
      version: 1,
      // v0 lines had no visual; start fresh rather than render broken thumbnails.
      migrate: () => ({ lines: [] }),
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const selectCount = (s: CartState) => s.lines.reduce((n, l) => n + l.qty, 0);
export const selectSubtotal = (s: CartState) => s.lines.reduce((n, l) => n + l.qty * l.price, 0);
