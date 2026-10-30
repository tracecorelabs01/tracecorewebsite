import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/AccountForms";
import { ButtonLink } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";
import { accountPath, getCurrentCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const [me, sp] = await Promise.all([getCurrentCustomer(), searchParams]);
  if (me) redirect(accountPath(param(sp.next)));

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
              <LoginForm email={param(sp.email)} next={param(sp.next)} />
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-ink-900/30 p-6 md:p-8">
            <h2 className="font-display text-3xl uppercase">No password needed</h2>
            <p className="mt-3 text-muted">
              Your account opens on its own with your first paid order. To sign in, enter the email you ordered with and we&apos;ll send you a 6-digit code. Each code works once, for 10 minutes.
            </p>
            <ButtonLink href="/shop" variant="ghost" className="mt-6">
              Shop hardware
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
