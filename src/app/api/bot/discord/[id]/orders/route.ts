// The Discord bot's /myorders: the orders of the customer who linked this Discord account on the website (by
// signing in with Discord or connecting it on their account page). The bot sends the Discord ID of whoever ran
// the command, so people only ever see their own orders. Authenticated with BOT_API_KEY as a bearer token.

import { eq } from "drizzle-orm";
import { customers, getDb, isDbConfigured } from "@/db";
import { getMyOrder, listMyOrders } from "@/lib/account";
import { authorizedBot } from "@/lib/bot-api";
import { site } from "@/lib/site";

const SHOWN = 10;

export async function GET(req: Request, { params }: RouteContext<"/api/bot/discord/[id]/orders">) {
  if (!authorizedBot(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return Response.json({ error: "unavailable" }, { status: 503 });

  const { id } = await params;
  if (!/^\d{5,25}$/.test(id)) return Response.json({ linked: false });
  const [c] = await getDb().select({ id: customers.id }).from(customers).where(eq(customers.discordId, id)).limit(1);
  if (!c) return Response.json({ linked: false });

  const list = (await listMyOrders(c.id)).slice(0, SHOWN);
  const orders = await Promise.all(
    list.map(async (row) => {
      const { order: o, items } = (await getMyOrder(c.id, row.number))!;
      return {
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        placedAt: o.createdAt,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
        totalCents: o.totalCents,
        currency: o.currency,
        tracking: o.trackingNumber || o.trackingCarrier ? { carrier: o.trackingCarrier, number: o.trackingNumber } : null,
        items: items.map((i) => ({ name: i.productName, option: i.optionValue, qty: i.quantity })),
      };
    }),
  );
  return Response.json({ linked: true, orders, accountUrl: `${site.url}/account` });
}
