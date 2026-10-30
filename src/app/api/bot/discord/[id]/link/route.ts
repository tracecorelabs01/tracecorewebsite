// The bot's /track links a Discord account to the orders placed with an email, after a code sent to that email:
// POST {email} emails the code; POST {email, code, username} checks it and links. The bot sends the Discord ID of
// whoever is using /track, so a correct code proves they own both. Linking creates no website account.
// Authenticated with BOT_API_KEY as a bearer token.

import { eq } from "drizzle-orm";
import { customers, getDb, isDbConfigured } from "@/db";
import { customerWithOrders } from "@/lib/account";
import { consumeLoginCode, createLoginCode } from "@/lib/auth/customer";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/auth/session";
import { authorizedBot } from "@/lib/bot-api";
import { emailEnabled } from "@/lib/email";
import { sendLoginCode } from "@/lib/emails/account";

const reply = (ok: boolean, message: string) => Response.json({ ok, message });
const BLOCKED = "Too many attempts. Please wait 15 minutes and try again.";

export async function POST(req: Request, { params }: RouteContext<"/api/bot/discord/[id]/link">) {
  if (!authorizedBot(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return Response.json({ error: "unavailable" }, { status: 503 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; code?: unknown; username?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\d{5,25}$/.test(id) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(false, "Enter the email you ordered with.");
  // Attempts count per Discord account, not per network address: every request comes from the bot's server.
  const who = `discord:${id}`;

  if (body.code === undefined) {
    if (!emailEnabled()) return reply(false, "Linking isn't available right now. Please open a ticket and the team will help.");
    const key = `discord-link:${email}`;
    if (await isLoginBlocked(key, who)) return reply(false, BLOCKED);
    await recordLoginAttempt(key, who, false);
    const c = await customerWithOrders(email);
    if (!c) return reply(false, `We couldn't find any orders for ${email}. Check it's the email you ordered with.`);
    if (!(await sendLoginCode(email, c.firstName || null, await createLoginCode(c.id), "discord"))) {
      return reply(false, "We couldn't send the email just now. Please try again in a minute.");
    }
    return reply(true, `We've emailed a 6-digit code to ${email}. It works once, for 10 minutes.`);
  }

  const key = `discord-link-code:${email}`;
  if (await isLoginBlocked(key, who)) return reply(false, BLOCKED);
  const code = String(body.code).replace(/\D/g, "");
  const c = await customerWithOrders(email);
  const valid = code.length === 6 && Boolean(c) && (await consumeLoginCode(c!.id, code));
  await recordLoginAttempt(key, who, valid);
  if (!valid) return reply(false, "That code is wrong or has expired. Check the newest email, or send a new code.");

  const username = typeof body.username === "string" ? body.username.slice(0, 64) : null;
  // A Discord account belongs to one customer, so linking it here unlinks it from anyone else.
  await getDb().transaction(async (tx) => {
    await tx.update(customers).set({ discordId: null, discordUsername: null }).where(eq(customers.discordId, id));
    await tx.update(customers).set({ discordId: id, discordUsername: username }).where(eq(customers.id, c!.id));
  });
  return reply(true, "Linked.");
}
