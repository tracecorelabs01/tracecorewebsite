import "server-only";
import { and, count, desc, eq, gte, like, lt, lte, or, sql, sum } from "drizzle-orm";
import { expenses, getDb, orders } from "@/db";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { EXPORT_LIMIT } from "./orders";

export const PAGE_SIZE = 25;

export const PERIODS = {
  month: "This month",
  "last-month": "Last month",
  year: "This year",
  "12m": "Last 12 months",
  all: "All time",
} as const;
export type PeriodKey = keyof typeof PERIODS | "custom";

/** A range of days as YYYY-MM-DD (UTC); a missing end is open. */
export interface Period {
  key: PeriodKey;
  from: string | null;
  to: string | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** A real calendar day "YYYY-MM-DD", or null. */
export function validDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && ymd(d) === value ? value : null;
}

/** The period from the page's search params. Defaults to this month. */
export function resolvePeriod(period: string | undefined, from: string | undefined, to: string | undefined, now = new Date()): Period {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Day 0 of a month is the last day of the month before.
  const day = (year: number, month: number, d: number) => ymd(new Date(Date.UTC(year, month, d)));
  let f = validDay(from);
  let t = validDay(to);
  if (period === "custom" && (f || t)) {
    if (f && t && f > t) [f, t] = [t, f];
    return { key: "custom", from: f, to: t };
  }
  switch (period) {
    case "last-month":
      return { key: "last-month", from: day(y, m - 1, 1), to: day(y, m, 0) };
    case "year":
      return { key: "year", from: day(y, 0, 1), to: day(y, 11, 31) };
    case "12m":
      return { key: "12m", from: day(y, m - 11, 1), to: day(y, m + 1, 0) };
    case "all":
      return { key: "all", from: null, to: null };
    default:
      return { key: "month", from: day(y, m, 1), to: day(y, m + 1, 0) };
  }
}

const spentIn = (p: Period) => and(p.from ? gte(expenses.spentOn, p.from) : undefined, p.to ? lte(expenses.spentOn, p.to) : undefined);

// Revenue is what paid orders brought in (after discounts, with shipping), by the day they were placed, like the dashboard.
const paidIn = (p: Period) =>
  and(
    eq(orders.paymentStatus, "paid"),
    p.from ? gte(orders.createdAt, new Date(`${p.from}T00:00:00Z`)) : undefined,
    p.to ? lt(orders.createdAt, new Date(Date.parse(`${p.to}T00:00:00Z`) + 86_400_000)) : undefined,
  );

/** Spend, revenue and profit for a period, plus spend by category (largest first). */
export async function getExpenseOverview(p: Period) {
  const db = getDb();
  const total = sum(expenses.amountCents);
  const [[spent], [revenue], byCategory] = await Promise.all([
    db.select({ cents: sum(expenses.amountCents), n: count() }).from(expenses).where(spentIn(p)),
    db.select({ cents: sum(orders.totalCents), n: count() }).from(orders).where(paidIn(p)),
    db.select({ category: expenses.category, cents: total, n: count() }).from(expenses).where(spentIn(p)).groupBy(expenses.category).orderBy(desc(total)),
  ]);
  const expenseCents = Number(spent?.cents ?? 0);
  const revenueCents = Number(revenue?.cents ?? 0);
  return {
    expenseCents,
    expenseCount: spent?.n ?? 0,
    revenueCents,
    orderCount: revenue?.n ?? 0,
    profitCents: revenueCents - expenseCents,
    byCategory: byCategory.map((c) => ({ category: c.category, cents: Number(c.cents ?? 0), count: c.n })),
  };
}

/** Revenue, spend and profit for each of the last `months` months, newest first. */
export async function getMonthlyTotals(months = 12, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const spentMonth = sql<string>`date_format(${expenses.spentOn}, '%Y-%m')`;
  const orderMonth = sql<string>`date_format(${orders.createdAt}, '%Y-%m')`;
  const db = getDb();
  const [spent, revenue] = await Promise.all([
    db.select({ month: spentMonth, cents: sum(expenses.amountCents) }).from(expenses).where(gte(expenses.spentOn, ymd(start))).groupBy(spentMonth),
    db
      .select({ month: orderMonth, cents: sum(orders.totalCents) })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, start)))
      .groupBy(orderMonth),
  ]);
  const spentBy = new Map(spent.map((r) => [r.month, Number(r.cents ?? 0)]));
  const revenueBy = new Map(revenue.map((r) => [r.month, Number(r.cents ?? 0)]));
  return Array.from({ length: months }, (_, i) => {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    const start = ymd(new Date(Date.UTC(y, m, 1)));
    const month = start.slice(0, 7);
    const expenseCents = spentBy.get(month) ?? 0;
    const revenueCents = revenueBy.get(month) ?? 0;
    return { month, start, end: ymd(new Date(Date.UTC(y, m + 1, 0))), expenseCents, revenueCents, profitCents: revenueCents - expenseCents };
  });
}

function listWhere(p: Period, category?: string, q?: string) {
  const term = q?.trim();
  return and(
    spentIn(p),
    category ? eq(expenses.category, category) : undefined,
    term ? or(like(expenses.vendor, `%${term}%`), like(expenses.description, `%${term}%`), like(expenses.reference, `%${term}%`), like(expenses.category, `%${term}%`)) : undefined,
  );
}

/** One page of expenses (newest first) with the count and total of everything matching. */
export async function listExpenses({ period, category, q, page }: { period: Period; category?: string; q?: string; page: number }) {
  const where = listWhere(period, category, q);
  const db = getDb();
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.spentOn), desc(expenses.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count(), cents: sum(expenses.amountCents) }).from(expenses).where(where),
  ]);
  const total = totals?.n ?? 0;
  return { rows, total, cents: Number(totals?.cents ?? 0), pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getExpense(id: number) {
  const [row] = await getDb().select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row;
}

/** Categories to suggest: the built-in ones, then any others already used. */
export async function listExpenseCategories() {
  const used = await getDb().selectDistinct({ category: expenses.category }).from(expenses);
  const known = new Set(DEFAULT_EXPENSE_CATEGORIES.map((c) => c.toLowerCase()));
  const extra = used.map((r) => r.category).filter((c) => !known.has(c.toLowerCase()));
  return [...DEFAULT_EXPENSE_CATEGORIES, ...extra.sort((a, b) => a.localeCompare(b))];
}

/** Rows for the CSV download, matching the filters on the page (capped at EXPORT_LIMIT). */
export function exportExpenses(period: Period, category?: string, q?: string) {
  return getDb()
    .select()
    .from(expenses)
    .where(listWhere(period, category, q))
    .orderBy(desc(expenses.spentOn), desc(expenses.id))
    .limit(EXPORT_LIMIT);
}
