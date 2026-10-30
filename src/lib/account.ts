import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, sum } from "drizzle-orm";
import { customers, discountCodes, getDb, loyaltyLedger, loyaltyOffers, orderItems, orders, products, reviews } from "@/db";

// Read-only queries for the customer account pages. Every one is scoped to the signed-in customer's id.

export type CheckoutDetails = NonNullable<Awaited<ReturnType<typeof getCheckoutDetails>>>;

/** What checkout fills in for a signed-in customer: their details, with the address from their latest order. */
export async function getCheckoutDetails(customerId: number) {
  const db = getDb();
  const [[c], [last]] = await Promise.all([
    db.select({ email: customers.email, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone, country: customers.country }).from(customers).where(eq(customers.id, customerId)).limit(1),
    db
      .select({
        firstName: orders.firstName,
        lastName: orders.lastName,
        phone: orders.phone,
        address1: orders.address1,
        address2: orders.address2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
      })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(1),
  ]);
  if (!c) return null;
  return {
    email: c.email,
    firstName: last?.firstName || c.firstName,
    lastName: last?.lastName || c.lastName,
    phone: last?.phone || c.phone || "",
    address1: last?.address1 ?? "",
    address2: last?.address2 ?? "",
    city: last?.city ?? "",
    region: last?.region ?? "",
    postalCode: last?.postalCode ?? "",
    country: last?.country || c.country || "",
  };
}

/** The customer behind an email that has placed orders, account or not (for codes that show those orders). */
export async function customerWithOrders(email: string) {
  const [c] = await getDb()
    .select({ id: customers.id, firstName: customers.firstName })
    .from(customers)
    .where(and(eq(customers.email, email), gt(customers.ordersCount, 0)))
    .limit(1);
  return c;
}

/** The Discord and Google accounts linked to a customer (signed in with them, or connected on the account page). */
export async function getLinkedAccounts(customerId: number) {
  const [row] = await getDb()
    .select({ discordId: customers.discordId, discordUsername: customers.discordUsername, googleId: customers.googleId })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return { discord: row?.discordId ? (row.discordUsername ?? "your Discord account") : null, google: Boolean(row?.googleId) };
}

export async function listMyOrders(customerId: number) {
  const db = getDb();
  const rows = await db
    .select({ id: orders.id, number: orders.number, createdAt: orders.createdAt, status: orders.status, paymentStatus: orders.paymentStatus, totalCents: orders.totalCents })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt), desc(orders.id));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [units, points] = await Promise.all([
    db.select({ orderId: orderItems.orderId, n: sum(orderItems.quantity) }).from(orderItems).where(inArray(orderItems.orderId, ids)).groupBy(orderItems.orderId),
    db
      .select({ orderId: loyaltyLedger.orderId, n: sum(loyaltyLedger.points) })
      .from(loyaltyLedger)
      .where(and(inArray(loyaltyLedger.orderId, ids), eq(loyaltyLedger.kind, "order")))
      .groupBy(loyaltyLedger.orderId),
  ]);
  const unitsBy = new Map(units.map((u) => [u.orderId, Number(u.n ?? 0)]));
  const pointsBy = new Map(points.map((p) => [p.orderId, Number(p.n ?? 0)]));
  return rows.map((r) => ({ ...r, units: unitsBy.get(r.id) ?? 0, points: pointsBy.get(r.id) ?? 0 }));
}

export async function getMyOrder(customerId: number, number: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.number, number)))
    .limit(1);
  if (!order) return null;
  const [items, [points]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)),
    db
      .select({ n: sum(loyaltyLedger.points) })
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.orderId, order.id), eq(loyaltyLedger.kind, "order"))),
  ]);
  return { order, items, points: Number(points?.n ?? 0) };
}

export function listActiveOffers() {
  return getDb().select().from(loyaltyOffers).where(eq(loyaltyOffers.isActive, true)).orderBy(asc(loyaltyOffers.sortOrder), asc(loyaltyOffers.pointsCost), asc(loyaltyOffers.id));
}

/** Reward codes this customer redeemed, newest first. */
export function listMyCodes(customerId: number) {
  return getDb()
    .select({ code: discountCodes.code, kind: discountCodes.kind, value: discountCodes.value, minSubtotalCents: discountCodes.minSubtotalCents, productIds: discountCodes.productIds, usedCount: discountCodes.usedCount, maxUses: discountCodes.maxUses, isActive: discountCodes.isActive, createdAt: discountCodes.createdAt })
    .from(discountCodes)
    .where(eq(discountCodes.customerId, customerId))
    .orderBy(desc(discountCodes.createdAt), desc(discountCodes.id));
}

export function listMyPoints(customerId: number, limit = 50) {
  return getDb()
    .select({ id: loyaltyLedger.id, points: loyaltyLedger.points, kind: loyaltyLedger.kind, note: loyaltyLedger.note, createdAt: loyaltyLedger.createdAt })
    .from(loyaltyLedger)
    .where(eq(loyaltyLedger.customerId, customerId))
    .orderBy(desc(loyaltyLedger.createdAt), desc(loyaltyLedger.id))
    .limit(limit);
}

/** Products from this customer's paid orders (the ones they may review), each with their review if they wrote one. */
export async function listReviewable(customerId: number) {
  const db = getDb();
  const [bought, mine] = await Promise.all([
    db
      .selectDistinct({ productId: products.id, slug: products.slug, name: products.name })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(eq(orders.customerId, customerId), eq(orders.paymentStatus, "paid"))),
    db
      .select({ productId: reviews.productId, rating: reviews.rating, body: reviews.body, status: reviews.status, createdAt: reviews.createdAt })
      .from(reviews)
      .where(and(eq(reviews.customerId, customerId), isNotNull(reviews.productId))),
  ]);
  const byProduct = new Map(mine.map((r) => [r.productId, r]));
  return bought.sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ ...p, review: byProduct.get(p.productId) ?? null }));
}

/** Whether this customer has a paid order containing the product. */
export async function hasBought(customerId: number, productId: number) {
  const [row] = await getDb()
    .select({ n: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.customerId, customerId), eq(orders.paymentStatus, "paid"), eq(orderItems.productId, productId)));
  return (row?.n ?? 0) > 0;
}
