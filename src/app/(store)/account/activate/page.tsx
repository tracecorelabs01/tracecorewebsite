import Link from "next/link";
import type { Metadata } from "next";
import { OpenAccountForm } from "@/components/account/AccountForms";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Open your account", robots: { index: false } };
// Reads the search params (prefilled email and order) on every request.
export const instant = false;

export default async function ActivatePage({ searchParams }: PageProps<"/account/activate">) {
  const sp = await searchParams;
  return (
    <>
      <PageHero
        kicker="Your account"
        crumbs={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Open account" }]}
        lines={[
          <span key="a">
            Open your <span className="text-gradient">account.</span>
          </span>,
        ]}
        description="Accounts open after your first paid order. Enter the email and order number from your order confirmation, then choose a password. Forgot your password? Do the same to set a new one."
      />
      <section className="container-x pb-28">
        <div className="max-w-3xl rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
          <OpenAccountForm email={param(sp.email)} order={param(sp.order)} />
        </div>
        <p className="mt-6 text-sm text-muted">
          Already set a password?{" "}
          <Link href="/account/login" className="text-fg underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </section>
    </>
  );
}
