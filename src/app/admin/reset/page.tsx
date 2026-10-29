import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminResetForm } from "@/components/admin/ResetForms";
import { isDbConfigured } from "@/db";
import { isResetTokenLive } from "@/lib/auth/reset";

export const metadata: Metadata = { title: "New password" };
export const instant = false;

export default function AdminResetPage({ searchParams }: PageProps<"/admin/reset">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ResetGate searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetGate({ searchParams }: Pick<PageProps<"/admin/reset">, "searchParams">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  return <AdminResetForm token={value} live={isDbConfigured() && (await isResetTokenLive("admin", value))} />;
}
