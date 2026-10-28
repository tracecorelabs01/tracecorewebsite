import type { Metadata } from "next";
import { saveSettings } from "@/actions/admin/settings";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { SystemCard } from "@/components/admin/settings/SystemCard";
import { PageHeader } from "@/components/admin/ui";
import { dateTime } from "@/lib/admin/format";
import { getStoreSettingsForEdit, getSystemInfo } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function SettingsPage() {
  await requireAdmin("admin");
  const { settings, updatedAt } = await getStoreSettingsForEdit();

  return (
    <>
      <PageHeader title="Settings" description="Storefront content, shipping rules and links. Everything here goes live on the store as soon as you save." />
      <SettingsForm action={saveSettings} settings={settings} lastSaved={updatedAt ? dateTime(updatedAt) : null} aside={<SystemCard info={getSystemInfo()} />} />
    </>
  );
}
