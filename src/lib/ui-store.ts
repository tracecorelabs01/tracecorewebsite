"use client";

import { create } from "zustand";

interface UiState {
  cartOpen: boolean;
  menuOpen: boolean;
  /** Whether page animations may play. True from the start: the homepage intro plays over an already-rendered page and never holds content back. */
  introDone: boolean;
  /** Incremented on every add-to-cart so the cart badge can play a bump animation. */
  cartPulse: number;
  hydrated: boolean;
  headerHidden: boolean;
  openCart: () => void;
  closeCart: () => void;
  setMenu: (open: boolean) => void;
  finishIntro: () => void;
  pulseCart: () => void;
  setHydrated: () => void;
  setHeaderHidden: (hidden: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  menuOpen: false,
  introDone: true,
  cartPulse: 0,
  hydrated: false,
  headerHidden: false,
  openCart: () => set({ cartOpen: true, menuOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  setMenu: (open) => set({ menuOpen: open }),
  finishIntro: () => set({ introDone: true }),
  pulseCart: () => set((s) => ({ cartPulse: s.cartPulse + 1 })),
  setHydrated: () => set({ hydrated: true }),
  setHeaderHidden: (hidden) => set((s) => (s.headerHidden === hidden ? s : { headerHidden: hidden })),
}));
