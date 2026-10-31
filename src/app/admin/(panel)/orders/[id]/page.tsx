import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { saveOrderNote, updateOrderStatus, updatePayment, updateShipping } from "@/actions/admin/orders";
import { InternalNoteForm, PaymentForm, ShippingForm, StatusForm } from "@/components/admin/orders/OrderForms";
import { OrderTimeline } from "@/components/admin/orders/OrderTimeline";
import { OrderTotals } from "@/components/admin/orders/OrderTotals";
import { Card, DescriptionList, LinkButton, OrderStatusBadge, PageHeader, PaymentBadge, Table, Td, Th } from "@/components/admin/ui";
import { eq } from "drizzle-orm";
import { affiliateCommissions, affiliates, getDb, ORDER_STATUSES, PAYMENT_STATUSES } from "@/db";
import { dateTime, money } from "@/lib/admin/format";
import { addressLines, getOrder } from "@/lib/admin/orders";
import { hasRole, requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const user = await requireAdmin("staff");
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId)) notFound();
  const data = await getOrder(orderId);
  if (!data) notFound();
  const { order, items, events } = data;

  const canEditProducts = hasRole(user, "admin");
  const emailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const units = items.reduce((n, i) => n + i.quantity, 0);
  const restockUnits = items.reduce((n, i) => n + (i.trackInventory ? i.quantity : 0), 0);
  const m = (cents: number) => money(cents, order.currency);
  const milestones = (
    [
      ["Placed", order.createdAt],
      ["Paid", order.paidAt],
      ["Shipped", order.shippedAt],
      ["Delivered", order.deliveredAt],
      ["Cancelled", order.cancelledAt],
    ] as const
  )
    .filter(([, at]) => at)
    .map(([label, at]) => ({ label, value: dateTime(at) }));

  return (
    <>
      <PageHeader
        title={order.number}
        back={{ href: "/admin/orders", label: "Orders" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Placed {dateTime(order.createdAt)} · {units} item{units === 1 ? "" : "s"} · {m(order.totalCents)}
            <OrderStatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Items" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit price</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      {canEditProducts && i.productId != null ? (
                        <Link href={`/admin/products/${i.productId}`} className="font-medium text-fg hover:text-amber">
                          {i.productName}
                        </Link>
                      ) : (
                        <span className="font-medium text-fg">{i.productName}</span>
                      )}
                      {i.optionValue && <div className="text-xs text-muted">{i.optionValue}</div>}
                      {i.productId == null && <div className="text-xs text-dim">No longer in the catalogue</div>}
                    </Td>
                    <Td className="text-right tabular-nums">{i.quantity}</Td>
                    <Td className="text-right tabular-nums text-muted">{m(i.unitPriceCents)}</Td>
                    <Td className="text-right tabular-nums">{m(i.lineTotalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Totals">
              <OrderTotals order={order} />
            </Card>
            <Card
              title="Customer"
              actions={
                order.customerId != null && (
                  <LinkButton href={`/admin/customers/${order.customerId}`} variant="ghost" size="sm">
                    View profile
                  </LinkButton>
                )
              }
            >
              <div className="space-y-2 text-sm">
                <p className="font-medium text-fg">
                  {order.firstName} {order.lastName}
                </p>
                <a href={`mailto:${order.email}`} className="flex items-center gap-2 break-all text-muted transition-colors hover:text-amber">
                  <Mail className="size-3.5 shrink-0" /> {order.email}
                </a>
                {order.phone ? (
                  <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 text-muted transition-colors hover:text-amber">
                    <Phone className="size-3.5 shrink-0" /> {order.phone}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-dim">
                    <Phone className="size-3.5 shrink-0" /> No phone number
                  </p>
                )}
              </div>
            </Card>
            <Card title="Shipping address">
              <address className="text-sm not-italic leading-relaxed text-fg/90">
                {addressLines(order).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </address>
            </Card>
            {order.affiliateId && <ReferredBy orderId={order.id} affiliateId={order.affiliateId} source={order.affiliateSource} />}
            <Card title="Customer note">
              {order.customerNote ? (
                <p className="whitespace-pre-wrap break-words text-sm text-fg/90">{order.customerNote}</p>
              ) : (
                <p className="text-sm text-dim">The customer didn&apos;t leave a note.</p>
              )}
            </Card>
          </div>

          <Card title="Timeline" description="Newest first">
            <OrderTimeline events={events} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Status" actions={<OrderStatusBadge status={order.status} />}>
            <div className="mb-4">
              <DescriptionList items={milestones} />
            </div>
            <StatusForm
              action={updateOrderStatus.bind(null, order.id)}
              status={order.status}
              statuses={ORDER_STATUSES}
              restockUnits={restockUnits}
              restocked={events.some((e) => e.type === "restock")}
              emailEnabled={emailEnabled}
            />
          </Card>
          <Card title="Payment" description={`Method: ${order.paymentMethod}`} actions={<PaymentBadge status={order.paymentStatus} />}>
            <PaymentForm
              action={updatePayment.bind(null, order.id)}
              paymentStatus={order.paymentStatus}
              paymentRef={order.paymentRef}
              statuses={PAYMENT_STATUSES}
              canAdvance={order.status === "pending"}
            />
            {order.paymentRef?.startsWith("pay_") && (
              <a
                href={`https://dashboard.razorpay.com/app/payments/${encodeURIComponent(order.paymentRef)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-amber"
              >
                View payment in Razorpay <ExternalLink className="size-3.5" />
              </a>
            )}
          </Card>
          <Card title="Shipping" description="Tracking details for this order.">
            <ShippingForm
              action={updateShipping.bind(null, order.id)}
              carrier={order.trackingCarrier}
              trackingNumber={order.trackingNumber}
              canShip={order.status === "pending" || order.status === "processing"}
              emailEnabled={emailEnabled}
            />
          </Card>
          <Card title="Internal note" description="Only visible to staff.">
            <InternalNoteForm action={saveOrderNote.bind(null, order.id)} note={order.internalNote} />
          </Card>
        </div>
      </div>
    </>
  );
}

/** The partner who referred the order, and its commission. */
async function ReferredBy({ orderId, affiliateId, source }: { orderId: number; affiliateId: number; source: "link" | "code" | null }) {
  const db = getDb();
  const [[partner], [commission]] = await Promise.all([
    db.select({ name: affiliates.name, code: affiliates.code }).from(affiliates).where(eq(affiliates.id, affiliateId)).limit(1),
    db.select({ amountCents: affiliateCommissions.amountCents, status: affiliateCommissions.status }).from(affiliateCommissions).where(eq(affiliateCommissions.orderId, orderId)).limit(1),
  ]);
  if (!partner) return null;
  return (
    <Card title="Referred by">
      <p className="text-sm">
        <Link href={`/admin/affiliates/${affiliateId}`} className="text-fg hover:text-amber">
          {partner.name}
        </Link>{" "}
        <span className="text-dim">
          · {source === "code" ? "their code" : "their link"} ({partner.code})
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">{commission ? `Commission ${money(commission.amountCents)}, ${commission.status}` : "No commission yet: it's added once the order is paid."}</p>
    </Card>
  );
}
