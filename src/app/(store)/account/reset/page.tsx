import Link from "next/link";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/AccountForms";
import { PageHero } from "@/components/ui/PageHero";
import { isDbConfigured } from "@/db";
import { param } from "@/lib/admin/format";
import { isResetTokenLive } from "@/lib/auth/reset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
// Checks the emailed link on every request.
export const instant = false;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/account/reset">) {
  const token = param((await searchParams).token) ?? "";
  const live = isDbConfigured() && (await isResetTokenLive("customer", token));
  return (
    <>
      <PageHero
        kicker="Your account"
        crumbs={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "New password" }]}
        lines={[
          <span key="a">
            Choose a new <span className="text-gradient">password.</span>
          </span>,
        ]}
        description={live ? "Pick something you don't use anywhere else. You'll be signed in straight after." : undefined}
      />
      <section className="container-x pb-28">
        <div className="max-w-3xl rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
          {live ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="grid gap-4">
              <p className="text-muted">This link has expired or was already used. Links work once, for one hour.</p>
              <Link href="/account/forgot" className="text-fg underline-offset-4 hover:underline">
                Send me a new link
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
