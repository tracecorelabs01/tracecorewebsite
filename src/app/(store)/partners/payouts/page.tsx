import type { Metadata } from "next";
import { AccountShell, Panel, PARTNER_TABS, Pill, shortDay } from "@/components/account/AccountShell";
import { CopyText, PayoutButtons, PayoutEmailForm } from "@/components/partners/PartnerForms";
import { PAYOUT_METHOD, PAYOUT_STATUS } from "@/lib/affiliate-labels";
import { getProgram, partnerBalance, partnerPayouts, requirePartner } from "@/lib/affiliates";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Partner payouts", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

const usd = (cents: number) => formatPrice(cents / 100);

export default async function PartnerPayoutsPage() {
  const { partner } = await requirePartner();
  const [program, balance, payouts] = await Promise.all([getProgram(), partnerBalance(partner.id), partnerPayouts(partner.id)]);

  return (
    <AccountShell
      tabs={PARTNER_TABS}
      kicker="Partner portal"
      active="/partners/payouts"
      title={<span>Your <span className="text-gradient">payouts.</span></span>}
      description={`Commissions become available ${program.holdDays} day${program.holdDays === 1 ? "" : "s"} after the order is delivered. Take them as store credit straight away, or by PayPal from ${usd(program.minPayoutCents)}.`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-4">
          <div className="rounded-3xl border border-blaze/40 bg-[radial-gradient(circle_at_100%_0%,rgb(255_61_0/0.18),transparent_60%)] p-7">
            <p className="type-kicker text-dim">Available</p>
            <p className="mt-3 font-display text-6xl text-gradient">{usd(balance.availableCents)}</p>
            <p className="mt-1 text-sm text-muted">
              {usd(balance.pendingCents)} pending{balance.requestedCents > 0 ? ` · ${usd(balance.requestedCents)} in a PayPal payout` : ""}
            </p>
            <div className="mt-6">
              <PayoutButtons availableCents={balance.availableCents} minPayoutCents={program.minPayoutCents} hasPaypal={Boolean(partner.paypalEmail)} />
            </div>
          </div>
          <Panel title="PayPal">
            <PayoutEmailForm email={partner.paypalEmail} />
          </Panel>
        </div>
        <Panel title="History">
          {payouts.length === 0 ? (
            <p className="text-muted">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {PAYOUT_METHOD[p.method]} · <span className="font-mono">{usd(p.amountCents)}</span>
                    </p>
                    <p className="text-xs text-dim">
                      {shortDay(p.createdAt)}
                      {p.method === "paypal" && p.paypalEmail ? ` · to ${p.paypalEmail}` : ""}
                      {p.status === "rejected" && p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.method === "store_credit" && p.reference && <CopyText text={p.reference} />}
                    {p.method === "paypal" && p.status === "paid" && p.reference && <span className="font-mono text-xs text-dim">{p.reference}</span>}
                    <Pill tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AccountShell>
  );
}
