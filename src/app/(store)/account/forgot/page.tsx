import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account/AccountForms";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };
// Reads the search params (prefilled email) on every request.
export const instant = false;

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/account/forgot">) {
  const sp = await searchParams;
  return (
    <>
      <PageHero
        kicker="Your account"
        crumbs={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Forgot password" }]}
        lines={[
          <span key="a">
            Forgot your <span className="text-gradient">password?</span>
          </span>,
        ]}
        description="Enter the email you ordered with and we'll send you a link to choose a new one. Ordered before but never set a password? The same link opens your account."
      />
      <section className="container-x pb-28">
        <div className="max-w-xl rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
          <ForgotPasswordForm email={param(sp.email)} />
        </div>
        <p className="mt-6 text-sm text-muted">
          Remembered it?{" "}
          <Link href="/account/login" className="text-fg underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </section>
    </>
  );
}
