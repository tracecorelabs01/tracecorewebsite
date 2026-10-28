import Link from "next/link";
import type { Metadata } from "next";
import { Download, Receipt } from "lucide-react";
import { Card, EmptyState, FilterTabs, LinkButton, OrderStatusBadge, PageHeader, Pagination, PaymentBadge, qs, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/db";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { isOrderStatus, isPaymentStatus, listOrders } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders" };
// Admin pages read the session and live data on every request.
export const instant = false;

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin("staff");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const rawStatus = param(sp.status);
  const rawPayment = param(sp.payment);
  const status = isOrderStatus(rawStatus) ? rawStatus : undefined;
  const payment = isPaymentStatus(rawPayment) ? rawPayment : undefined;
  const page = pageParam(sp.page);
  const { rows, total, pageCount, statusCounts, paymentCounts } = await listOrders({ q, status, payment, page });
  const filtered = Boolean(q || status || payment);

  const statusTab = (value?: string) => ({
    label: value ? label(value) : "All",
    href: `/admin/orders${qs({ status: value, payment, q })}`,
    active: status === value,
    count: statusCounts[value ?? "all"] ?? 0,
  });
  const paymentTab = (value?: string) => ({
    label: value ? label(value) : "Any payment",
    href: `/admin/orders${qs({ status, payment: value, q })}`,
    active: payment === value,
    count: paymentCounts[value ?? "all"] ?? 0,
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total.toLocaleString("en-US")} order${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`}
        actions={
          // `download` makes this a plain browser download rather than a client-side navigation.
          <LinkButton href="/api/admin/export/orders" variant="secondary" prefetch={false} download>
            <Download className="size-4" /> Export CSV
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterTabs items={[statusTab(), ...ORDER_STATUSES.map((s) => statusTab(s))]} />
          <SearchBox action="/admin/orders" defaultValue={q} placeholder="Order #, email or name" keep={{ status, payment }} />
        </div>
        <div className="flex">
          <FilterTabs items={[paymentTab(), ...PAYMENT_STATUSES.map((s) => paymentTab(s))]} />
        </div>
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title={filtered ? "No orders match these filters" : "No orders yet"}
            description={filtered ? "Try a different search or filter." : "Orders placed on the storefront will appear here."}
            action={
              filtered && (
                <LinkButton href="/admin/orders" variant="secondary">
                  Clear filters
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Items</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm text-fg hover:text-amber">
                        {o.number}
                      </Link>
                      <div className="text-xs text-dim">{shortDate(o.createdAt)}</div>
                    </Td>
                    <Td>
                      <div className="text-fg/90">
                        {o.firstName} {o.lastName}
                      </div>
                      <div className="text-xs text-dim">{o.email}</div>
                    </Td>
                    <Td className="tabular-nums text-muted">
                      {o.units} item{o.units === 1 ? "" : "s"}
                    </Td>
                    <Td>
                      <PaymentBadge status={o.paymentStatus} />
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{money(o.totalCents, o.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/orders${qs({ status, payment, q, page: n })}`} />
          </>
        )}
      </Card>
    </>
  );
}
