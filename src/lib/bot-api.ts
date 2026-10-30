// Shared check for the Discord bot's API routes (/api/bot/*): BOT_API_KEY as a bearer token.

import "server-only";
import { timingSafeEqual } from "node:crypto";

export function authorizedBot(req: Request) {
  const key = process.env.BOT_API_KEY;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
