import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/StoreShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSettings, getShopMenu, getStoreSettings } from "@/lib/catalog/server";
import { organizationLd, websiteLd } from "@/lib/jsonld";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, menu, store] = await Promise.all([getPublicSettings(), getShopMenu(), getStoreSettings()]);
  return (
    <StoreShell settings={settings} menu={menu}>
      {/* The store and the site, on every page: other pages' JSON-LD points at these by @id. */}
      <JsonLd data={[organizationLd(store), websiteLd()]} />
      {children}
    </StoreShell>
  );
}
