import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { adminUsers, getDb } from "@/db";
import type { AdminRole } from "@/lib/auth/session";

export const STAFF_ROLES = ["owner", "admin", "staff"] as const satisfies readonly AdminRole[];

export const isStaffRole = (value: string): value is AdminRole => (STAFF_ROLES as readonly string[]).includes(value);

export const isEmail = (value: string) => value.length <= 191 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Why a staff change was refused. Button actions redirect with `?blocked=<key>`; the page shows the message. */
export const STAFF_BLOCKED = {
  self: "You can't change your own role, disable or delete your own account.",
  "last-owner": "There must always be at least one active owner.",
  missing: "That staff member no longer exists.",
} as const;
export type StaffBlock = keyof typeof STAFF_BLOCKED;

export async function listStaff() {
  // ENUM columns sort by declaration order, so owners come first, then admins, then staff.
  return getDb()
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(asc(adminUsers.role), asc(adminUsers.name));
}

/** True when another admin account already uses this (lowercased) email. */
export async function emailInUse(email: string, exceptId?: number) {
  const [row] = await getDb()
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(exceptId ? and(eq(adminUsers.email, email), ne(adminUsers.id, exceptId)) : eq(adminUsers.email, email))
    .limit(1);
  return Boolean(row);
}

/** MySQL duplicate-key error (ER_DUP_ENTRY), including when Drizzle wraps the driver error. */
export function isDuplicateKey(err: unknown) {
  let e: unknown = err;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === "ER_DUP_ENTRY") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
