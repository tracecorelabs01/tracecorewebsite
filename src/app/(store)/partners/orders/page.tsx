import type { Metadata } from "next";
import { AccountShell, Panel, PARTNER_TABS, Pill, shortDay } from "@/components/account/AccountShell";
import { COMMISSION_STATUS } from "@/lib/affiliate-labels";
import { partnerCommissions, requirePartner } from "@/lib/affiliates";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Partner orders", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function PartnerOrdersPage() {
  const { partner } = await requirePartner();
  const rows = await partnerCommissions(partner.id, 200);

  return (
    <AccountShell
      tabs={PARTNER_TABS}
      kicker="Partner portal"
      active="/partners/orders"
      title={<span>Your <span className="text-gradient">orders.</span></span>}
      description="Orders placed through your link or code, and what each one earned. Pending commissions are approved after delivery and the hold period."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-muted">No orders yet. They show up here as soon as someone you referred pays.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
                  <th className="py-3 pr-4 font-normal">Date</th>
                  <th className="py-3 pr-4 font-normal">Order</th>
                  <th className="py-3 pr-4 font-normal">Products</th>
                  <th className="py-3 pr-4 font-normal">Via</th>
                  <th className="py-3 pr-4 font-normal">Status</th>
                  <th className="py-3 text-right font-normal">Commission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line/70 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-muted">{shortDay(c.createdAt)}</td>
                    <td className="py-3 pr-4 font-mono">{c.orderNumber ?? "Adjustment"}</td>
                    <td className="py-3 pr-4 text-muted">{c.kind === "order" ? (c.lines ?? []).map((l) => `${l.qty} × ${l.name}`).join(", ") : c.note}</td>
                    <td className="py-3 pr-4 text-muted">{c.source === "code" ? "Code" : c.source === "link" ? "Link" : ""}</td>
                    <td className="py-3 pr-4">
                      <Pill tone={COMMISSION_STATUS[c.status].tone}>{COMMISSION_STATUS[c.status].label}</Pill>
                    </td>
                    <td className="py-3 text-right font-mono">{formatPrice(c.amountCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AccountShell>
  );
}
