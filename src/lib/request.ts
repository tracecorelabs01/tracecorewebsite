import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP (behind Vercel, Cloudflare, nginx…). Used for rate limiting only. */
export async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (h.get("cf-connecting-ip") ?? forwarded ?? h.get("x-real-ip") ?? "unknown").slice(0, 64);
}

export async function getUserAgent() {
  return (await headers()).get("user-agent")?.slice(0, 255) ?? null;
}
