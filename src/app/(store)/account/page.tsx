import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Package } from "lucide-react";
import { AccountShell, Panel, StatusPills, shortDay } from "@/components/account/AccountShell";
import { ButtonLink } from "@/components/ui/Button";
import { listMyOrders } from "@/lib/account";
import { param } from "@/lib/admin/format";
import { requireCustomer } from "@/lib/auth/customer";
import { getLoyaltyConfig, pointsBalance } from "@/lib/loyalty";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const me = await requireCustomer();
  const [orders, balance, loyalty, sp] = await Promise.all([listMyOrders(me.id), pointsBalance(me.id), getLoyaltyConfig(), searchParams]);

  return (
    <AccountShell
      active="/account"
      title={
        <span>
          Hi, <span className="text-gradient">{me.firstName || "there"}.</span>
        </span>
      }
      description="Your orders, loyalty points and reviews in one place."
    >
      {param(sp.welcome) && (
        <p className="mb-6 rounded-2xl border border-ok/30 bg-ok/10 px-5 py-4 text-sm text-ok">Your account is ready. Every paid order now earns points you can spend on rewards.</p>
      )}
      {param(sp.reset) && <p className="mb-6 rounded-2xl border border-ok/30 bg-ok/10 px-5 py-4 text-sm text-ok">Your password has been changed. Other devices have been signed out.</p>}

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Link href="/account/rewards" className="group rounded-3xl border border-line bg-ink-900/60 p-6 transition-colors hover:border-blaze/50">
          <p className="type-kicker text-dim">Loyalty points</p>
          <p className="mt-3 font-display text-5xl text-gradient">{balance.toLocaleString("en-US")}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            {loyalty.enabled ? `${loyalty.pointsPerDollar.toLocaleString("en-US")} points for every $1 you spend` : "Rewards are paused right now"}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </p>
        </Link>
        <div className="rounded-3xl border border-line bg-ink-900/60 p-6">
          <p className="type-kicker text-dim">Orders</p>
          <p className="mt-3 font-display text-5xl">{orders.length}</p>
          <p className="mt-2 text-sm text-muted">{orders.filter((o) => o.paymentStatus === "paid").length} paid</p>
        </div>
        <div className="rounded-3xl border border-line bg-ink-900/60 p-6">
          <p className="type-kicker text-dim">Signed in as</p>
          <p className="mt-3 break-all text-lg">{me.email}</p>
          <Link href="/account/password" className="mt-2 inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Change password
          </Link>
        </div>
      </div>

      <Panel title="Your orders">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Package className="size-8 text-dim" />
            <p className="text-muted">No orders yet.</p>
            <ButtonLink href="/shop" size="sm">
              Shop hardware
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.number}`} className="group flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm tracking-wider group-hover:text-amber">{o.number}</p>
                    <p className="mt-0.5 text-xs text-dim">
                      {shortDay(o.createdAt)} · {o.units} item{o.units === 1 ? "" : "s"}
                      {o.points > 0 && ` · +${o.points.toLocaleString("en-US")} points`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusPills status={o.status} paymentStatus={o.paymentStatus} />
                    <span className="w-24 text-right font-mono text-sm">{formatPrice(o.totalCents / 100)}</span>
                    <ArrowRight className="size-4 text-dim transition-transform group-hover:translate-x-1 group-hover:text-fg" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AccountShell>
  );
}
