import "server-only";
import { count, desc, eq, like, max, or, sql } from "drizzle-orm";
import { customers, getDb, orders, subscribers } from "@/db";
import { EXPORT_LIMIT, orderUnits } from "./orders";

export const PAGE_SIZE = 25;
/** Orders listed on a customer's page (the rest are one search away on the Orders page). */
export const CUSTOMER_ORDERS_LIMIT = 50;

// Order stats are always computed from `orders` — customers.orders_count / total_spent_cents are
// only maintained by checkout and drift once orders are refunded or cancelled.

/** Sum of paid order totals. DECIMAL comes back from mysql2 as a string. */
const paidCents = () => sql<string | null>`sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalCents} else 0 end)`;
const paidCount = () => count(sql`case when ${orders.paymentStatus} = 'paid' then 1 end`);

function customerSearch(q: string) {
  const pattern = `%${q}%`;
  return or(
    like(customers.email, pattern),
    like(customers.firstName, pattern),
    like(customers.lastName, pattern),
    like(sql`concat(${customers.firstName}, ' ', ${customers.lastName})`, pattern),
  );
}

export async function listCustomers({ q, page }: { q?: string; page: number }) {
  const db = getDb();
  const where = q ? customerSearch(q) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        country: customers.country,
        orderCount: count(orders.id),
        spent: paidCents(),
        lastOrderAt: max(orders.createdAt),
      })
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(where)
      .groupBy(customers.id)
      // Most recently active first; customers without orders by sign-up date.
      .orderBy(sql`coalesce(max(${orders.createdAt}), ${customers.createdAt}) desc`, desc(customers.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  return {
    rows: rows.map(({ spent, ...r }) => ({ ...r, spentCents: Number(spent ?? 0) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getCustomer(id: number) {
  const db = getDb();
  const [[customer], [stats], recent] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)).limit(1),
    db.select({ orderCount: count(), paidCount: paidCount(), paid: paidCents() }).from(orders).where(eq(orders.customerId, id)),
    db
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalCents: orders.totalCents,
        currency: orders.currency,
        units: orderUnits(),
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(CUSTOMER_ORDERS_LIMIT),
  ]);
  if (!customer) return null;
  const paidSpendCents = Number(stats?.paid ?? 0);
  const paidOrders = stats?.paidCount ?? 0;
  return {
    customer,
    stats: {
      orders: stats?.orderCount ?? 0,
      paidOrders,
      paidSpendCents,
      averagePaidCents: paidOrders ? Math.round(paidSpendCents / paidOrders) : 0,
    },
    orders: recent,
  };
}

/* ───────────── CSV exports (newest first, capped at EXPORT_LIMIT) ───────────── */

export async function exportCustomers() {
  const rows = await getDb()
    .select({
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      country: customers.country,
      orderCount: count(orders.id),
      paid: paidCents(),
      lastOrderAt: max(orders.createdAt),
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt), desc(customers.id))
    .limit(EXPORT_LIMIT);
  return rows.map(({ paid, ...r }) => ({ ...r, paidCents: Number(paid ?? 0) }));
}

/** The newsletter audience, for the same export route. */
export async function exportSubscribers() {
  return getDb()
    .select({ email: subscribers.email, source: subscribers.source, createdAt: subscribers.createdAt, unsubscribedAt: subscribers.unsubscribedAt })
    .from(subscribers)
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
    .limit(EXPORT_LIMIT);
}
