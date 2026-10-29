"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { expenses, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { validDay } from "@/lib/admin/expenses";
import { money, parseCents } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/expenses";

// $1,000,000 per expense: well above anything real and safely inside the INT column.
const MAX_CENTS = 100_000_000;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function parseExpense(fd: FormData) {
  const fieldErrors: Record<string, string> = {};

  const spentOn = validDay(str(fd.get("spentOn")));
  if (!spentOn) fieldErrors.spentOn = "Enter the date it was paid.";
  else if (spentOn < "2000-01-01" || spentOn > new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)) fieldErrors.spentOn = "Enter a date between 2000 and a year from now.";

  const amountCents = parseCents(fd.get("amount"));
  if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0 || amountCents > MAX_CENTS) fieldErrors.amount = "Enter an amount above $0, e.g. 49.99.";

  const category = str(fd.get("category")).replace(/\s+/g, " ");
  if (!category) fieldErrors.category = "Pick a category or type your own.";
  else if (category.length > 60) fieldErrors.category = "Keep it to 60 characters.";

  const vendor = str(fd.get("vendor"));
  if (vendor.length > 120) fieldErrors.vendor = "Keep it to 120 characters.";
  const description = str(fd.get("description"));
  if (description.length > 500) fieldErrors.description = "Keep it to 500 characters.";
  const reference = str(fd.get("reference"));
  if (reference.length > 120) fieldErrors.reference = "Keep it to 120 characters.";
  const paymentMethod = str(fd.get("paymentMethod"));
  if (paymentMethod && !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) fieldErrors.paymentMethod = "Choose a payment method from the list.";

  return { fieldErrors, data: { spentOn: spentOn ?? "", amountCents: amountCents ?? 0, category, vendor, description, reference, paymentMethod } };
}

/** Reuse the spelling of a known category, so "shipping & POSTAGE" lands in "Shipping & postage". */
async function canonicalCategory(category: string) {
  const known = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
  if (known) return known;
  const [used] = await getDb()
    .select({ category: expenses.category })
    .from(expenses)
    .where(eq(sql`lower(${expenses.category})`, category.toLowerCase()))
    .limit(1);
  return used?.category ?? category;
}

export async function saveExpense(expenseId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  if (expenseId !== null && !Number.isInteger(expenseId)) return { ok: false, message: "Unknown expense." };
  const { data, fieldErrors } = parseExpense(fd);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const db = getDb();
  if (expenseId) {
    const [existing] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (!existing) return { ok: false, message: "This expense was deleted. Go back to Expenses to record it again." };
  }
  const row = { ...data, category: await canonicalCategory(data.category) };

  let id = expenseId;
  if (id) await db.update(expenses).set(row).where(eq(expenses.id, id));
  else [{ id }] = await db.insert(expenses).values({ ...row, createdBy: user.id }).$returningId();

  const what = `${money(row.amountCents)} for ${row.category}${row.vendor ? ` (${row.vendor})` : ""} on ${row.spentOn}`;
  await logActivity(user, expenseId ? "update" : "create", "expense", id, `${expenseId ? "Updated expense" : "Recorded expense"}: ${what}`.slice(0, 255));
  refresh();
  return { ok: true, message: expenseId ? "Expense saved." : `Recorded ${money(row.amountCents)} for ${row.category}.` };
}

export async function deleteExpense(expenseId: number) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(expenseId)) return;
  const db = getDb();
  const [e] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (e) {
    await db.delete(expenses).where(eq(expenses.id, expenseId));
    await logActivity(user, "delete", "expense", expenseId, `Deleted expense: ${money(e.amountCents)} for ${e.category} on ${e.spentOn}`.slice(0, 255));
  }
  redirect("/admin/expenses?deleted=1");
}
