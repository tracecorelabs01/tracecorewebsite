import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign, Inbox, PackageCheck, Receipt, ShoppingBag, Star, Wallet } from "lucide-react";
import { Card, EmptyState, LinkButton, OrderStatusBadge, PageHeader, PaymentBadge, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { delta, getDashboard } from "@/lib/admin/dashboard";
import { money, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin();
  const [d, { denied }] = await Promise.all([getDashboard(), searchParams]);
  const revDelta = delta(d.revenue, d.revenuePrev);
  const ordDelta = delta(d.orders, d.ordersPrev);
  const topMax = Math.max(1, ...d.top.map((t) => t.cents));

  const attention = [
    { label: "Paid orders to fulfil", n: d.toFulfil, href: "/admin/orders?status=processing", icon: PackageCheck },
    { label: "Orders awaiting payment", n: d.awaitingPayment, href: "/admin/orders?status=pending&payment=unpaid", icon: Wallet },
    { label: "Open messages", n: d.openMessages, href: "/admin/messages", icon: Inbox },
    { label: "Reviews to moderate", n: d.pendingReviews, href: "/admin/reviews", icon: Star },
    { label: "Products low on stock", n: d.lowStock.length, href: "/admin/inventory", icon: Boxes },
  ];

  return (
    <>
      {denied && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-warn" /> Your role doesn&apos;t have access to that page.
        </p>
      )}
      <PageHeader
        title={`Hey, ${user.name.split(" ")[0]}`}
        description="Here's how the store is doing over the last 30 days."
        actions={
          <LinkButton href="/admin/orders" variant="secondary">
            <Receipt className="size-4" /> All orders
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue · 30d" value={money(d.revenue)} hint={<Delta value={revDelta} />} icon={<CircleDollarSign className="size-4" />} tone="brand" />
        <StatCard label="Orders · 30d" value={d.orders.toLocaleString("en-US")} hint={<Delta value={ordDelta} />} icon={<ShoppingBag className="size-4" />} />
        <StatCard label="Avg order value" value={money(d.aov)} hint="Paid orders, last 30 days" icon={<Receipt className="size-4" />} />
        <StatCard label="To fulfil" value={d.toFulfil} hint="Paid, not yet shipped" icon={<PackageCheck className="size-4" />} tone={d.toFulfil ? "warn" : "ok"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Revenue" description="Paid orders per day, last 30 days (UTC)" className="xl:col-span-2">
          <RevenueChart data={d.series} />
        </Card>
        <Card title="Needs attention" padded={false}>
          <ul className="divide-y divide-line/70">
            {attention.map(({ label, n, href, icon: Icon }) => (
              <li key={label}>
                <Link href={href} className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-white/[0.03]">
                  <Icon className={cn("size-4", n ? "text-blaze" : "text-dim")} />
                  <span className="flex-1 text-fg/90">{label}</span>
                  <span className={cn("font-mono text-sm tabular-nums", n ? "text-fg" : "text-dim")}>{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Recent orders" padded={false} className="xl:col-span-2" actions={<LinkButton href="/admin/orders" variant="ghost" size="sm">View all</LinkButton>}>
          {d.recent.length === 0 ? (
            <EmptyState icon={<Receipt className="size-5" />} title="No orders yet" description="Orders placed on the storefront will appear here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((o) => (
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
                    <Td>
                      <PaymentBadge status={o.paymentStatus} />
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{money(o.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Top products" description="By paid revenue, last 30 days">
            {d.top.length === 0 ? (
              <p className="text-sm text-muted">No sales yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {d.top.map((t) => (
                  <li key={t.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-fg/90">{t.name}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {money(t.cents)} <span className="text-dim">· {t.qty}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05]">
                      <div className="h-2 rounded-full bg-[#f25018]" style={{ width: `${Math.max(4, (t.cents / topMax) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Low stock" actions={<LinkButton href="/admin/inventory" variant="ghost" size="sm">Inventory</LinkButton>}>
            {d.lowStock.length === 0 ? (
              <p className="text-sm text-muted">Everything is well stocked.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {d.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-fg/90">{p.name}</span>
                    <span className={cn("rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums", p.stockQty <= 0 ? "bg-ember/15 text-[#ff6b5e]" : "bg-warn/15 text-warn")}>
                      {p.stockQty <= 0 ? "Sold out" : `${p.stockQty} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-dim">No prior period to compare</span>;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1", up ? "text-ok" : "text-[#ff6b5e]")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(value)}% <span className="text-dim">vs previous 30 days</span>
    </span>
  );
}
