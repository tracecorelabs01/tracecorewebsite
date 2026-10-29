// New paid orders posted to the staff channel through a Discord webhook (DISCORD_ORDER_WEBHOOK_URL).
// Best effort: an order never waits on, or fails because of, Discord.

import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, orderItems, orders } from "@/db";
import { money } from "@/lib/admin/format";
import { site } from "@/lib/site";

export async function announcePaidOrder(orderId: number) {
  const url = process.env.DISCORD_ORDER_WEBHOOK_URL;
  if (!url) return;
  try {
    const db = getDb();
    const [[o], items] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, orderId)).limit(1),
      db
        .select({ name: orderItems.productName, option: orderItems.optionValue, qty: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.id)),
    ]);
    if (!o) return;
    const lines = items.map((i) => `${i.qty} × ${i.name}${i.option ? ` (${i.option})` : ""}`).join("\n");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Tracer",
        avatar_url: `${site.url}/brand/logo-mark.webp`,
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `New paid order ${o.number}`,
            url: `${site.url}/admin/orders/${o.id}`,
            color: 0xff3d00,
            fields: [
              { name: "Total", value: money(o.totalCents, o.currency), inline: true },
              { name: "Customer", value: `${o.firstName} ${o.lastName}`.trim() || o.email, inline: true },
              { name: "Ship to", value: o.country, inline: true },
              { name: "Items", value: lines.slice(0, 1000) || "None" },
            ],
            footer: { text: "TraceCore Lab" },
            timestamp: (o.paidAt ?? new Date()).toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error("[discord] order webhook", res.status, await res.text());
  } catch (err) {
    console.error("[discord] order webhook", err);
  }
}
