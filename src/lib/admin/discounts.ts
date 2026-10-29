import "server-only";
import { desc, eq, isNull } from "drizzle-orm";
import { discountCodes, getDb } from "@/db";
import { money } from "@/lib/admin/format";

export type Discount = typeof discountCodes.$inferSelect;
export type DiscountState = "active" | "scheduled" | "expired" | "used-up" | "disabled";

/** Every code, newest first. Stores keep a handful of codes, so there's no paging. */
export async function listDiscounts() {
  // Single-use loyalty reward codes belong to one customer and are shown on their page, not here.
  return getDb().select().from(discountCodes).where(isNull(discountCodes.customerId)).orderBy(desc(discountCodes.createdAt), desc(discountCodes.id));
}

export async function getDiscount(id: number) {
  const [row] = await getDb().select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
  return row ?? null;
}

/** Where a code stands right now — the same rules checkout applies (discountError in src/actions/store.ts). */
export function discountState(d: Pick<Discount, "isActive" | "startsAt" | "endsAt" | "maxUses" | "usedCount">, now = new Date()): DiscountState {
  if (!d.isActive) return "disabled";
  if (d.endsAt && d.endsAt <= now) return "expired";
  if (d.maxUses != null && d.usedCount >= d.maxUses) return "used-up";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  return "active";
}

/** "15% off" or "$20.00 off". */
export function discountLabel(d: Pick<Discount, "kind" | "value">) {
  return d.kind === "percent" ? `${d.value}% off` : `${money(d.value)} off`;
}
