import "server-only";
import { and, asc, count, desc, eq, gt, isNotNull, sql, sum } from "drizzle-orm";
import { customers, discountCodes, getDb, loyaltyLedger, loyaltyOffers, products } from "@/db";
import { pointsBalance, withProductNames } from "@/lib/loyalty";

/** Headline numbers for the Loyalty page. */
export async function getLoyaltyStats() {
  const db = getDb();
  const [[accounts], [outstanding], [earned30], [redeemed], [codesUsed]] = await Promise.all([
    db.select({ n: count() }).from(customers).where(isNotNull(customers.accountCreatedAt)),
    db.select({ n: sum(loyaltyLedger.points) }).from(loyaltyLedger),
    db
      .select({ n: sum(loyaltyLedger.points) })
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.kind, "order"), gt(loyaltyLedger.createdAt, sql`UTC_TIMESTAMP() - INTERVAL 30 DAY`))),
    db.select({ n: count() }).from(loyaltyLedger).where(eq(loyaltyLedger.kind, "redeem")),
    db
      .select({ n: count() })
      .from(discountCodes)
      .where(and(isNotNull(discountCodes.customerId), gt(discountCodes.usedCount, 0))),
  ]);
  return {
    accounts: accounts?.n ?? 0,
    outstanding: Number(outstanding?.n ?? 0),
    earned30: Number(earned30?.n ?? 0),
    redeemed: redeemed?.n ?? 0,
    codesUsed: codesUsed?.n ?? 0,
  };
}

export async function listOffers() {
  return withProductNames(await getDb().select().from(loyaltyOffers).orderBy(desc(loyaltyOffers.isActive), asc(loyaltyOffers.sortOrder), asc(loyaltyOffers.pointsCost), asc(loyaltyOffers.id)));
}

export async function getOffer(id: number) {
  const [row] = await getDb().select().from(loyaltyOffers).where(eq(loyaltyOffers.id, id)).limit(1);
  return row ? (await withProductNames([row]))[0] : null;
}

/** Products an offer can be limited to: everything not archived, live ones first. */
export function listOfferProducts() {
  return getDb()
    .select({ id: products.id, name: products.name, priceCents: products.priceCents, status: products.status })
    .from(products)
    .where(sql`${products.status} <> 'archived'`)
    .orderBy(asc(products.status), asc(products.name));
}

/** Latest points changes across all customers. */
export function listRecentPoints(limit = 20) {
  return getDb()
    .select({ id: loyaltyLedger.id, points: loyaltyLedger.points, kind: loyaltyLedger.kind, note: loyaltyLedger.note, createdAt: loyaltyLedger.createdAt, customerId: loyaltyLedger.customerId, email: customers.email })
    .from(loyaltyLedger)
    .innerJoin(customers, eq(loyaltyLedger.customerId, customers.id))
    .orderBy(desc(loyaltyLedger.createdAt), desc(loyaltyLedger.id))
    .limit(limit);
}

/** One customer's account and points, for their admin page. */
export async function getCustomerLoyalty(customerId: number) {
  const db = getDb();
  const [[account], balance, history, codes] = await Promise.all([
    db.select({ accountCreatedAt: customers.accountCreatedAt, lastLoginAt: customers.lastLoginAt }).from(customers).where(eq(customers.id, customerId)).limit(1),
    pointsBalance(customerId),
    db
      .select({ id: loyaltyLedger.id, points: loyaltyLedger.points, kind: loyaltyLedger.kind, note: loyaltyLedger.note, createdAt: loyaltyLedger.createdAt })
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.customerId, customerId))
      .orderBy(desc(loyaltyLedger.createdAt), desc(loyaltyLedger.id))
      .limit(25),
    db
      .select({ code: discountCodes.code, kind: discountCodes.kind, value: discountCodes.value, usedCount: discountCodes.usedCount })
      .from(discountCodes)
      .where(eq(discountCodes.customerId, customerId))
      .orderBy(desc(discountCodes.createdAt)),
  ]);
  return { accountCreatedAt: account?.accountCreatedAt ?? null, lastLoginAt: account?.lastLoginAt ?? null, balance, history, codes };
}
