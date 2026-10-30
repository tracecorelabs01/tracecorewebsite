// Order lookup for the Discord bot (discord-bot/). Authenticated with BOT_API_KEY as a bearer token.
// With ?email= it only answers when the email matches the order, which is how customers look up their own.

import { and, asc, eq, sum } from "drizzle-orm";
import { getDb, isDbConfigured, loyaltyLedger, orderItems, orders } from "@/db";
import { authorizedBot, botOrder } from "@/lib/bot-api";
import { site } from "@/lib/site";

const NOT_FOUND = () => Response.json({ error: "not_found" }, { status: 404 });

export async function GET(req: Request, { params }: RouteContext<"/api/bot/orders/[number]">) {
  if (!authorizedBot(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return Response.json({ error: "unavailable" }, { status: 503 });

  const number = (await params).number.trim().toUpperCase();
  if (!/^TCL-[A-Z0-9]{6}$/.test(number)) return NOT_FOUND();
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();

  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  // Same answer for a wrong email as for no order, so numbers can't be probed.
  if (!o || (email !== undefined && o.email !== email)) return NOT_FOUND();

  const [items, [points]] = await Promise.all([
    db
      .select({ slug: orderItems.productSlug, name: orderItems.productName, option: orderItems.optionValue, qty: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, o.id))
      .orderBy(asc(orderItems.id)),
    db
      .select({ n: sum(loyaltyLedger.points) })
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.orderId, o.id), eq(loyaltyLedger.kind, "order"))),
  ]);
  return Response.json({
    ...botOrder(o, items, Number(points?.n ?? 0)),
    // For staff (/order): who it's for and where it is in the admin.
    customer: { name: `${o.firstName} ${o.lastName}`.trim(), email: o.email, country: o.country },
    adminUrl: `${site.url}/admin/orders/${o.id}`,
  });
}
