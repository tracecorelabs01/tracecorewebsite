import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/AccountForms";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";
import { getCurrentCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const [me, sp] = await Promise.all([getCurrentCustomer(), searchParams]);
  if (me) redirect("/account");

  return (
    <>
      <PageHero
        kicker="Your account"
        crumbs={[{ label: "Home", href: "/" }, { label: "Account" }]}
        lines={[
          <span key="a">
            Welcome <span className="text-gradient">back.</span>
          </span>,
        ]}
        description="Track your orders, collect loyalty points and review what you bought."
      />
      <section className="container-x pb-28">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
            <h2 className="font-display text-3xl uppercase">Log in</h2>
            {param(sp.out) && <p className="mt-2 text-sm text-muted">You&apos;re logged out.</p>}
            <div className="mt-6">
              <LoginForm next={param(sp.next)} />
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-ink-900/30 p-6 md:p-8">
            <h2 className="font-display text-3xl uppercase">First time here?</h2>
            <p className="mt-3 text-muted">
              Your account opens after your first paid order. Use the email and order number from your order confirmation to set a password. Forgot your password? The same
              form sets a new one.
            </p>
            <Link
              href="/account/activate"
              className="mt-6 inline-flex h-12 items-center bg-line-strong px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors clip-slant [--slant:13px] hover:bg-ink-700"
            >
              Open my account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
