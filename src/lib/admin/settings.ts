import "server-only";
import { eq } from "drizzle-orm";
import { getDb, settings } from "@/db";
import { resolveSettings, type StoreSettings } from "@/lib/settings";
import { storageDriver } from "@/lib/storage";

/** Row key of the store settings in the `settings` table (the storefront reads the same key). */
export const STORE_SETTINGS_KEY = "store";

/** Saved store settings merged over the defaults. Uncached so the editor always shows the latest save. */
export async function getStoreSettingsForEdit(): Promise<{ settings: StoreSettings; updatedAt: Date | null }> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1);
  return { settings: resolveSettings(row?.value), updatedAt: row?.updatedAt ?? null };
}

export interface SystemInfo {
  storageDriver: string;
  emailEnabled: boolean;
  orderAlertEmail: string | null;
}

/** Read-only environment summary for the System card. Reports whether secrets are set — never their values. */
export function getSystemInfo(): SystemInfo {
  return {
    storageDriver: storageDriver(),
    emailEnabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    orderAlertEmail: process.env.ORDER_ALERT_EMAIL || null,
  };
}
