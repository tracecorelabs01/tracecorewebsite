import "server-only";
import { and, eq, inArray, sum } from "drizzle-orm";
import { customers, discountCodes, getDb, loyaltyLedger, loyaltyOffers, orders, products, settings } from "@/db";
import type { Tx } from "@/lib/admin/order-stock";

// Loyalty points: earned on paid orders, spent on offers set up in /admin/loyalty. Every change is a
// row in loyalty_ledger and a customer's balance is their sum, so history is never rewritten.

/** Row key in the `settings` table. */
export const LOYALTY_KEY = "loyalty";

export interface LoyaltyConfig {
  /** Off: nothing is earned and offers can't be redeemed (balances are kept). */
  enabled: boolean;
  /** Points per $1 of the order's products after discounts (shipping doesn't earn). */
  pointsPerDollar: number;
}

export const defaultLoyalty: LoyaltyConfig = { enabled: true, pointsPerDollar: 100 };
export const MAX_POINTS_PER_DOLLAR = 100_000;

type Db = Tx | ReturnType<typeof getDb>;

export function resolveLoyalty(stored: unknown): LoyaltyConfig {
  const s = stored && typeof stored === "object" ? (stored as Partial<LoyaltyConfig>) : {};
  const rate = Number(s.pointsPerDollar);
  return {
    enabled: typeof s.enabled === "boolean" ? s.enabled : defaultLoyalty.enabled,
    pointsPerDollar: Number.isInteger(rate) && rate >= 0 && rate <= MAX_POINTS_PER_DOLLAR ? rate : defaultLoyalty.pointsPerDollar,
  };
}

export async function getLoyaltyConfig(db: Db = getDb()) {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LOYALTY_KEY)).limit(1);
  return resolveLoyalty(row?.value);
}

/** Points an order earns at a given rate. */
export const pointsFor = (o: { subtotalCents: number; discountCents: number }, pointsPerDollar: number) => Math.floor((Math.max(0, o.subtotalCents - o.discountCents) * pointsPerDollar) / 100);

export async function pointsBalance(customerId: number, db: Db = getDb()) {
  const [row] = await db.select({ n: sum(loyaltyLedger.points) }).from(loyaltyLedger).where(eq(loyaltyLedger.customerId, customerId));
  return Number(row?.n ?? 0);
}

/**
 * Make an order's points match its state, inside the transaction that changed it: earned once it's paid,
 * taken back if it's then refunded, cancelled or marked unpaid. Returns the change (0 if none).
 */
export async function syncOrderPoints(tx: Tx, orderId: number) {
  const [o] = await tx
    .select({ number: orders.number, customerId: orders.customerId, status: orders.status, paymentStatus: orders.paymentStatus, subtotalCents: orders.subtotalCents, discountCents: orders.discountCents })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o?.customerId) return 0;
  const [held] = await tx
    .select({ n: sum(loyaltyLedger.points) })
    .from(loyaltyLedger)
    .where(and(eq(loyaltyLedger.orderId, orderId), eq(loyaltyLedger.kind, "order")));
  const current = Number(held?.n ?? 0);
  const earning = o.paymentStatus === "paid" && o.status !== "cancelled" && o.status !== "refunded";

  let change = 0;
  if (earning && current === 0) {
    // Earned at the rate in force when the money arrived; later rate changes don't touch it.
    const config = await getLoyaltyConfig(tx);
    if (config.enabled) change = pointsFor(o, config.pointsPerDollar);
  } else if (!earning && current !== 0) {
    change = -current;
  }
  if (change) {
    const why = o.status === "cancelled" ? "cancelled" : o.paymentStatus === "refunded" || o.status === "refunded" ? "refunded" : "no longer paid";
    await tx.insert(loyaltyLedger).values({ customerId: o.customerId, points: change, kind: "order", orderId, note: change > 0 ? `Order ${o.number}` : `Order ${o.number} ${why}` });
  }
  return change;
}

function rewardCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "PTS-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Spend points on an offer: issues a single-use discount code for this customer. */
export async function redeemOffer(customerId: number, offerId: number): Promise<{ ok: true; code: string; title: string } | { ok: false; message: string }> {
  const config = await getLoyaltyConfig();
  if (!config.enabled) return { ok: false, message: "Rewards are paused right now." };
  return getDb().transaction(async (tx) => {
    // Lock the customer so two redemptions at once can't spend the same points.
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update");
    const [offer] = await tx
      .select()
      .from(loyaltyOffers)
      .where(and(eq(loyaltyOffers.id, offerId), eq(loyaltyOffers.isActive, true)))
      .limit(1);
    if (!offer) return { ok: false as const, message: "That offer isn't available any more." };
    const balance = await pointsBalance(customerId, tx);
    if (balance < offer.pointsCost) return { ok: false as const, message: `You need ${(offer.pointsCost - balance).toLocaleString("en-US")} more points for this offer.` };

    let codeId = 0;
    let code = "";
    for (let attempt = 0; attempt < 5 && !codeId; attempt++) {
      code = rewardCode();
      const [dupe] = await tx.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code)).limit(1);
      if (dupe) continue;
      [{ id: codeId }] = await tx
        .insert(discountCodes)
        .values({ code, kind: offer.kind, value: offer.value, minSubtotalCents: offer.minSubtotalCents, productIds: offer.productIds, maxUses: 1, isActive: true, customerId })
        .$returningId();
    }
    if (!codeId) throw new Error("Couldn't create a unique reward code");
    await tx.insert(loyaltyLedger).values({ customerId, points: -offer.pointsCost, kind: "redeem", discountCodeId: codeId, note: offer.title.slice(0, 255) });
    return { ok: true as const, code, title: offer.title };
  });
}

/** "Ferrum and MAKCU"; long lists end in "and 3 more". */
export function listNames(names: string[]) {
  const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  return new Intl.ListFormat("en-US", { type: "conjunction" }).format(shown);
}

/** Offers or codes with the names of the products they're limited to (`productNames`, empty for the whole order). Deleted products are left out. */
export async function withProductNames<T extends { productIds: number[] | null }>(rows: T[]) {
  const ids = [...new Set(rows.flatMap((r) => r.productIds ?? []))];
  const found = ids.length ? await getDb().select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids)) : [];
  const names = new Map(found.map((p) => [p.id, p.name]));
  return rows.map((r) => ({ ...r, productNames: (r.productIds ?? []).flatMap((id) => names.get(id) ?? []) }));
}

/** "$5 off", "10% off Ferrum", "10% off orders over $200". Values as stored: percent or cents. */
export function rewardLabel(r: { kind: "percent" | "fixed"; value: number; minSubtotalCents?: number; productNames?: string[] }) {
  const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
  const off = r.kind === "percent" ? `${r.value}% off` : `${dollars(r.value)} off`;
  const what = r.productNames?.length ? ` ${listNames(r.productNames)}` : "";
  const min = r.minSubtotalCents ? `${what ? " on" : ""} orders over ${dollars(r.minSubtotalCents)}` : "";
  return `${off}${what}${min}`;
}
