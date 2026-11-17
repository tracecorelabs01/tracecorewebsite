// New paid orders posted to the staff channel through a Discord webhook (DISCORD_ORDER_WEBHOOK_URL).
// Best effort: an order never waits on, or fails because of, Discord.

import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, orderItems, orders } from "@/db";
import { money } from "@/lib/admin/format";
import { orderCopyText } from "@/lib/admin/orders";
import { site } from "@/lib/site";

export async function announcePaidOrder(orderId: number) {
  const url = process.env.DISCORD_ORDER_WEBHOOK_URL;
  if (!url) return;
  try {
    const db = getDb();
    const [[o], items] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, orderId)).limit(1),
      db
        .select({ productName: orderItems.productName, optionValue: orderItems.optionValue, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.id)),
    ]);
    if (!o) return;
    // Their backticks are swapped out so they can't end the code block early; Discord allows 2,000 characters.
    const text = orderCopyText(o, items).replaceAll("`", "'");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Tracer",
        avatar_url: `${site.url}/brand/logo-mark.webp`,
        allowed_mentions: { parse: [] },
        // A code block: Discord gives it a copy button, and nothing the customer typed is read as formatting.
        content: `\`\`\`\n${text.length > 1900 ? `${text.slice(0, 1900)}\n…` : text}\n\`\`\``,
        embeds: [
          {
            title: `New paid order ${o.number}`,
            url: `${site.url}/admin/orders/${o.id}`,
            color: 0xff3d00,
            fields: [
              { name: "Total", value: money(o.totalCents, o.currency), inline: true },
              { name: "Customer", value: `${o.firstName} ${o.lastName}`.trim() || o.email, inline: true },
              { name: "Ship to", value: o.country, inline: true },
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
