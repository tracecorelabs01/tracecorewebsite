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
  payments: string[];
  /** Shown to customers after they place an order (e.g. how payment works). */
  orderNote: string;
  /** Hours an unpaid order holds its stock before it's cancelled and restocked. 0 = hold until staff act. */
  reservationHours: number;
}

export const defaultSettings: StoreSettings = {
  announcements: [...site.announcements],
  freeShippingThreshold: site.freeShippingThreshold,
  flatShipping: site.flatShipping,
  supportEmail: site.email,
  links: { ...site.links },
  stats: site.stats.map((s) => ({ ...s })),
  payments: [...site.payments],
  orderNote: "Thanks for your order! We'll email you payment instructions and a confirmation shortly. Questions? Reply to that email or message us on Discord.",
  reservationHours: 48,
};
