"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { adminUsers, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { emailInUse, isDuplicateKey, isEmail, isStaffRole, STAFF_BLOCKED, type StaffBlock } from "@/lib/admin/staff";
import { hashPassword, PASSWORD_MIN } from "@/lib/auth/password";
import { requireAdmin, revokeSessions, type AdminRole } from "@/lib/auth/session";

type Member = { id: number; name: string; email: string; role: AdminRole; isActive: boolean };
type Change = { role: AdminRole } | { isActive: boolean } | "delete";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/**
 * Applies a change to another staff member with every admin row locked (the table is tiny),
 * so two owners acting at once can't leave the store without an active owner.
 * Returns the member as they were before the change.
 */
async function applyChange(userId: number, change: Change): Promise<{ member: Member } | { blocked: StaffBlock }> {
  return getDb().transaction(async (tx) => {
    const members = await tx
      .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, isActive: adminUsers.isActive })
      .from(adminUsers)
      .orderBy(asc(adminUsers.id))
      .for("update");
    const member = members.find((m) => m.id === userId);
    if (!member) return { blocked: "missing" as const };

    const after = change === "delete" ? null : { ...member, ...change };
    const removesOwner = member.role === "owner" && member.isActive && !(after?.role === "owner" && after.isActive);
    if (removesOwner && !members.some((m) => m.id !== userId && m.role === "owner" && m.isActive)) return { blocked: "last-owner" as const };

    if (change === "delete") await tx.delete(adminUsers).where(eq(adminUsers.id, userId));
    else await tx.update(adminUsers).set(change).where(eq(adminUsers.id, userId));
    return { member };
  });
}

export async function createStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("owner");
  const name = str(fd.get("name"));
  const email = str(fd.get("email")).toLowerCase();
  const role = str(fd.get("role"));
  const password = String(fd.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required.";
  else if (name.length > 120) fieldErrors.name = "Keep the name under 120 characters.";
  if (!isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  else if (await emailInUse(email)) fieldErrors.email = "Someone on the team already uses this email.";
  if (!isStaffRole(role)) fieldErrors.role = "Choose a role.";
  if (password.length < PASSWORD_MIN) fieldErrors.password = `Use at least ${PASSWORD_MIN} characters.`;
  if (Object.keys(fieldErrors).length || !isStaffRole(role)) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  let id: number;
  try {
    [{ id }] = await getDb()
      .insert(adminUsers)
      .values({ name, email, role, passwordHash: await hashPassword(password) })
      .$returningId();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { email: "Someone on the team already uses this email." } };
  }
  await logActivity(user, "create", "staff", id, `Added ${name} (${email}) as ${role}`);
  refresh();
  return { ok: true, message: `${name} can now sign in at /admin/login with the temporary password.` };
}

export async function changeStaffRole(userId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("owner");
  const role = str(fd.get("role"));
  if (!isId(userId) || !isStaffRole(role)) return { ok: false, message: "Choose a role." };
  if (userId === user.id) return { ok: false, message: "You can't change your own role." };

  const result = await applyChange(userId, { role });
  if ("blocked" in result) return { ok: false, message: STAFF_BLOCKED[result.blocked] };
  const { member } = result;
  if (member.role === role) return { ok: true, message: "No change." };
  await logActivity(user, "role", "staff", userId, `Changed ${member.name}'s role from ${member.role} to ${role}`);
  refresh();
  return { ok: true, message: `Role changed to ${role}.` };
}

/** Disable (signs them out everywhere) or re-enable another member's account. */
export async function setStaffActive(userId: number, active: boolean) {
  const user = await requireAdmin("owner");
  if (!isId(userId)) return;
  if (userId === user.id) redirect("/admin/staff?blocked=self");
  const isActive = active === true;

  const result = await applyChange(userId, { isActive });
  if ("blocked" in result) redirect(`/admin/staff?blocked=${result.blocked}`);
  const { member } = result;
  if (!isActive) await revokeSessions(userId);
  if (member.isActive !== isActive) await logActivity(user, isActive ? "enable" : "disable", "staff", userId, `${isActive ? "Enabled" : "Disabled"} ${member.name}'s account`);
  refresh();
}

/** Set a new temporary password for another member and sign them out everywhere. */
export async function resetStaffPassword(userId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("owner");
  if (!isId(userId)) return { ok: false, message: STAFF_BLOCKED.missing };
  if (userId === user.id) return { ok: false, message: "Change your own password on the Account page." };
  const password = String(fd.get("password") ?? "");
  if (password.length < PASSWORD_MIN) return { ok: false, message: `Use at least ${PASSWORD_MIN} characters.`, fieldErrors: { password: `At least ${PASSWORD_MIN} characters.` } };

  const db = getDb();
  const [member] = await db.select({ name: adminUsers.name }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  if (!member) return { ok: false, message: STAFF_BLOCKED.missing };
  await db
    .update(adminUsers)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(adminUsers.id, userId));
  await revokeSessions(userId);
  await logActivity(user, "password", "staff", userId, `Reset the password for ${member.name}`);
  return { ok: true, message: `Password reset — ${member.name} has been signed out everywhere.` };
}

export async function deleteStaff(userId: number) {
  const user = await requireAdmin("owner");
  if (!isId(userId)) return;
  if (userId === user.id) redirect("/admin/staff?blocked=self");

  // Their sessions are removed by the foreign key; their activity log entries are kept (shown as System).
  const result = await applyChange(userId, "delete");
  if ("blocked" in result) redirect(`/admin/staff?blocked=${result.blocked}`);
  await logActivity(user, "delete", "staff", userId, `Removed ${result.member.name} (${result.member.email})`);
  refresh();
}
