// "Set your password" links for staff: random token in the link, SHA-256 of it in password_resets.

import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb, passwordResets } from "@/db";
import { hashToken } from "./session";

type Kind = "customer" | "admin";

/** A new link for this person, valid for `hours`. Asking again replaces any earlier link. */
export async function createResetToken(kind: Kind, subjectId: number, hours = 1) {
  const token = randomBytes(32).toString("base64url");
  const db = getDb();
  await db.delete(passwordResets).where(and(eq(passwordResets.kind, kind), eq(passwordResets.subjectId, subjectId), isNull(passwordResets.usedAt)));
  await db.insert(passwordResets).values({ id: hashToken(token), kind, subjectId, expiresAt: new Date(Date.now() + hours * 3_600_000) });
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, sql`UTC_TIMESTAMP() - INTERVAL 7 DAY`));
  return token;
}

const live = (kind: Kind, token: string) =>
  and(eq(passwordResets.id, hashToken(token)), eq(passwordResets.kind, kind), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, sql`UTC_TIMESTAMP()`));

/** Whether a link still works, without using it (for showing the form or an "expired" message). */
export async function isResetTokenLive(kind: Kind, token: string) {
  if (!token) return false;
  const [row] = await getDb().select({ id: passwordResets.id }).from(passwordResets).where(live(kind, token)).limit(1);
  return Boolean(row);
}

/** Uses a link. Returns who it's for, or null if it's unknown, already used or expired. */
export async function consumeResetToken(kind: Kind, token: string) {
  if (!token) return null;
  const db = getDb();
  const [res] = await db.update(passwordResets).set({ usedAt: new Date() }).where(live(kind, token));
  if (!res.affectedRows) return null;
  const [row] = await db.select({ subjectId: passwordResets.subjectId }).from(passwordResets).where(eq(passwordResets.id, hashToken(token))).limit(1);
  return row?.subjectId ?? null;
}
