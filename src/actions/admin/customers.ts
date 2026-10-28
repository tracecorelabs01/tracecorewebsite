"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { customers, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/session";

const NOTES_MAX = 5000;

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
