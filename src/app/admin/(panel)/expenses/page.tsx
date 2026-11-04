import Link from "next/link";
import type { Metadata } from "next";
import { Calculator, CircleDollarSign, PackageMinus, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { ExpensesHeader, PeriodFilter, periodQuery } from "@/components/admin/ExpensesHeader";
import { Card, EmptyState, LinkButton, Pagination, StatCard, Table, Td, Th, qs } from "@/components/admin/ui";
import { listCostFields } from "@/lib/admin/costs";
import { PAGE_SIZE, getExpenseOverview, getMonthlyTotals, listOrderProfits, resolvePeriod, type Period } from "@/lib/admin/expenses";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Expenses" };
// Admin pages read the session and live data on every request.
export const instant = false;

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
const monthName = (start: string) => new Date(`${start}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—");

function rangeLabel(p: Period) {
  if (!p.from && !p.to) return "All time";
  return `${p.from ? shortDate(p.from) : "The start"} – ${p.to ? shortDate(p.to) : "today"}`;
}

export default async function ProfitPage({ searchParams }: PageProps<"/admin/expenses">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const period = resolvePeriod(param(sp.period), param(sp.from), param(sp.to));
  const page = pageParam(sp.page);
  const [overview, months, orders, fields] = await Promise.all([getExpenseOverview(period), getMonthlyTotals(), listOrderProfits(period, page), listCostFields()]);

  const periodParams = periodQuery(period);
  const range = rangeLabel(period);
  const profit = overview.profitCents;
  const best = Math.max(1, ...months.map((m) => Math.max(m.revenueCents, m.costCents + m.expenseCents)));
  // Order costs (from the cost fields) and other expenses together, largest first.
  const outgoings = [
    ...overview.costs.map((c) => ({ label: c.name, cents: c.cents, href: "/admin/expenses/costs", title: "Worked out from each product's cost fields", order: true })),
    ...overview.byCategory.map((c) => ({ label: c.category, cents: c.cents, href: `/admin/expenses/other${qs({ ...periodParams, category: c.category })}`, title: `Show the ${c.category} expenses`, order: false })),
  ].sort((a, b) => b.cents - a.cents);
  const outgoingCents = overview.costCents + overview.expenseCents;

  return (
    <>
      <ExpensesHeader active="profit" period={period} />
      {fields.length === 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blaze/40 bg-blaze/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>Set up your cost fields (supplier price, postage, payment fee) and fill them in once on each product. Every order&apos;s costs and profit are then worked out for you.</p>
          <LinkButton href="/admin/expenses/costs" size="sm">
            <Calculator className="size-3.5" /> Set up cost fields
          </LinkButton>
        </div>
      )}

      <div className="space-y-4">
        <PeriodFilter base="/admin/expenses" period={period} />

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <StatCard label="Revenue" value={money(overview.revenueCents)} hint={`${plural(overview.orderCount, "paid order")} · ${range}`} icon={<CircleDollarSign className="size-4" />} tone="brand" />
          <StatCard label="Order costs" value={money(overview.costCents)} hint="Worked out automatically from each product's costs" icon={<PackageMinus className="size-4" />} />
          <StatCard label="Other expenses" value={money(overview.expenseCents)} hint={plural(overview.expenseCount, "expense")} icon={<Wallet className="size-4" />} />
          <StatCard
            label="Profit"
            value={money(profit)}
            hint={overview.revenueCents > 0 ? `${pct(profit, overview.revenueCents)} margin` : "Revenue minus costs and expenses"}
            icon={profit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            tone={profit >= 0 ? "ok" : "warn"}
          />
        </div>

        <Card title="Paid orders" description={`What each one cost and made · ${range}`} padded={false}>
          {orders.length === 0 ? (
            <EmptyState icon={<Receipt className="size-5" />} title="No paid orders in this period" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Customer paid</Th>
                  <Th className="text-right">Costs</Th>
                  <Th className="text-right">Profit</Th>
                  <Th className="text-right">Margin</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/admin/orders/${o.id}#profit`} className="font-mono text-sm text-fg hover:text-amber">
                        {o.number}
                      </Link>
                      <div className="text-xs text-dim">{`${o.firstName} ${o.lastName}`.trim()}</div>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{shortDate(o.createdAt)}</Td>
                    <Td className="text-right font-mono tabular-nums">{money(o.totalCents)}</Td>
                    <Td className="text-right font-mono tabular-nums text-muted">{money(o.costCents)}</Td>
                    <Td className={cn("text-right font-mono tabular-nums", o.profitCents < 0 ? "text-warn" : "text-ok")}>{money(o.profitCents)}</Td>
                    <Td className="text-right tabular-nums text-muted">{pct(o.profitCents, o.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(overview.orderCount / PAGE_SIZE))} href={(p) => `/admin/expenses${qs({ ...periodParams, page: p > 1 ? p : undefined })}`} />
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <Card title="Where the money went" description={range}>
            {outgoings.length === 0 ? (
              <p className="text-sm text-muted">No costs or expenses in this period.</p>
            ) : (
              <ul className="space-y-3.5">
                {outgoings.map((c) => {
                  const share = outgoingCents ? c.cents / outgoingCents : 0;
                  return (
                    <li key={`${c.order}-${c.label}`}>
                      <Link href={c.href} className="group block" title={c.title}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate transition-colors group-hover:text-amber">
                            {c.label}
                            {c.order && <span className="ml-2 text-xs text-dim">order cost</span>}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {money(c.cents)} <span className="text-dim">· {Math.round(share * 100)}%</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={cn("h-full rounded-full", c.order ? "bg-amber/70" : "bg-brand")} style={{ width: `${Math.max(2, share * 100)}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Last 12 months" description="Paid-order revenue against order costs and other expenses, month by month." padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th className="text-right">Revenue</Th>
                    <Th className="text-right">Costs</Th>
                    <Th className="text-right">Other</Th>
                    <Th className="text-right">Profit</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}>
                      <Td className="whitespace-nowrap py-2">
                        <Link href={`/admin/expenses${qs({ period: "custom", from: m.start, to: m.end })}`} className="hover:text-amber">
                          {monthName(m.start)}
                        </Link>
                        {/* Revenue (orange) over order costs and spend (grey), on one scale for the whole table. */}
                        <span aria-hidden className="mt-1 block h-1 rounded-full bg-amber/70" style={{ width: `${(m.revenueCents / best) * 100}%` }} />
                        <span aria-hidden className="mt-0.5 block h-1 rounded-full bg-white/30" style={{ width: `${((m.costCents + m.expenseCents) / best) * 100}%` }} />
                      </Td>
                      <Td className="py-2 text-right tabular-nums">{money(m.revenueCents)}</Td>
                      <Td className="py-2 text-right tabular-nums text-muted">{money(m.costCents)}</Td>
                      <Td className="py-2 text-right tabular-nums text-muted">{money(m.expenseCents)}</Td>
                      <Td className={cn("py-2 text-right tabular-nums", m.profitCents < 0 ? "text-warn" : m.profitCents > 0 ? "text-ok" : "text-dim")}>{money(m.profitCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
