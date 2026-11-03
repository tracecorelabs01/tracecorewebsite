import type { Metadata } from "next";
import { saveGuideAction } from "@/actions/admin/guides";
import { GuideForm } from "@/components/admin/guides/GuideForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { getCatalog, getTokenContext } from "@/lib/catalog/server";

export const metadata: Metadata = { title: "New guide" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function NewGuidePage() {
  await requireAdmin("admin");
  const [{ products }, { settings }] = await Promise.all([getCatalog(), getTokenContext()]);
  return (
    <>
      <PageHeader title="New guide" description="Saved as a draft until you set the status to Published." back={{ href: "/admin/guides", label: "Guides" }} />
      <GuideForm
        action={saveGuideAction.bind(null, null)}
        products={products.map(({ slug, name, category, price, status }) => ({ slug, name, category, price, status }))}
        settings={{ freeShippingThreshold: settings.freeShippingThreshold, flatShipping: settings.flatShipping, supportEmail: settings.supportEmail }}
      />
    </>
  );
}
