import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccountShell, Panel, StatusPills, shortDay } from "@/components/account/AccountShell";
import { getMyOrder } from "@/lib/account";
import { requireCustomer } from "@/lib/auth/customer";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

const usd = (cents: number) => formatPrice(cents / 100);

export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[number]">) {
  const me = await requireCustomer();
  const { number } = await params;
  const data = await getMyOrder(me.id, decodeURIComponent(number).toUpperCase());
  if (!data) notFound();
  const { order: o, items, points } = data;

  return (
    <AccountShell active="/account" title={<span className="font-mono">{o.number}</span>} description={`Placed ${shortDay(o.createdAt)}.`}>
      <Link href="/account" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All orders
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Items" action={<StatusPills status={o.status} paymentStatus={o.paymentStatus} />}>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p>{i.productName}</p>
                  <p className="text-xs text-dim">
                    {i.optionValue ? `${i.optionValue} · ` : ""}
                    {i.quantity} × {usd(i.unitPriceCents)}
                  </p>
                </div>
                <span className="font-mono text-sm">{usd(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{usd(o.subtotalCents)}</dd>
            </div>
            {o.discountCents > 0 && (
              <div className="flex justify-between text-ok">
                <dt>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</dt>
                <dd>−{usd(o.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd>{o.shippingCents ? usd(o.shippingCents) : "Free"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</dt>
              <dd className="font-display text-3xl">{usd(o.totalCents)}</dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel title="Delivery">
            <p className="text-sm leading-relaxed text-muted">
              {o.firstName} {o.lastName}
              <br />
              {o.address1}
              {o.address2 && (
                <>
                  <br />
                  {o.address2}
                </>
              )}
              <br />
              {[o.city, o.region, o.postalCode].filter(Boolean).join(", ")}
              <br />
              {o.country}
            </p>
            {o.trackingNumber && (
              <p className="mt-4 border-t border-line pt-4 text-sm">
                <span className="type-kicker text-dim">Tracking</span>
                <span className="mt-1 block font-mono">
                  {o.trackingCarrier ? `${o.trackingCarrier} · ` : ""}
                  {o.trackingNumber}
                </span>
              </p>
            )}
          </Panel>
          <Panel title="Points">
            <p className="text-sm text-muted">
              {points > 0
                ? `This order earned you ${points.toLocaleString("en-US")} points.`
                : o.paymentStatus === "paid"
                  ? "No points for this order."
                  : "Points are added once the order is paid."}
            </p>
          </Panel>
        </div>
      </div>
    </AccountShell>
  );
}
