// Store settings editable from /admin/settings. Defaults come from site.ts and
// are used whenever no database is configured (or a key hasn't been saved yet).

import { z } from "zod";
import { defaultSettings, type StoreSettings } from "./settings-defaults";

export { defaultSettings, type StoreSettings };

export const storeSettingsSchema: z.ZodType<StoreSettings> = z.object({
  announcements: z.array(z.string().trim().min(1).max(140)).max(8),
  freeShippingThreshold: z.number().min(0).max(100000),
  flatShipping: z.number().min(0).max(10000),
  supportEmail: z.string().trim().max(191),
  links: z.object({
    discord: z.string().trim().max(300),
    x: z.string().trim().max(300),
    youtube: z.string().trim().max(300),
    tiktok: z.string().trim().max(300),
  }),
  stats: z
    .array(
      z.object({
        value: z.number(),
        suffix: z.string().max(8),
        label: z.string().trim().min(1).max(40),
        decimals: z.number().int().min(0).max(2).optional(),
      }),
    )
    .max(4),
  manualPayments: z.object({ paypal: z.boolean(), crypto: z.boolean() }),
  orderNote: z.string().trim().max(600),
  reservationHours: z.number().int().min(0).max(720),
  setupDiscountPercent: z.number().int().min(0).max(50),
});

/** Merge a stored (possibly partial or outdated) settings object over the defaults. */
export function resolveSettings(stored: unknown): StoreSettings {
  const merged = { ...defaultSettings, ...(stored && typeof stored === "object" ? stored : {}) };
  const parsed = storeSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaultSettings;
}
