// Releases stock held by unpaid orders once the reservation time set in /admin/settings runs out.
// Runs on a timer from src/instrumentation.ts.

import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { discountCodes, getDb, orderEvents, orders, settings } from "@/db";
import { STORE_SETTINGS_KEY } from "@/lib/admin/settings";
import { resolveSettings } from "@/lib/settings";
import { emailOrder } from "@/lib/emails/orders";
import { plural, restockItems, type NewEvent } from "./order-stock";

/** Cancel pending, unpaid orders older than the reservation time; restock them and give back their discount use. Returns how many were released. */
export async function releaseExpiredOrders() {
  const db = getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1);
  const hours = resolveSettings(row?.value).reservationHours;
  if (!hours) return 0;

  const expired = and(eq(orders.status, "pending"), eq(orders.paymentStatus, "unpaid"), lt(orders.createdAt, sql`UTC_TIMESTAMP() - INTERVAL ${hours} HOUR`));
  const stale = await db.select({ id: orders.id }).from(orders).where(expired).limit(100);

  let released = 0;
  for (const { id } of stale) {
    const done = await db.transaction(async (tx) => {
      // Re-check under lock: staff may have marked it paid or changed it since the scan.
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), expired)).limit(1).for("update");
      if (!order) return 0;

      const events: NewEvent[] = [{ type: "status", message: `Status changed: pending → cancelled (unpaid after ${plural(hours, "hour")}, reservation released automatically)` }];
      const restock = await restockItems(tx, id);
      if (restock.event) events.push(restock.event);
      if (order.discountCode) {
        const [res] = await tx
          .update(discountCodes)
          .set({ usedCount: sql`${discountCodes.usedCount} - 1` })
          .where(and(eq(discountCodes.code, order.discountCode), gt(discountCodes.usedCount, 0)));
        if (res.affectedRows) events.push({ type: "discount", message: `Gave back one use of discount code ${order.discountCode}` });
      }
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, id));
      await tx.insert(orderEvents).values(events.map((e) => ({ orderId: id, type: e.type, message: e.message.slice(0, 500) })));
      return 1;
    });
    released += done;
    if (done) await emailOrder(id, "cancelled");
  }
  return released;
}
