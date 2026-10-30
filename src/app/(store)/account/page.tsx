import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Package } from "lucide-react";
import { AccountShell, Panel, StatusPills, shortDay } from "@/components/account/AccountShell";
import { ButtonLink } from "@/components/ui/Button";
import { param } from "@/lib/admin/format";
import { getLinkedAccounts, listMyOrders } from "@/lib/account";
import { requireCustomer } from "@/lib/auth/customer";
import { oauthEnabled } from "@/lib/auth/oauth";
import { getLoyaltyConfig, pointsBalance } from "@/lib/loyalty";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

// How connecting Discord went (/api/auth/discord/callback sends people back here).
const NOTICES: Record<string, { ok: boolean; text: string }> = {
  discord: { ok: true, text: "Discord connected. Use /myorders in our Discord server to see your orders." },
  taken: { ok: false, text: "That Discord account is already linked to another TraceCore Lab account." },
  oauth: { ok: false, text: "Connecting Discord didn't work. Please try again." },
  cancelled: { ok: false, text: "Connecting Discord was cancelled." },
  unverified: { ok: false, text: "That Discord account's email isn't verified yet. Verify it in Discord, then try again." },
};

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const me = await requireCustomer();
  const [orders, balance, loyalty, linked, sp] = await Promise.all([listMyOrders(me.id), pointsBalance(me.id), getLoyaltyConfig(), getLinkedAccounts(me.id), searchParams]);
  const notice = NOTICES[param(sp.linked) ?? param(sp.error) ?? ""];

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
          <p className="mt-2 text-sm text-muted">
            You sign in with a code we email here{linked.google && ", or with Google"}
            {linked.discord && ", or with Discord"}.
          </p>
        </div>
      </div>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "mb-6 text-sm text-ok" : "mb-6 text-sm text-[#ff6b5e]"}>
          {notice.text}
        </p>
      )}

      {(linked.discord || oauthEnabled("discord")) && (
        <Panel title="Discord" className="mb-8">
          {linked.discord ? (
            <p className="text-sm text-muted">
              Connected as <span className="text-fg">{linked.discord}</span>. In our Discord server, <span className="font-mono text-fg">/myorders</span> shows you your orders, privately, with no order number or email needed.
            </p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Connect Discord to see your orders in our Discord server with <span className="font-mono text-fg">/myorders</span>. Only you can see them.
              </p>
              {/* A plain link: a prefetching Link would start the sign-in on its own. */}
              <a
                href="/api/auth/discord/start?link=1&next=/account"
                className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-ink-900 px-5 text-sm font-medium transition-colors hover:border-blaze"
              >
                Connect Discord
              </a>
            </div>
          )}
        </Panel>
      )}

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
