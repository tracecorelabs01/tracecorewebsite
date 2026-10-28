import "server-only";
import { and, asc, count, desc, eq, gt, inArray, lte, ne, sql, sum } from "drizzle-orm";
import { getDb, messages, orderItems, orders, products, reviews } from "@/db";

const DAY = 86_400_000;
const since = (days: number) => sql`UTC_TIMESTAMP() - INTERVAL ${sql.raw(String(days))} DAY`;

export async function getDashboard() {
  const db = getDb();
  const paid = eq(orders.paymentStatus, "paid");

  const [[rev30], [revPrev], [ord30], [ordPrev], [toFulfil], [awaitingPayment], [openMessages], [pendingReviews], daily, recent, top, lowStock] = await Promise.all([
    db.select({ cents: sum(orders.totalCents), n: count() }).from(orders).where(and(paid, gt(orders.createdAt, since(30)))),
    db.select({ cents: sum(orders.totalCents) }).from(orders).where(and(paid, gt(orders.createdAt, since(60)), lte(orders.createdAt, since(30)))),
    db.select({ n: count() }).from(orders).where(and(ne(orders.status, "cancelled"), gt(orders.createdAt, since(30)))),
    db.select({ n: count() }).from(orders).where(and(ne(orders.status, "cancelled"), gt(orders.createdAt, since(60)), lte(orders.createdAt, since(30)))),
    db.select({ n: count() }).from(orders).where(and(paid, inArray(orders.status, ["pending", "processing"]))),
    db.select({ n: count() }).from(orders).where(and(eq(orders.paymentStatus, "unpaid"), eq(orders.status, "pending"))),
    db.select({ n: count() }).from(messages).where(eq(messages.status, "open")),
    db.select({ n: count() }).from(reviews).where(eq(reviews.status, "pending")),
    db
      .select({ day: sql<string>`DATE_FORMAT(${orders.createdAt}, '%Y-%m-%d')`, cents: sum(orders.totalCents) })
      .from(orders)
      .where(and(paid, gt(orders.createdAt, since(30))))
      .groupBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m-%d')`),
    db
      .select({
        id: orders.id,
        number: orders.number,
        firstName: orders.firstName,
        lastName: orders.lastName,
        email: orders.email,
        totalCents: orders.totalCents,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
    db
      .select({ name: orderItems.productName, qty: sum(orderItems.quantity), cents: sum(orderItems.lineTotalCents) })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(paid, gt(orders.createdAt, since(30))))
      .groupBy(orderItems.productName)
      .orderBy(desc(sum(orderItems.lineTotalCents)))
      .limit(5),
    db
      .select({ id: products.id, name: products.name, stockQty: products.stockQty, threshold: products.lowStockThreshold })
      .from(products)
      .where(and(eq(products.trackInventory, true), eq(products.allowBackorder, false), ne(products.status, "archived"), lte(products.stockQty, products.lowStockThreshold)))
      .orderBy(asc(products.stockQty))
      .limit(6),
  ]);

  // Fill the last 30 UTC days so gaps show as zero.
  const byDay = new Map(daily.map((d) => [d.day, Number(d.cents ?? 0)]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const series = Array.from({ length: 30 }, (_, i) => {
    const key = new Date(today.getTime() - (29 - i) * DAY).toISOString().slice(0, 10);
    return { date: key, cents: byDay.get(key) ?? 0 };
  });

  const revenue = Number(rev30?.cents ?? 0);
  const paidCount = rev30?.n ?? 0;
  return {
    revenue,
    revenuePrev: Number(revPrev?.cents ?? 0),
    orders: ord30?.n ?? 0,
    ordersPrev: ordPrev?.n ?? 0,
    aov: paidCount ? Math.round(revenue / paidCount) : 0,
    toFulfil: toFulfil?.n ?? 0,
    awaitingPayment: awaitingPayment?.n ?? 0,
    openMessages: openMessages?.n ?? 0,
    pendingReviews: pendingReviews?.n ?? 0,
    series,
    recent,
    top: top.map((t) => ({ name: t.name, qty: Number(t.qty ?? 0), cents: Number(t.cents ?? 0) })),
    lowStock,
  };
}

/** Percent change, or null when there's no baseline to compare with. */
export function delta(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
