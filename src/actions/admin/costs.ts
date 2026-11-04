"use server";

import { refresh } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { COST_KINDS, costFields, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/session";
import { COST_KIND_LABELS, formatCost, parseCost, type CostKind } from "@/lib/costs";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Adds or edits a cost field. Its kind is set once: changing it would change what every product's value means. */
export async function saveCostField(fieldId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [current] = fieldId ? await db.select().from(costFields).where(eq(costFields.id, fieldId)).limit(1) : [];
  if (fieldId && !current) return { ok: false, message: "This cost was deleted. Add it again below." };

  const fieldErrors: Record<string, string> = {};
  const name = str(fd.get("name")).replace(/\s+/g, " ");
  if (!name) fieldErrors.name = "Name the cost, e.g. Supplier price.";
  else if (name.length > 60) fieldErrors.name = "Keep it to 60 characters.";
  const kind = (current?.kind ?? str(fd.get("kind"))) as CostKind;
  if (!COST_KINDS.includes(kind)) fieldErrors.kind = "Choose how this cost is counted.";
  const defaultValue = COST_KINDS.includes(kind) ? parseCost(kind, str(fd.get("defaultValue"))) : null;
  if (Number.isNaN(defaultValue)) fieldErrors.defaultValue = kind === "percent" ? "Enter a percent from 0 to 100, e.g. 1.85, or leave it blank." : "Enter an amount, e.g. 20.00, or leave it blank.";
  if (name && !fieldErrors.name) {
    const [clash] = await db
      .select({ id: costFields.id })
      .from(costFields)
      .where(and(eq(sql`lower(${costFields.name})`, name.toLowerCase()), fieldId ? ne(costFields.id, fieldId) : undefined))
      .limit(1);
    if (clash) fieldErrors.name = "Another cost already has this name.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const values = { name, defaultValue };
  let id = fieldId;
  if (id) await db.update(costFields).set(values).where(eq(costFields.id, id));
  else [{ id }] = await db.insert(costFields).values({ ...values, kind }).$returningId();
  const what = `${name} (${COST_KIND_LABELS[kind].toLowerCase()}${defaultValue != null ? `, default ${formatCost(kind, defaultValue)}` : ""})`;
  await logActivity(user, fieldId ? "update" : "create", "cost_field", id, `${fieldId ? "Updated" : "Added"} product cost ${what}`);
  refresh();
  return { ok: true, message: fieldId ? "Saved." : `Added ${name}. Set its value on each product, or rely on the default.` };
}

export async function deleteCostField(fieldId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [field] = await db.select({ name: costFields.name }).from(costFields).where(eq(costFields.id, fieldId)).limit(1);
  if (!field) return;
  // Products' values for it go too (cascade); orders keep the costs they recorded.
  await db.delete(costFields).where(eq(costFields.id, fieldId));
  await logActivity(user, "delete", "cost_field", fieldId, `Deleted product cost ${field.name}`);
  refresh();
}
