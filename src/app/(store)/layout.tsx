import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/StoreShell";
import { getPublicSettings } from "@/lib/catalog/server";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  return <StoreShell settings={settings}>{children}</StoreShell>;
}
