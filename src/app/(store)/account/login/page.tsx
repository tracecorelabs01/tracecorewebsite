import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/AccountForms";
import { SocialSignIn } from "@/components/account/SocialSignIn";
import { ButtonLink } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";
import { accountPath, getCurrentCustomer } from "@/lib/auth/customer";
import { enabledProviders } from "@/lib/auth/oauth";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

// Why a Discord or Google sign-in came back without signing in (/api/auth/[provider]/callback).
const ERRORS: Record<string, string> = {
  oauth: "That sign-in didn't work. Please try again, or use your email.",
  cancelled: "Sign-in was cancelled.",
  unverified: "That account's email isn't verified yet. Verify it with Discord or Google first, or use your email.",
};

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const [me, sp] = await Promise.all([getCurrentCustomer(), searchParams]);
  const next = accountPath(param(sp.next));
  if (me) redirect(next);
  const providers = enabledProviders();
  const error = ERRORS[param(sp.error) ?? ""];

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
            {error && (
              <p role="alert" className="mt-2 text-sm text-[#ff6b5e]">
                {error}
              </p>
            )}
            {providers.length > 0 && (
              <>
                <SocialSignIn providers={providers} next={next} className="mt-6" />
                <p className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-dim before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                  or use your email
                </p>
              </>
            )}
            <div className="mt-6">
              <LoginForm email={param(sp.email)} next={param(sp.next)} />
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-ink-900/30 p-6 md:p-8">
            <h2 className="font-display text-3xl uppercase">No password needed</h2>
            <p className="mt-3 text-muted">
              {providers.length > 0 && "Sign in with Google or Discord, or with your email: "}
              {providers.length > 0 ? "we" : "Enter your email and we"}&apos;ll send you a 6-digit code that works once, for 10 minutes.
            </p>
            <p className="mt-3 text-muted">
              New here? {providers.length > 0 && "Signing in with Google or Discord creates your account, or "}
              {providers.length > 0 ? "choose" : "Choose"} <span className="text-fg">Create an account</span> at checkout. Ordered as a guest?{" "}
              <Link href="/track" className="text-fg underline-offset-4 hover:underline">
                Track your order
              </Link>{" "}
              with a code instead.
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
