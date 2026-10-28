import "server-only";
import { count, desc, isNull, like, or } from "drizzle-orm";
import { getDb, subscribers } from "@/db";

const PAGE_SIZE = 25;

export async function listSubscribers({ q, page }: { q?: string; page: number }) {
  const db = getDb();
  const where = q ? or(like(subscribers.email, `%${q}%`), like(subscribers.source, `%${q}%`)) : undefined;

  const [rows, [{ total }], [{ all }], [{ active }]] = await Promise.all([
    db
      .select()
      .from(subscribers)
      .where(where)
      .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(subscribers).where(where),
    db.select({ all: count() }).from(subscribers),
    db.select({ active: count() }).from(subscribers).where(isNull(subscribers.unsubscribedAt)),
  ]);
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    stats: { total: all, active, unsubscribed: all - active },
  };
}
