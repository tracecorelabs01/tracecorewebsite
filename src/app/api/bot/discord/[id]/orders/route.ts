// The Discord bot's /track: the orders of the customer this Discord account is linked to (linked in Discord with an
// email code, or by signing in to the website with Discord). The bot sends the Discord ID of whoever is using it,
// so people only ever see their own orders. Authenticated with BOT_API_KEY as a bearer token.

import { eq } from "drizzle-orm";
import { customers, getDb, isDbConfigured } from "@/db";
import { getMyOrder, listMyOrders } from "@/lib/account";
import { authorizedBot, botOrder } from "@/lib/bot-api";

const SHOWN = 25; // a Discord select menu's limit

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
      const { order, items, points } = (await getMyOrder(c.id, row.number))!;
      return botOrder(order, items.map((i) => ({ slug: i.productSlug, name: i.productName, option: i.optionValue, qty: i.quantity })), points);
    }),
  );
  return Response.json({ linked: true, orders });
}
