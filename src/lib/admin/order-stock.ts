// Order stock helpers shared by the admin order actions and the unpaid-order sweep.
// Kept out of the "use server" file: every export there becomes a public endpoint.

import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, orderEvents, orderItems, products } from "@/db";

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export type NewEvent = { type: string; message: string };

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function wasRestocked(tx: Tx, orderId: number) {
  const [row] = await tx
    .select({ id: orderEvents.id })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), eq(orderEvents.type, "restock")))
    .limit(1);
  return Boolean(row);
}

/** Put the order's tracked items back in stock. Runs at most once per order — reopening an order doesn't deduct stock again. */
export async function restockItems(tx: Tx, orderId: number): Promise<{ units: number; event?: NewEvent; skipped?: string }> {
  if (await wasRestocked(tx, orderId)) return { units: 0, skipped: "Its items were already restocked earlier." };
  const lines = await tx
    .select({ productId: products.id, name: orderItems.productName, quantity: orderItems.quantity })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(and(eq(orderItems.orderId, orderId), eq(products.trackInventory, true)));
  if (!lines.length) return { units: 0, skipped: "No tracked items to restock." };

  const perProduct = new Map<number, number>();
  for (const l of lines) perProduct.set(l.productId, (perProduct.get(l.productId) ?? 0) + l.quantity);
  for (const [productId, qty] of perProduct) {
    await tx
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${qty}` })
      .where(eq(products.id, productId));
  }
  const units = lines.reduce((n, l) => n + l.quantity, 0);
  return { units, event: { type: "restock", message: `Restocked ${plural(units, "unit")}: ${lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}` } };
}
