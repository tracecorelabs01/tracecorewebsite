"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminUsers, getDb, isDbConfigured } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentAdmin, isLoginBlocked, recordLoginAttempt } from "@/lib/auth/session";
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

export async function logout() {
  const user = await getCurrentAdmin();
  if (user) await logActivity(user, "logout", "session", user.id, `${user.name} signed out`);
  await destroySession();
  redirect("/admin/login");
}
