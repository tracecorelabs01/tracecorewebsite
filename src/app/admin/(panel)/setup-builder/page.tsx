import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { saveSetupBuilder } from "@/actions/admin/setup-builder";
import { SetupBuilderEditor } from "@/components/admin/setup-builder/SetupBuilderEditor";
import { PageHeader, buttonClass } from "@/components/admin/ui";
import { dateTime } from "@/lib/admin/format";
import { listCategories } from "@/lib/admin/products";
import { getStoreSettingsForEdit } from "@/lib/admin/settings";
import { getSetupBuilderForEdit, listBuilderProducts } from "@/lib/admin/setup-builder";
import { requireAdmin } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/server";

export const metadata: Metadata = { title: "Setup builder" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function SetupBuilderPage() {
  await requireAdmin("admin");
  const [{ config, updatedAt }, { settings }, products, categories, { products: catalog }] = await Promise.all([
    getSetupBuilderForEdit(),
    getStoreSettingsForEdit(),
    listBuilderProducts(),
    listCategories(),
    getCatalog(),
  ]);

  return (
    <>
      <PageHeader
        title="Setup builder"
        description="The configurator at the top of the shop page: the bundle discount, every question and answer, and which products it recommends. Changes go live when you save."
        actions={
          <a href="/shop#build" target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            View on store <ExternalLink className="size-3.5" />
          </a>
        }
      />
      <SetupBuilderEditor
        action={saveSetupBuilder}
        config={config}
        percent={settings.setupDiscountPercent}
        products={products}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        catalog={catalog}
        settings={settings}
        lastSaved={updatedAt ? dateTime(updatedAt) : null}
      />
    </>
  );
}
