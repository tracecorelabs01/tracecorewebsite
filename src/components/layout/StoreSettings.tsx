"use client";

import { createContext, use, type ReactNode } from "react";
import { defaultSettings, type StoreSettings } from "@/lib/settings-defaults";

const StoreSettingsContext = createContext<StoreSettings>(defaultSettings);

export function StoreSettingsProvider({ value, children }: { value: StoreSettings; children: ReactNode }) {
  return <StoreSettingsContext value={value}>{children}</StoreSettingsContext>;
}

/** Live store settings (announcement bar, shipping thresholds, links…) managed in /admin/settings. */
export function useStoreSettings() {
  return use(StoreSettingsContext);
}
