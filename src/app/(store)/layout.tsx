import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/StoreShell";
import { getPublicSettings, getShopMenu } from "@/lib/catalog/server";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, menu] = await Promise.all([getPublicSettings(), getShopMenu()]);
  return (
    <StoreShell settings={settings} menu={menu}>
      {children}
    </StoreShell>
  );
}
