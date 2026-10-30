"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { customers, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { isDuplicateKey, isEmail } from "@/lib/admin/staff";
import { revokeCustomerSessions } from "@/lib/auth/customer";
import { sendWelcome } from "@/lib/emails/account";
import { requireAdmin } from "@/lib/auth/session";

const NOTES_MAX = 5000;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

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

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (firstName.length > 80) fieldErrors.firstName = "Keep it under 80 characters.";
  if (lastName.length > 80) fieldErrors.lastName = "Keep it under 80 characters.";
  if (phone.length > 40) fieldErrors.phone = "Keep it under 40 characters.";
  if (country.length > 80) fieldErrors.country = "Keep it under 80 characters.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  let id: number;
  try {
    [{ id }] = await getDb()
      .insert(customers)
      .values({ email, firstName, lastName, phone: phone || null, country: country || null, accountCreatedAt: new Date() })
      .$returningId();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: "This email is already a customer. Find them in Customers and open their account on their page." },
    };
  }
  await logActivity(user, "create", "customer", id, `Created an account for ${email}`);
  await sendWelcome(email, firstName || null);
  redirect(`/admin/customers/${id}?created=1`);
}

/** Open an account for a customer who hasn't paid for an order yet. They sign in with an emailed code. */
export async function openCustomerAccount(customerId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [customer] = await db.select({ email: customers.email, firstName: customers.firstName, opened: customers.accountCreatedAt }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer || customer.opened) return;
  await db.update(customers).set({ accountCreatedAt: new Date() }).where(eq(customers.id, customerId));
  await logActivity(user, "create", "customer", customerId, `Opened an account for ${customer.email}`);
  await sendWelcome(customer.email, customer.firstName || null);
  refresh();
}

/** Signs the customer out on every device, e.g. after they lose a phone. */
export async function signOutCustomer(customerId: number) {
  const user = await requireAdmin("admin");
  const [customer] = await getDb().select({ email: customers.email }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return;
  await revokeCustomerSessions(customerId);
  await logActivity(user, "update", "customer", customerId, `Signed ${customer.email} out everywhere`);
  refresh();
}
