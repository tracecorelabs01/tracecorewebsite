"use server";

import { refresh } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, subscribers } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/session";

/** Unsubscribe (subscribed = false) or resubscribe (true). No-op when already in that state. */
export async function setSubscribed(subscriberId: number, subscribed: boolean) {
  const user = await requireAdmin("staff");
  if (!Number.isInteger(subscriberId) || typeof subscribed !== "boolean") return;
  const db = getDb();
  const [s] = await db.select({ email: subscribers.email }).from(subscribers).where(eq(subscribers.id, subscriberId)).limit(1);
  if (s) {
    const [res] = await db
      .update(subscribers)
      .set({ unsubscribedAt: subscribed ? null : new Date() })
      .where(and(eq(subscribers.id, subscriberId), subscribed ? isNotNull(subscribers.unsubscribedAt) : isNull(subscribers.unsubscribedAt)));
    if (res.affectedRows > 0) {
      await logActivity(user, subscribed ? "resubscribe" : "unsubscribe", "subscriber", subscriberId, `${subscribed ? "Resubscribed" : "Unsubscribed"} ${s.email}`);
    }
  }
  refresh();
}

export async function deleteSubscriber(subscriberId: number) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(subscriberId)) return;
  const [res] = await getDb().delete(subscribers).where(eq(subscribers.id, subscriberId));
  // Deletion is usually an erasure request, so the address itself is not copied into the log.
  if (res.affectedRows > 0) await logActivity(user, "delete", "subscriber", subscriberId, "Deleted a subscriber and their email address");
  refresh();
}
