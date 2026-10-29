// Store settings shape + defaults (no zod here so client components can import it cheaply).
// Values come from site.ts until edited in /admin/settings.

import { site } from "./site";

export interface StoreSettings {
  announcements: string[];
  freeShippingThreshold: number;
  flatShipping: number;
  supportEmail: string;
  links: { discord: string; x: string; youtube: string; tiktok: string };
  stats: { value: number; suffix: string; label: string; decimals?: number }[];
  /** Checkout methods paid by instructions after the order (cards go through Razorpay). Each one's logo shows only while it's on. */
  manualPayments: { paypal: boolean; crypto: boolean };
  /** Shown to customers after they place an order (e.g. how payment works). */
  orderNote: string;
  /** Hours an unpaid order holds its stock before it's cancelled and restocked. 0 = hold until staff act. */
  reservationHours: number;
  /** Percent off a cart holding a complete setup (DMA card + fuser + input device). 0 = off. */
  setupDiscountPercent: number;
}

export const defaultSettings: StoreSettings = {
  announcements: [...site.announcements],
  freeShippingThreshold: site.freeShippingThreshold,
  flatShipping: site.flatShipping,
  supportEmail: site.email,
  links: { ...site.links },
  stats: site.stats.map((s) => ({ ...s })),
  // Off until switched on in Settings: cards through Razorpay are the store's payment method.
  manualPayments: { paypal: false, crypto: false },
  orderNote: "Thanks for your order! We'll email you payment instructions and a confirmation shortly. Questions? Reply to that email or message us on Discord.",
  reservationHours: 48,
  setupDiscountPercent: 10,
};

/** What the storefront receives: the settings plus the payment logos to show, worked out on the server from what's set up. */
export interface PublicSettings extends StoreSettings {
  /** Logo keys: "razorpay", the card networks enabled in Razorpay, "paypal", "crypto". */
  payments: string[];
}

export const defaultPublicSettings: PublicSettings = { ...defaultSettings, payments: [] };
