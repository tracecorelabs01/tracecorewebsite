import "server-only";
import { and, count, desc, eq, like, or, sql, sum } from "drizzle-orm";
import type { Tone } from "@/components/admin/ui";
import { affiliateCommissions, affiliateGroups, affiliatePayouts, affiliates, customers, getDb } from "@/db";

// Read-only queries for /admin/affiliates. The program logic itself is in src/lib/affiliates.ts.

export const PARTNER_STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_TONE: Record<PartnerStatus, Tone> = { pending: "warn", approved: "ok", suspended: "danger", rejected: "neutral" };

/** Partners with their customer email and earnings so far (everything not reversed). */
export async function listPartners(status: PartnerStatus | null, q: string) {
  const db = getDb();
  const earned = db
    .select({ affiliateId: affiliateCommissions.affiliateId, n: sum(affiliateCommissions.amountCents).as("n") })
    .from(affiliateCommissions)
    .where(sql`${affiliateCommissions.status} <> 'reversed'`)
    .groupBy(affiliateCommissions.affiliateId)
    .as("earned");
  const search = q ? or(like(affiliates.name, `%${q}%`), like(affiliates.code, `%${q.toUpperCase()}%`), like(customers.email, `%${q.toLowerCase()}%`)) : undefined;
  return db
    .select({
      id: affiliates.id,
      name: affiliates.name,
      code: affiliates.code,
      status: affiliates.status,
      email: customers.email,
      groupName: affiliateGroups.name,
      createdAt: affiliates.createdAt,
      earnedCents: earned.n,
    })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .leftJoin(affiliateGroups, eq(affiliates.groupId, affiliateGroups.id))
    .leftJoin(earned, eq(earned.affiliateId, affiliates.id))
    .where(and(status ? eq(affiliates.status, status) : undefined, search))
    .orderBy(desc(affiliates.createdAt), desc(affiliates.id))
    .limit(200);
}

export async function partnerStatusCounts() {
  const rows = await getDb().select({ status: affiliates.status, n: count() }).from(affiliates).groupBy(affiliates.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<PartnerStatus, number>>;
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

export async function listGroups() {
  const db = getDb();
  const members = db.select({ groupId: affiliates.groupId, n: count().as("n") }).from(affiliates).groupBy(affiliates.groupId).as("members");
  return db
    .select({ id: affiliateGroups.id, name: affiliateGroups.name, description: affiliateGroups.description, isDefault: affiliateGroups.isDefault, partners: members.n })
    .from(affiliateGroups)
    .leftJoin(members, eq(members.groupId, affiliateGroups.id))
    .orderBy(desc(affiliateGroups.isDefault), affiliateGroups.name);
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
