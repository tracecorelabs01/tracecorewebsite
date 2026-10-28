import type { ReactNode } from "react";
import { money } from "@/lib/admin/format";

type Totals = { subtotalCents: number; discountCents: number; discountCode: string | null; shippingCents: number; totalCents: number; currency: string };

export function OrderTotals({ order }: { order: Totals }) {
  const m = (cents: number) => money(cents, order.currency);
  return (
    <dl className="space-y-2.5 text-sm">
      <Row label="Subtotal">{m(order.subtotalCents)}</Row>
      {order.discountCents > 0 || order.discountCode ? (
        <Row
          label={
            <>
              Discount
              {order.discountCode && <span className="ml-2 rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-muted">{order.discountCode}</span>}
            </>
          }
        >
          −{m(order.discountCents)}
        </Row>
      ) : null}
      <Row label="Shipping">{order.shippingCents ? m(order.shippingCents) : "Free"}</Row>
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <dt className="font-medium text-fg">Total</dt>
        <dd className="font-mono text-base font-semibold tabular-nums text-fg">{m(order.totalCents)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-dim">{label}</dt>
      <dd className="tabular-nums text-fg/90">{children}</dd>
    </div>
  );
}
