import Link from "next/link";
import type { Metadata } from "next";
import { CircleDollarSign, Download, Pencil, Percent, Plus, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { saveExpense } from "@/actions/admin/expenses";
import { ExpenseForm } from "@/components/admin/ExpenseForm";
import { AutoSubmitSelect } from "@/components/admin/forms";
import { Card, EmptyState, FilterTabs, LinkButton, PageHeader, Pagination, StatCard, Table, Td, Th, buttonClass, inputClass, qs } from "@/components/admin/ui";
import { PERIODS, getExpenseOverview, getMonthlyTotals, listExpenseCategories, listExpenses, resolvePeriod, type Period } from "@/lib/admin/expenses";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Expenses" };
// Admin pages read the session and live data on every request.
export const instant = false;

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
const monthName = (start: string) => new Date(`${start}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function rangeLabel(p: Period) {
  if (!p.from && !p.to) return "All time";
  return `${p.from ? shortDate(p.from) : "The start"} – ${p.to ? shortDate(p.to) : "today"}`;
}

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const period = resolvePeriod(param(sp.period), param(sp.from), param(sp.to));
  const category = param(sp.category) || undefined;
  const q = param(sp.q)?.trim() || undefined;
  const page = pageParam(sp.page);
  const [overview, months, list, categories] = await Promise.all([getExpenseOverview(period), getMonthlyTotals(), listExpenses({ period, category, q, page }), listExpenseCategories()]);

  // The current filters, so links and forms keep them.
  const periodParams = { period: period.key === "month" ? undefined : period.key, from: period.key === "custom" ? (period.from ?? undefined) : undefined, to: period.key === "custom" ? (period.to ?? undefined) : undefined };
  const href = (extra: Record<string, string | number | undefined>) => `/admin/expenses${qs({ ...periodParams, category, q, ...extra })}`;
  const range = rangeLabel(period);
  const profit = overview.profitCents;
  const margin = overview.revenueCents > 0 ? Math.round((profit / overview.revenueCents) * 100) : null;
  const best = Math.max(1, ...months.map((m) => Math.max(m.revenueCents, m.expenseCents)));

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Record what the business spends and see your profit against paid orders. Amounts are in USD and dates in UTC."
        actions={
          <>
            <a href={`/api/admin/export/expenses${qs({ ...periodParams, category, q })}`} className={buttonClass("secondary")}>
              <Download className="size-4" /> Export CSV
            </a>
            <a href="#new-expense" className={cn(buttonClass(), "xl:hidden")}>
              <Plus className="size-4" /> Add expense
            </a>
          </>
        }
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Expense deleted.</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <FilterTabs items={Object.entries(PERIODS).map(([key, label]) => ({ label, href: `/admin/expenses${qs({ period: key === "month" ? undefined : key, category, q })}`, active: period.key === key }))} />
            <form action="/admin/expenses" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="period" value="custom" />
              {category && <input type="hidden" name="category" value={category} />}
              {q && <input type="hidden" name="q" value={q} />}
              <input type="date" name="from" defaultValue={period.from ?? ""} aria-label="From" className={cn(inputClass, "w-auto")} />
              <span className="text-sm text-dim">to</span>
              <input type="date" name="to" defaultValue={period.to ?? ""} aria-label="To" className={cn(inputClass, "w-auto")} />
              <button type="submit" className={buttonClass("secondary")}>
                Apply
              </button>
            </form>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard label="Spent" value={money(overview.expenseCents)} hint={`${plural(overview.expenseCount, "expense")} · ${range}`} icon={<Wallet className="size-4" />} />
            <StatCard label="Revenue" value={money(overview.revenueCents)} hint={`${plural(overview.orderCount, "paid order")}`} icon={<CircleDollarSign className="size-4" />} tone="brand" />
            <StatCard
              label="Profit"
              value={money(profit)}
              hint="Revenue minus expenses"
              icon={profit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              tone={profit >= 0 ? "ok" : "warn"}
            />
            <StatCard label="Margin" value={margin === null ? "—" : `${margin}%`} hint="Profit as a share of revenue" icon={<Percent className="size-4" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Card title="Where the money went" description={range}>
              {overview.byCategory.length === 0 ? (
                <p className="text-sm text-muted">No expenses in this period.</p>
              ) : (
                <ul className="space-y-3.5">
                  {overview.byCategory.map((c) => {
                    const share = overview.expenseCents ? c.cents / overview.expenseCents : 0;
                    return (
                      <li key={c.category}>
                        <Link href={href({ category: c.category, page: undefined })} className="group block" title={`Show only ${c.category}`}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate transition-colors group-hover:text-amber">{c.category}</span>
                            <span className="shrink-0 tabular-nums">
                              {money(c.cents)} <span className="text-dim">· {Math.round(share * 100)}%</span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, share * 100)}%` }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Last 12 months" description="Paid-order revenue against expenses, month by month." padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <Th>Month</Th>
                      <Th className="text-right">Revenue</Th>
                      <Th className="text-right">Spent</Th>
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
                          {/* Revenue (orange) over spend (grey), on one scale for the whole table. */}
                          <span aria-hidden className="mt-1 block h-1 rounded-full bg-amber/70" style={{ width: `${(m.revenueCents / best) * 100}%` }} />
                          <span aria-hidden className="mt-0.5 block h-1 rounded-full bg-white/30" style={{ width: `${(m.expenseCents / best) * 100}%` }} />
                        </Td>
                        <Td className="py-2 text-right tabular-nums">{money(m.revenueCents)}</Td>
                        <Td className="py-2 text-right tabular-nums text-muted">{money(m.expenseCents)}</Td>
                        <Td className={cn("py-2 text-right tabular-nums", m.profitCents < 0 ? "text-warn" : m.profitCents > 0 ? "text-ok" : "text-dim")}>{money(m.profitCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card padded={false}>
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Expenses</h2>
                <p className="mt-0.5 text-xs text-dim">
                  {plural(list.total, "expense")} · {money(list.cents)}
                  {category && ` in ${category}`}
                  {q && ` matching “${q}”`} · {range}
                </p>
              </div>
              <form action="/admin/expenses" className="flex flex-col gap-2 sm:flex-row">
                {periodParams.period && <input type="hidden" name="period" value={periodParams.period} />}
                {periodParams.from && <input type="hidden" name="from" value={periodParams.from} />}
                {periodParams.to && <input type="hidden" name="to" value={periodParams.to} />}
                <AutoSubmitSelect name="category" defaultValue={category ?? ""} aria-label="Category" className="sm:w-52">
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </AutoSubmitSelect>
                <span className="relative block sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
                  <input name="q" defaultValue={q} placeholder="Search paid to, notes, invoice…" aria-label="Search expenses" className={cn(inputClass, "pl-9")} />
                </span>
              </form>
            </div>
            {list.rows.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-5" />}
                title={category || q ? "Nothing matches these filters" : "No expenses in this period"}
                description={category || q ? "Try another category or search." : "Record your first one with the Add an expense form."}
                action={(category || q) && <LinkButton href={href({ category: undefined, q: undefined })} variant="secondary" size="sm">Clear filters</LinkButton>}
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Category</Th>
                    <Th>Paid to</Th>
                    <Th>Payment</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td className="whitespace-nowrap text-muted">{shortDate(e.spentOn)}</Td>
                      <Td>
                        <span className="whitespace-nowrap rounded-full border border-line-strong bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted">{e.category}</span>
                      </Td>
                      <Td className="max-w-[300px]">
                        <div className="truncate">{e.vendor || <span className="text-dim">—</span>}</div>
                        {e.description && <div className="truncate text-xs text-dim">{e.description}</div>}
                      </Td>
                      <Td className="whitespace-nowrap text-muted">
                        {e.paymentMethod || "—"}
                        {e.reference && <div className="font-mono text-[11px] text-dim">{e.reference}</div>}
                      </Td>
                      <Td className="whitespace-nowrap text-right font-mono tabular-nums">{money(e.amountCents)}</Td>
                      <Td>
                        <div className="flex justify-end">
                          <LinkButton href={`/admin/expenses/${e.id}`} variant="ghost" size="sm" aria-label={`Edit the ${money(e.amountCents)} ${e.category} expense from ${shortDate(e.spentOn)}`}>
                            <Pencil className="size-3.5" /> Edit
                          </LinkButton>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination page={page} pageCount={list.pageCount} href={(p) => href({ page: p > 1 ? p : undefined })} />
          </Card>
        </div>

        <div id="new-expense" className="scroll-mt-24 xl:sticky xl:top-24 xl:self-start">
          <Card title="Add an expense" description="Saved straight away and counted in the totals.">
            <ExpenseForm action={saveExpense.bind(null, null)} today={new Date().toISOString().slice(0, 10)} categories={categories} resetOnSuccess submitLabel="Add expense" compact />
          </Card>
        </div>
      </div>
    </>
  );
}
