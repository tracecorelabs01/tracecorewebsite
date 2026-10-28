"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { adminUsers, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { emailInUse, isDuplicateKey, isEmail } from "@/lib/admin/staff";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { createSession, requireAdmin, revokeSessions } from "@/lib/auth/session";
import { revokeOtherSessions } from "@/lib/auth/sessions-admin";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const EMAIL_TAKEN = "Another account already uses this email.";

export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const name = str(fd.get("name"));
  const email = str(fd.get("email")).toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required.";
  else if (name.length > 120) fieldErrors.name = "Keep your name under 120 characters.";
  if (!isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  else if (email !== user.email && (await emailInUse(email, user.id))) fieldErrors.email = EMAIL_TAKEN;
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const changed = [...(name !== user.name ? ["name"] : []), ...(email !== user.email ? ["email"] : [])];
  if (!changed.length) return { ok: true, message: "Nothing to update." };
  try {
    await getDb().update(adminUsers).set({ name, email }).where(eq(adminUsers.id, user.id));
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { email: EMAIL_TAKEN } };
  }
  await logActivity({ ...user, name }, "update", "staff", user.id, `${name} updated their ${changed.join(" and ")}`);
  refresh();
  return { ok: true, message: "Profile saved." };
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const current = String(fd.get("currentPassword") ?? "");
  const next = String(fd.get("newPassword") ?? "");
  const confirmation = String(fd.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.currentPassword = "Enter your current password.";
  if (next.length < PASSWORD_MIN) fieldErrors.newPassword = `Use at least ${PASSWORD_MIN} characters.`;
  else if (next === current) fieldErrors.newPassword = "Choose a different password from your current one.";
  else if (confirmation !== next) fieldErrors.confirmPassword = "The passwords don't match.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const db = getDb();
  const [row] = await db.select({ passwordHash: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return { ok: false, message: "Your current password is incorrect.", fieldErrors: { currentPassword: "That isn't your current password." } };
  }

  await db
    .update(adminUsers)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(adminUsers.id, user.id));
  // Sign out every device, then start a fresh session so this browser stays signed in.
  await revokeSessions(user.id);
  await createSession(user.id);
  await logActivity(user, "password", "staff", user.id, `${user.name} changed their password`);
  return { ok: true, message: "Password changed — every other device has been signed out." };
}

export async function signOutOtherSessions() {
  const user = await requireAdmin("staff");
  await revokeOtherSessions(user.id);
  await logActivity(user, "revoke", "session", user.id, `${user.name} signed out their other devices`);
  refresh();
}
