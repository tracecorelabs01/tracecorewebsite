import "server-only";
import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { getDb, messages, orders } from "@/db";

const PAGE_SIZE = 25;

export type MessageFilter = "open" | "closed" | "all";

export async function listMessages({ q, status, page }: { q?: string; status: MessageFilter; page: number }) {
  const db = getDb();
  const filters: SQL[] = [];
  if (status !== "all") filters.push(eq(messages.status, status));
  if (q) filters.push(or(like(messages.name, `%${q}%`), like(messages.email, `%${q}%`), like(messages.topic, `%${q}%`), like(messages.orderNumber, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ total }], statusCounts] = await Promise.all([
    db
      .select({
        id: messages.id,
        name: messages.name,
        email: messages.email,
        topic: messages.topic,
        orderNumber: messages.orderNumber,
        status: messages.status,
        createdAt: messages.createdAt,
        preview: sql<string>`left(${messages.body}, 160)`,
      })
      .from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(messages).where(where),
    db.select({ status: messages.status, n: count() }).from(messages).groupBy(messages.status),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Record<string, number>;
  const all = statusCounts.reduce((n, s) => n + s.n, 0);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts: { ...counts, all } as Record<string, number> };
}

/** A message plus the order it mentions, when the number matches one. */
export async function getMessage(id: number) {
  const db = getDb();
  const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!message) return null;
  // Customers type order numbers by hand ("#tcl-ab12cd"); the column collation ignores case.
  const number = message.orderNumber?.trim().replace(/^#\s*/, "");
  const [order] = number
    ? await db.select({ id: orders.id, number: orders.number, status: orders.status }).from(orders).where(eq(orders.number, number)).limit(1)
    : [];
  return { message, order: order ?? null };
}
