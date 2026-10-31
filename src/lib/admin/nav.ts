import "server-only";
import { and, count, eq, inArray, lte, ne } from "drizzle-orm";
import { affiliatePayouts, affiliates, getDb, messages, orders, products, reviews } from "@/db";
import type { NavCounts } from "@/components/admin/AdminShell";

/** Sidebar badges: open orders, open messages, reviews awaiting moderation, low stock, partner applications and payout requests. */
export async function getNavCounts(): Promise<NavCounts> {
  const db = getDb();
  const [[o], [m], [r], [l], [a], [p]] = await Promise.all([
    db.select({ n: count() }).from(orders).where(inArray(orders.status, ["pending", "processing"])),
    db.select({ n: count() }).from(messages).where(eq(messages.status, "open")),
    db.select({ n: count() }).from(reviews).where(eq(reviews.status, "pending")),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.trackInventory, true), eq(products.allowBackorder, false), ne(products.status, "archived"), lte(products.stockQty, products.lowStockThreshold))),
    db.select({ n: count() }).from(affiliates).where(eq(affiliates.status, "pending")),
    db.select({ n: count() }).from(affiliatePayouts).where(eq(affiliatePayouts.status, "requested")),
  ]);
  return { orders: o?.n ?? 0, messages: m?.n ?? 0, reviews: r?.n ?? 0, lowStock: l?.n ?? 0, partners: (a?.n ?? 0) + (p?.n ?? 0) };
}
