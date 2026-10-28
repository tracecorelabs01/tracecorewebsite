import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { adminSessions, getDb } from "@/db";
import { SESSION_COOKIE } from "./session";

// Session ids are the SHA-256 of the cookie token, exactly as session.ts stores them.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Hashed id of this browser's session, or null without a session cookie. */
export async function getCurrentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** A user's unexpired sessions, newest first, flagging the one belonging to this browser. Ids are not returned. */
export async function listActiveSessions(userId: number) {
  const [rows, currentId] = await Promise.all([
    getDb()
      .select({ id: adminSessions.id, ip: adminSessions.ip, userAgent: adminSessions.userAgent, createdAt: adminSessions.createdAt, expiresAt: adminSessions.expiresAt })
      .from(adminSessions)
      .where(and(eq(adminSessions.userId, userId), gt(adminSessions.expiresAt, sql`UTC_TIMESTAMP()`)))
      .orderBy(desc(adminSessions.createdAt)),
    getCurrentSessionId(),
  ]);
  return rows.map(({ id, ...session }) => ({ ...session, current: id === currentId }));
}

/** Sign a user out everywhere except this browser. */
export async function revokeOtherSessions(userId: number) {
  const currentId = await getCurrentSessionId();
  await getDb()
    .delete(adminSessions)
    .where(currentId ? and(eq(adminSessions.userId, userId), ne(adminSessions.id, currentId)) : eq(adminSessions.userId, userId));
}
