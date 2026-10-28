import "server-only";
import { and, asc, count, desc, eq, like, or, sql, sum } from "drizzle-orm";
import { adminUsers, getDb, ORDER_STATUSES, orderEvents, orderItems, orders, PAYMENT_STATUSES, products } from "@/db";

export const PAGE_SIZE = 25;
/** Row cap for CSV exports. */
export const EXPORT_LIMIT = 50_000;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly unknown[]).includes(value);
}

/** Units in an order (sum of line quantities) — a correlated subquery for selects from `orders`. */
export function orderUnits() {
  // Built with the query builder rather than raw sql: in single-table selects Drizzle drops table
  // names from columns in raw select expressions, which would bind `id` to order_items.id.
  const units = getDb().select({ n: sum(orderItems.quantity) }).from(orderItems).where(eq(orderItems.orderId, orders.id));
  return sql<number>`coalesce(${units}, 0)`.mapWith(Number);
}

/** Ship-to address as display lines. */
export function addressLines(o: Pick<typeof orders.$inferSelect, "firstName" | "lastName" | "address1" | "address2" | "city" | "region" | "postalCode" | "country">) {
  return [
    `${o.firstName} ${o.lastName}`.trim(),
    o.address1,
    o.address2,
    [o.city, [o.region, o.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    o.country,
  ].filter((line): line is string => Boolean(line));
}

function orderSearch(q: string) {
  const pattern = `%${q}%`;
  return or(
    like(orders.number, pattern),
    like(orders.email, pattern),
    like(orders.firstName, pattern),
    like(orders.lastName, pattern),
    like(sql`concat(${orders.firstName}, ' ', ${orders.lastName})`, pattern),
  );
}

function tally(rows: { key: string; n: number }[]) {
  const counts: Record<string, number> = { all: 0 };
  for (const r of rows) {
    counts[r.key] = r.n;
    counts.all += r.n;
  }
  return counts;
}

export async function listOrders({ q, status, payment, page }: { q?: string; status?: OrderStatus; payment?: PaymentStatus; page: number }) {
  const db = getDb();
  const search = q ? orderSearch(q) : undefined;
  const byStatus = status ? eq(orders.status, status) : undefined;
  const byPayment = payment ? eq(orders.paymentStatus, payment) : undefined;
  const where = and(search, byStatus, byPayment);

  const [rows, [{ total }], statusRows, paymentRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        firstName: orders.firstName,
        lastName: orders.lastName,
        email: orders.email,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalCents: orders.totalCents,
        currency: orders.currency,
        units: orderUnits(),
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(orders).where(where),
    // Each row of tabs counts within the search and the *other* filter, so a tab's count is what clicking it shows.
    db.select({ key: orders.status, n: count() }).from(orders).where(and(search, byPayment)).groupBy(orders.status),
    db.select({ key: orders.paymentStatus, n: count() }).from(orders).where(and(search, byStatus)).groupBy(orders.paymentStatus),
  ]);
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    statusCounts: tally(statusRows),
    paymentCounts: tally(paymentRows),
  };
}

export async function getOrder(id: number) {
  const db = getDb();
  const [[order], items, events] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        productSlug: orderItems.productSlug,
        productName: orderItems.productName,
        optionValue: orderItems.optionValue,
        unitPriceCents: orderItems.unitPriceCents,
        quantity: orderItems.quantity,
        lineTotalCents: orderItems.lineTotalCents,
        // null when the product has since been deleted
        trackInventory: products.trackInventory,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id)),
    db
      .select({ id: orderEvents.id, type: orderEvents.type, message: orderEvents.message, createdAt: orderEvents.createdAt, adminName: adminUsers.name })
      .from(orderEvents)
      .leftJoin(adminUsers, eq(orderEvents.adminId, adminUsers.id))
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
  ]);
  if (!order) return null;
  return { order, items, events };
}

/** Newest first, capped at EXPORT_LIMIT. */
export async function exportOrders() {
  return getDb()
    .select({
      number: orders.number,
      createdAt: orders.createdAt,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      email: orders.email,
      firstName: orders.firstName,
      lastName: orders.lastName,
      phone: orders.phone,
      address1: orders.address1,
      address2: orders.address2,
      city: orders.city,
      region: orders.region,
      postalCode: orders.postalCode,
      country: orders.country,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
      discountCode: orders.discountCode,
      shippingCents: orders.shippingCents,
      totalCents: orders.totalCents,
      trackingCarrier: orders.trackingCarrier,
      trackingNumber: orders.trackingNumber,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(EXPORT_LIMIT);
}
