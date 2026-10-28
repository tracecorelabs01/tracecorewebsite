import "server-only";
import { headers } from "next/headers";

/**
 * Client IP for rate limiting and audit logs. Hostinger's CDN appends the visitor's
 * address to X-Forwarded-For, so only the last entry is trustworthy: anything before
 * it was sent by the client. CF-Connecting-IP is ignored because a client can set it.
 */
export async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return (forwarded || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function getUserAgent() {
  return (await headers()).get("user-agent")?.slice(0, 255) ?? null;
}
