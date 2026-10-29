"use client";

import { createContext, use, type ReactNode } from "react";
import { defaultPublicSettings, type PublicSettings } from "@/lib/settings-defaults";

const StoreSettingsContext = createContext<PublicSettings>(defaultPublicSettings);

export function StoreSettingsProvider({ value, children }: { value: PublicSettings; children: ReactNode }) {
  return <StoreSettingsContext value={value}>{children}</StoreSettingsContext>;
}

/** Live store settings (announcement bar, shipping thresholds, links…) managed in /admin/settings. */
export function useStoreSettings() {
  return use(StoreSettingsContext);
}
