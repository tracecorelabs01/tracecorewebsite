// Shared by the Discord bot's API routes (/api/bot/*): the BOT_API_KEY check, and an order as the bot shows it.

import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { orders } from "@/db";
import { warrantyEnds, warrantyMonths } from "@/lib/warranty";

export function authorizedBot(req: Request) {
  const key = process.env.BOT_API_KEY;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

type BotItem = { slug: string; name: string; option: string | null; qty: number };

/** An order for its customer: status, items with their warranty end, tracking and points. No address or email. */
export function botOrder(o: typeof orders.$inferSelect, items: BotItem[], points: number) {
  const warrantyStart = o.paymentStatus === "paid" ? (o.deliveredAt ?? o.paidAt) : null;
  return {
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    placedAt: o.createdAt,
    paidAt: o.paidAt,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    totalCents: o.totalCents,
    currency: o.currency,
    tracking: o.trackingNumber || o.trackingCarrier ? { carrier: o.trackingCarrier, number: o.trackingNumber } : null,
    points,
    items: items.map((i) => ({
      name: i.name,
      option: i.option,
      qty: i.qty,
      warrantyUntil: warrantyStart ? warrantyEnds(warrantyStart, warrantyMonths(i.slug)) : null,
    })),
  };
}
