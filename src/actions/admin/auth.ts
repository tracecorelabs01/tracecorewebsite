"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminUsers, getDb, isDbConfigured } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { consumeResetToken, createResetToken } from "@/lib/auth/reset";
import { createSession, destroySession, getCurrentAdmin, hashToken, isLoginBlocked, recordLoginAttempt, revokeSessions } from "@/lib/auth/session";
import { url } from "@/lib/email";
import { sendPasswordChanged, sendPasswordReset } from "@/lib/emails/account";
import { getClientIp } from "@/lib/request";

export type LoginState = { error: string; email?: string } | null;

// Equalises timing when the email doesn't exist.
let dummyHash: Promise<string> | null = null;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isDbConfigured()) return { error: "No database is connected yet. Add DATABASE_URL to your environment." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const ip = await getClientIp();
  if (await isLoginBlocked(email, ip)) return { error: "Too many attempts. Please wait 15 minutes and try again.", email };

  const db = getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  let ok = false;
  if (user) ok = user.isActive && (await verifyPassword(password, user.passwordHash));
  else await verifyPassword(password, await (dummyHash ??= hashPassword("timing-equaliser")));

  await recordLoginAttempt(email, ip, ok);
  if (!ok || !user) return { error: "Incorrect email or password.", email };

  await createSession(user.id);
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  await logActivity({ id: user.id, name: user.name, email: user.email, role: user.role }, "login", "session", user.id, `${user.name} signed in`);
  redirect(safeNext(formData.get("next")));
}

export type ResetState = { ok: boolean; message: string; field?: "email" | "password" | "confirm" } | null;

/** Emails a reset link to an active staff member. The answer is the same whether or not the email exists. */
export async function requestAdminReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!isDbConfigured()) return { ok: false, message: "No database is connected yet." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter your work email.", field: "email" };
  const key = `admin-reset:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return { ok: false, message: "Too many attempts. Please wait 15 minutes and try again." };
  await recordLoginAttempt(key, ip, false);

  const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (user?.isActive) {
    const token = await createResetToken("admin", user.id);
    await sendPasswordReset({ to: email, name: user.name, resetUrl: url(`/admin/reset?token=${token}`), key: hashToken(token).slice(0, 24) });
    await logActivity({ id: user.id, name: user.name, email: user.email, role: user.role }, "password", "staff", user.id, `${user.name} asked for a password reset link`);
  }
  return { ok: true, message: "If that email belongs to an active team member, a reset link is on its way. It works for one hour." };
}

export async function resetAdminPassword(token: string, _prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!isDbConfigured()) return { ok: false, message: "No database is connected yet." };
  const password = String(formData.get("password") ?? "");
  if (password.length < PASSWORD_MIN) return { ok: false, message: `Use at least ${PASSWORD_MIN} characters.`, field: "password" };
  if (String(formData.get("confirm") ?? "") !== password) return { ok: false, message: "The passwords don't match.", field: "confirm" };

  const userId = await consumeResetToken("admin", String(token));
  if (!userId) return { ok: false, message: "This link has expired or was already used. Ask for a new one." };
  const db = getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  if (!user?.isActive) return { ok: false, message: "This account is disabled. Ask the store owner." };

  await db.update(adminUsers).set({ passwordHash: await hashPassword(password) }).where(eq(adminUsers.id, userId));
  await revokeSessions(userId);
  await logActivity({ id: user.id, name: user.name, email: user.email, role: user.role }, "password", "staff", user.id, `${user.name} reset their password by email`);
  await sendPasswordChanged(user.email, user.name);
  redirect("/admin/login?reset=1");
}

export async function logout() {
  const user = await getCurrentAdmin();
  if (user) await logActivity(user, "logout", "session", user.id, `${user.name} signed out`);
  await destroySession();
  redirect("/admin/login");
}
