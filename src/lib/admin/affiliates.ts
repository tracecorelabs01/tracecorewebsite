import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, isNull, like, ne, or, sql, sum, type SQL } from "drizzle-orm";
import type { Tone } from "@/components/admin/ui";
import { affiliateClicks, affiliateCommissions, affiliateGroups, affiliatePayouts, affiliates, customers, getDb, orders } from "@/db";
import { getProgram } from "@/lib/affiliates";

// Read-only queries for /admin/affiliates. The program logic itself is in src/lib/affiliates.ts.

export const PARTNER_STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_TONE: Record<PartnerStatus, Tone> = { pending: "warn", approved: "ok", suspended: "danger", rejected: "neutral" };

export const PARTNER_SORTS = { newest: "Newest first", sales: "Most sales, 30 days", earned: "Most earned", owed: "Most owed", name: "Name" } as const;
export type PartnerSort = keyof typeof PARTNER_SORTS;
export const isPartnerSort = (v: string | undefined): v is PartnerSort => Boolean(v) && Object.hasOwn(PARTNER_SORTS, v!);

export const PARTNERS_PAGE_SIZE = 25;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
/** An order's items after discounts: what partner sales and commissions are counted on. */
const itemsCents = sql<number>`SUM(${orders.subtotalCents} - ${orders.discountCents})`;

/**
 * A page of partners with what the team needs to see at a glance: their discount and its limit, the last 30 days'
 * clicks, paid orders and sales, what they've earned so far (everything not reversed) and what's owed (approved,
 * not yet paid). Partners without a group count as the default group's.
 */
export async function listPartners(opts: { status?: PartnerStatus; groupId?: number; q?: string; sort?: PartnerSort; page?: number }) {
  const db = getDb();
  const since = daysAgo(30);
  const [program, groups] = await Promise.all([getProgram(db), db.select().from(affiliateGroups)]);
  const fallback = groups.find((g) => g.isDefault);

  const money = db
    .select({
      affiliateId: affiliateCommissions.affiliateId,
      earned: sql<number>`SUM(CASE WHEN ${affiliateCommissions.status} <> 'reversed' THEN ${affiliateCommissions.amountCents} ELSE 0 END)`.as("earned"),
      owed: sql<number>`SUM(CASE WHEN ${affiliateCommissions.status} = 'approved' THEN ${affiliateCommissions.amountCents} ELSE 0 END)`.as("owed"),
    })
    .from(affiliateCommissions)
    .groupBy(affiliateCommissions.affiliateId)
    .as("money");
  const sales = db
    .select({ affiliateId: orders.affiliateId, orderCount: count().as("order_count"), cents: itemsCents.as("cents") })
    .from(orders)
    .where(and(isNotNull(orders.affiliateId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
    .groupBy(orders.affiliateId)
    .as("sales");
  const visits = db
    .select({ affiliateId: affiliateClicks.affiliateId, clicks: sum(affiliateClicks.clicks).as("clicks") })
    .from(affiliateClicks)
    .where(gte(affiliateClicks.day, since.toISOString().slice(0, 10)))
    .groupBy(affiliateClicks.affiliateId)
    .as("visits");

  const q = opts.q?.trim();
  const inGroup = opts.groupId ? (opts.groupId === fallback?.id ? or(eq(affiliates.groupId, opts.groupId), isNull(affiliates.groupId)) : eq(affiliates.groupId, opts.groupId)) : undefined;
  const where = and(
    opts.status ? eq(affiliates.status, opts.status) : undefined,
    inGroup,
    q ? or(like(affiliates.name, `%${q}%`), like(affiliates.code, `%${q.toUpperCase()}%`), like(customers.email, `%${q.toLowerCase()}%`)) : undefined,
  );
  const order: Record<PartnerSort, SQL[]> = {
    newest: [desc(affiliates.createdAt)],
    sales: [desc(sql`COALESCE(${sales.cents}, 0)`)],
    earned: [desc(sql`COALESCE(${money.earned}, 0)`)],
    owed: [desc(sql`COALESCE(${money.owed}, 0)`)],
    name: [asc(affiliates.name)],
  };
  const page = Math.max(1, opts.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: affiliates.id,
        name: affiliates.name,
        code: affiliates.code,
        status: affiliates.status,
        email: customers.email,
        groupId: affiliates.groupId,
        maxDiscount: affiliates.maxDiscount,
        customerDiscount: affiliates.customerDiscount,
        createdAt: affiliates.createdAt,
        earnedCents: money.earned,
        owedCents: money.owed,
        orders: sales.orderCount,
        salesCents: sales.cents,
        clicks: visits.clicks,
      })
      .from(affiliates)
      .innerJoin(customers, eq(affiliates.customerId, customers.id))
      .leftJoin(money, eq(money.affiliateId, affiliates.id))
      .leftJoin(sales, eq(sales.affiliateId, affiliates.id))
      .leftJoin(visits, eq(visits.affiliateId, affiliates.id))
      .where(where)
      .orderBy(...order[opts.sort ?? "newest"], desc(affiliates.id))
      .limit(PARTNERS_PAGE_SIZE)
      .offset((page - 1) * PARTNERS_PAGE_SIZE),
    db.select({ total: count() }).from(affiliates).innerJoin(customers, eq(affiliates.customerId, customers.id)).where(where),
  ]);

  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PARTNERS_PAGE_SIZE)),
    rows: rows.map((r) => {
      const group = groups.find((g) => g.id === r.groupId) ?? fallback;
      // Their limit for products without their own row, and the discount their customers get within it.
      const limit = r.maxDiscount ?? group?.maxDiscount ?? program.maxDiscount;
      return {
        ...r,
        groupName: group?.name ?? null,
        limit,
        discount: Math.min(r.customerDiscount ?? limit, limit),
        earnedCents: Number(r.earnedCents ?? 0),
        owedCents: Number(r.owedCents ?? 0),
        orders: Number(r.orders ?? 0),
        salesCents: Number(r.salesCents ?? 0),
        clicks: Number(r.clicks ?? 0),
      };
    }),
  };
}

export async function partnerStatusCounts() {
  const rows = await getDb().select({ status: affiliates.status, n: count() }).from(affiliates).groupBy(affiliates.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<PartnerStatus, number>>;
}

/** Applications waiting for a decision, oldest first, with what the applicant wrote. */
export function listApplications() {
  return getDb()
    .select({
      id: affiliates.id,
      name: affiliates.name,
      website: affiliates.website,
      audience: affiliates.audience,
      createdAt: affiliates.createdAt,
      email: customers.email,
      discordId: customers.discordId,
      discordUsername: customers.discordUsername,
    })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(eq(affiliates.status, "pending"))
    .orderBy(affiliates.createdAt, affiliates.id)
    .limit(100);
}

/** PayPal payouts waiting to be sent: how many and how much. */
export async function payoutsToPay() {
  const [row] = await getDb().select({ n: count(), cents: sum(affiliatePayouts.amountCents) }).from(affiliatePayouts).where(eq(affiliatePayouts.status, "requested"));
  return { count: row?.n ?? 0, cents: Number(row?.cents ?? 0) };
}

/** The program over the last 30 days: paid orders partners referred, their sales, the commission on them, and everything owed now. */
export async function programSummary() {
  const db = getDb();
  const since = daysAgo(30);
  const [[sales], [commission], [owed]] = await Promise.all([
    db.select({ n: count(), cents: itemsCents }).from(orders).where(and(isNotNull(orders.affiliateId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since))),
    db.select({ cents: sum(affiliateCommissions.amountCents) }).from(affiliateCommissions).where(and(eq(affiliateCommissions.kind, "order"), ne(affiliateCommissions.status, "reversed"), gte(affiliateCommissions.createdAt, since))),
    db.select({ cents: sum(affiliateCommissions.amountCents) }).from(affiliateCommissions).where(eq(affiliateCommissions.status, "approved")),
  ]);
  return { orders: sales?.n ?? 0, salesCents: Number(sales?.cents ?? 0), commissionCents: Number(commission?.cents ?? 0), owedCents: Number(owed?.cents ?? 0) };
}

export async function getPartner(id: number) {
  const [row] = await getDb()
    .select({ partner: affiliates, email: customers.email, firstName: customers.firstName, lastName: customers.lastName, discordId: customers.discordId, discordUsername: customers.discordUsername })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(eq(affiliates.id, id))
    .limit(1);
  return row ?? null;
}

/** Groups, the default first, with how many partners each has (partners without a group count as the default's). */
export async function listGroups() {
  const db = getDb();
  const [groups, members] = await Promise.all([
    db.select().from(affiliateGroups).orderBy(desc(affiliateGroups.isDefault), affiliateGroups.name),
    db.select({ groupId: affiliates.groupId, n: count() }).from(affiliates).groupBy(affiliates.groupId),
  ]);
  const size = (id: number | null) => members.find((m) => m.groupId === id)?.n ?? 0;
  return groups.map((g) => ({ ...g, partners: size(g.id) + (g.isDefault ? size(null) : 0) }));
}

export async function getGroup(id: number) {
  const [g] = await getDb().select().from(affiliateGroups).where(eq(affiliateGroups.id, id)).limit(1);
  return g ?? null;
}

/** Payout requests to pay first, then the latest paid or rejected. */
export async function listPayouts() {
  const db = getDb();
  const base = () =>
    db
      .select({ payout: affiliatePayouts, partnerName: affiliates.name, partnerId: affiliates.id })
      .from(affiliatePayouts)
      .innerJoin(affiliates, eq(affiliatePayouts.affiliateId, affiliates.id));
  const [requested, recent] = await Promise.all([
    base().where(eq(affiliatePayouts.status, "requested")).orderBy(affiliatePayouts.createdAt),
    base().where(sql`${affiliatePayouts.status} <> 'requested'`).orderBy(desc(affiliatePayouts.updatedAt)).limit(50),
  ]);
  return { requested, recent };
}
