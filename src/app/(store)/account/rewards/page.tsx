import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { CopyCode, RedeemButton } from "@/components/account/AccountForms";
import { AccountShell, Panel, Pill, shortDay } from "@/components/account/AccountShell";
import { listActiveOffers, listMyCodes, listMyPoints } from "@/lib/account";
import { requireCustomer } from "@/lib/auth/customer";
import { getLoyaltyConfig, pointsBalance, rewardLabel } from "@/lib/loyalty";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rewards", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

const KIND_LABEL = { order: "Order", redeem: "Reward", adjust: "Adjustment" } as const;

export default async function RewardsPage() {
  const me = await requireCustomer();
  const [balance, loyalty, offers, codes, history] = await Promise.all([pointsBalance(me.id), getLoyaltyConfig(), listActiveOffers(), listMyCodes(me.id), listMyPoints(me.id)]);
  const unused = codes.filter((c) => c.isActive && (c.maxUses == null || c.usedCount < c.maxUses));

  return (
    <AccountShell
      active="/account/rewards"
      title={
        <span>
          Your <span className="text-gradient">rewards.</span>
        </span>
      }
      description={loyalty.enabled ? `Earn ${loyalty.pointsPerDollar.toLocaleString("en-US")} points for every $1 you spend, then swap them for discounts.` : "Rewards are paused right now. Your points are safe."}
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-blaze/40 bg-[radial-gradient(circle_at_100%_0%,rgb(255_61_0/0.18),transparent_60%)] p-7">
            <p className="type-kicker text-dim">Your balance</p>
            <p className="mt-3 font-display text-6xl text-gradient">{balance.toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-muted">points</p>
          </div>
          {unused.length > 0 && (
            <Panel title="Codes to use">
              <ul className="space-y-3">
                {unused.map((c) => (
                  <li key={c.code} className="flex flex-col gap-1.5">
                    <CopyCode code={c.code} />
                    <span className="text-xs text-dim">{rewardLabel(c)} · enter it at checkout, works once</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel title="Spend your points">
          {offers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Gift className="size-8 text-dim" />
              <p className="text-muted">No rewards to choose from right now. Keep collecting points, new offers are added regularly.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {offers.map((o) => {
                const short = Math.max(0, o.pointsCost - balance);
                return (
                  <li key={o.id} className={cn("flex flex-col gap-4 rounded-2xl border p-5", short ? "border-line" : "border-blaze/50 bg-blaze/[0.04]")}>
                    <div className="flex-1">
                      <p className="font-display text-2xl uppercase">{o.title}</p>
                      <p className="mt-1 text-sm text-muted">{o.description || rewardLabel(o)}</p>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <p className="font-mono text-sm">
                        {o.pointsCost.toLocaleString("en-US")} <span className="text-dim">points</span>
                      </p>
                      {loyalty.enabled ? <RedeemButton offerId={o.id} short={short} /> : <Pill tone="dim">Paused</Pill>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Points history" className="mt-4">
        {history.length === 0 ? (
          <p className="text-sm text-muted">Points appear here once an order is paid.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p>{h.note || KIND_LABEL[h.kind]}</p>
                  <p className="text-xs text-dim">
                    {KIND_LABEL[h.kind]} · {shortDay(h.createdAt)}
                  </p>
                </div>
                <span className={cn("font-mono", h.points > 0 ? "text-ok" : "text-muted")}>
                  {h.points > 0 ? "+" : "−"}
                  {Math.abs(h.points).toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AccountShell>
  );
}
