"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { customers, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { isDuplicateKey, isEmail } from "@/lib/admin/staff";
import { revokeCustomerSessions } from "@/lib/auth/customer";
import { hashPassword, PASSWORD_MIN } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

const NOTES_MAX = 5000;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function passwordError(password: string) {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > 200) return "Use 200 characters or fewer.";
}

export async function saveCustomerNotes(customerId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const notes = String(fd.get("notes") ?? "")
    .trim()
    .replace(/\r\n?/g, "\n");
  if (notes.length > NOTES_MAX) return { ok: false, message: "Those notes are too long.", fieldErrors: { notes: `Keep notes under ${NOTES_MAX.toLocaleString("en-US")} characters.` } };

  const db = getDb();
  const [customer] = await db.select({ email: customers.email, notes: customers.notes }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return { ok: false, message: "Customer not found." };
  if ((notes || null) === customer.notes) return { ok: true, message: "No changes to save." };

  await db
    .update(customers)
    .set({ notes: notes || null })
    .where(eq(customers.id, customerId));
  await logActivity(user, "update", "customer", customerId, `${notes ? "Updated" : "Cleared"} notes for ${customer.email}`);
  refresh();
  return { ok: true, message: notes ? "Notes saved." : "Notes cleared." };
}

/** Add a customer with an account they can log in to straight away (no order needed). */
export async function createCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const email = str(fd.get("email")).toLowerCase();
  const firstName = str(fd.get("firstName"));
  const lastName = str(fd.get("lastName"));
  const phone = str(fd.get("phone"));
  const country = str(fd.get("country"));
  const password = String(fd.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (firstName.length > 80) fieldErrors.firstName = "Keep it under 80 characters.";
  if (lastName.length > 80) fieldErrors.lastName = "Keep it under 80 characters.";
  if (phone.length > 40) fieldErrors.phone = "Keep it under 40 characters.";
  if (country.length > 80) fieldErrors.country = "Keep it under 80 characters.";
  const pwError = passwordError(password);
  if (pwError) fieldErrors.password = pwError;
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const now = new Date();
  let id: number;
  try {
    [{ id }] = await getDb()
      .insert(customers)
      .values({ email, firstName, lastName, phone: phone || null, country: country || null, passwordHash: await hashPassword(password), accountCreatedAt: now })
      .$returningId();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: "This email is already a customer. Find them in Customers and set a password on their page." },
    };
  }
  await logActivity(user, "create", "customer", id, `Created an account for ${email}`);
  redirect(`/admin/customers/${id}?created=1`);
}

/** Open an account for an existing customer, or set a new password on theirs. Signs them out everywhere. */
export async function setCustomerPassword(customerId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const password = String(fd.get("password") ?? "");
  const pwError = passwordError(password);
  if (pwError) return { ok: false, message: pwError, fieldErrors: { password: pwError } };

  const db = getDb();
  const [customer] = await db.select({ email: customers.email, hadAccount: customers.passwordHash }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return { ok: false, message: "Customer not found." };
  await db
    .update(customers)
    .set({ passwordHash: await hashPassword(password), accountCreatedAt: sql`coalesce(${customers.accountCreatedAt}, ${new Date()})` })
    .where(eq(customers.id, customerId));
  await revokeCustomerSessions(customerId);
  const opened = !customer.hadAccount;
  await logActivity(user, "password", "customer", customerId, `${opened ? "Opened an account" : "Reset the account password"} for ${customer.email}`);
  refresh();
  return {
    ok: true,
    message: opened
      ? `Account opened. ${customer.email} can log in at /account/login with this password.`
      : `Password changed. ${customer.email} has been signed out everywhere.`,
  };
}
