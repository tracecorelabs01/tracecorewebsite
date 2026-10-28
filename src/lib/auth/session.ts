import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { adminSessions, adminUsers, getDb, isDbConfigured, loginAttempts } from "@/db";
import { getClientIp, getUserAgent } from "@/lib/request";

export const SESSION_COOKIE = "tcl_admin";
const SESSION_TTL_DAYS = 14;

export type AdminRole = "owner" | "admin" | "staff";
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
}

const RANK: Record<AdminRole, number> = { staff: 1, admin: 2, owner: 3 };

/** owner > admin > staff */
export function hasRole(user: Pick<AdminUser, "role">, min: AdminRole) {
  return RANK[user.role] >= RANK[min];
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function cookieIsSecure() {
  if (process.env.NODE_ENV !== "production") return false;
  const host = (await headers()).get("host") ?? "";
  return !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const db = getDb();
  await db.insert(adminSessions).values({ id: hashToken(token), userId, expiresAt, ip: await getClientIp(), userAgent: await getUserAgent() });
  // Opportunistic cleanup of expired sessions.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, sql`UTC_TIMESTAMP()`));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await cookieIsSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && isDbConfigured()) await getDb().delete(adminSessions).where(eq(adminSessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (password change, deactivation). */
export async function revokeSessions(userId: number) {
  await getDb().delete(adminSessions).where(eq(adminSessions.userId, userId));
}

/** The signed-in admin for this request, or null. Deduped per request. */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  if (!isDbConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, isActive: adminUsers.isActive })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(and(eq(adminSessions.id, hashToken(token)), gt(adminSessions.expiresAt, sql`UTC_TIMESTAMP()`)))
    .limit(1);
  if (!row || !row.isActive) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

/** Use at the top of every admin page and Server Action. Redirects when not allowed. */
export async function requireAdmin(min: AdminRole = "staff"): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  if (!hasRole(user, min)) redirect("/admin?denied=1");
  return user;
}

/* ───────────── login rate limiting ───────────── */

const WINDOW = sql`UTC_TIMESTAMP() - INTERVAL 15 MINUTE`;

export async function isLoginBlocked(email: string, ip: string) {
  const db = getDb();
  const [[byIp], [byEmail]] = await Promise.all([
    db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, WINDOW))),
    db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, WINDOW))),
  ]);
  return (byIp?.n ?? 0) >= 20 || (byEmail?.n ?? 0) >= 6;
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  const db = getDb();
  await db.insert(loginAttempts).values({ email: email.slice(0, 191), ip, success });
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, sql`UTC_TIMESTAMP() - INTERVAL 30 DAY`));
}
