import "server-only";
import { and, count, desc, eq, like, type SQL } from "drizzle-orm";
import { activityLog, adminUsers, getDb } from "@/db";

export const ACTIVITY_PAGE_SIZE = 50;

/** Entities offered as filter tabs on /admin/activity. */
export const ACTIVITY_ENTITIES = ["order", "product", "category", "discount", "review", "message", "subscriber", "customer", "settings", "staff", "session"] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export async function listActivity({ entity, q, page }: { entity?: ActivityEntity; q?: string; page: number }) {
  const db = getDb();
  const filters: SQL[] = [];
  if (entity) filters.push(eq(activityLog.entity, entity));
  if (q) filters.push(like(activityLog.summary, `%${q}%`));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ total }], entityCounts] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        adminId: activityLog.adminId,
        adminName: adminUsers.name,
        action: activityLog.action,
        entity: activityLog.entity,
        entityId: activityLog.entityId,
        summary: activityLog.summary,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .leftJoin(adminUsers, eq(activityLog.adminId, adminUsers.id))
      .where(where)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE),
    db.select({ total: count() }).from(activityLog).where(where),
    db.select({ entity: activityLog.entity, n: count() }).from(activityLog).groupBy(activityLog.entity),
  ]);
  const counts: Record<string, number> = Object.fromEntries(entityCounts.map((c) => [c.entity, c.n]));
  counts.all = entityCounts.reduce((n, c) => n + c.n, 0);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)), counts };
}
