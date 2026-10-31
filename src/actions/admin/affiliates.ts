"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { affiliateCommissions, affiliateGroups, affiliateRules, affiliates, customers, getDb, products, settings } from "@/db";
import { AFFILIATE_SETTINGS_KEY, codeTaken, markPayoutPaid, normaliseCode, programSchema, rejectPayout, scopeKey, type Scope } from "@/lib/affiliates";
import { logActivity } from "@/lib/admin/audit";
import { parseCents } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { sendPartnerDecision, sendPayoutPaid } from "@/lib/emails/partners";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const whole = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s && /^\d+$/.test(s) ? Number(s) : NaN;
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* ───────────── program ───────────── */

export async function saveProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const kind = str(fd.get("commissionKind"));
  const rate = parseCents(fd.get("commissionValue"));
  const parsed = programSchema.safeParse({
    enabled: fd.get("enabled") === "on",
    cookieDays: whole(fd.get("cookieDays")),
    holdDays: whole(fd.get("holdDays")),
    minPayoutCents: parseCents(fd.get("minPayout")) ?? NaN,
    commissionKind: kind,
    commissionValue: rate ?? NaN,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      fieldErrors[k === "minPayoutCents" ? "minPayout" : k] ??= "Enter a valid value.";
    }
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }
  if (parsed.data.commissionKind === "percent" && parsed.data.commissionValue > 10_000) return { ok: false, message: "A percentage can't be over 100.", fieldErrors: { commissionValue: "At most 100%." } };
  const db = getDb();
  await db.insert(settings).values({ key: AFFILIATE_SETTINGS_KEY, value: parsed.data }).onDuplicateKeyUpdate({ set: { value: parsed.data } });
  await logActivity(user, "update", "affiliate", AFFILIATE_SETTINGS_KEY, "Updated the affiliate program settings");
  refresh();
  return { ok: true, message: "Program settings saved." };
}

/* ───────────── rules: visible products, commissions and partner prices ───────────── */

/** Saves the per-product rules for the program, a group or a partner. Blank fields inherit. */
export async function saveRules(scope: Scope, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const db = getDb();
  if (scope.level === "group" && !(await db.select({ id: affiliateGroups.id }).from(affiliateGroups).where(eq(affiliateGroups.id, scope.id)).limit(1)).length) return { ok: false, message: "That group no longer exists." };
  if (scope.level === "partner" && !(await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.id, scope.id)).limit(1)).length) return { ok: false, message: "That partner no longer exists." };
  const key = scopeKey(scope);
  const ids = new Set((await db.select({ id: products.id }).from(products)).map((p) => p.id));

  const fieldErrors: Record<string, string> = {};
  const rows: { productId: number; visible: boolean | null; commissionKind: "percent" | "fixed" | null; commissionValue: number | null; priceCents: number | null }[] = [];
  for (const id of ids) {
    if (!fd.has(`v_${id}`)) continue;
    const v = str(fd.get(`v_${id}`));
    const kind = str(fd.get(`k_${id}`));
    const value = parseCents(fd.get(`n_${id}`));
    const price = parseCents(fd.get(`p_${id}`));
    if (kind && (value === null || Number.isNaN(value) || value < 0 || (kind === "percent" && value > 10_000))) fieldErrors[`n_${id}`] = kind === "percent" ? "0 to 100" : "A positive amount";
    if (price !== null && (Number.isNaN(price) || price < 0)) fieldErrors[`p_${id}`] = "A positive price";
    rows.push({
      productId: id,
      visible: v === "1" ? true : v === "0" ? false : null,
      commissionKind: kind === "percent" || kind === "fixed" ? kind : null,
      commissionValue: kind === "percent" || kind === "fixed" ? value : null,
      priceCents: price,
    });
  }
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const owner = scope.level === "group" ? { groupId: scope.id } : scope.level === "partner" ? { affiliateId: scope.id } : {};
  await db.transaction(async (tx) => {
    for (const r of rows) {
      if (r.visible === null && r.commissionKind === null && r.priceCents === null) {
        await tx.delete(affiliateRules).where(and(eq(affiliateRules.scope, key), eq(affiliateRules.productId, r.productId)));
        continue;
      }
      const values = { visible: r.visible, commissionKind: r.commissionKind, commissionValue: r.commissionValue, priceCents: r.priceCents };
      await tx.insert(affiliateRules).values({ scope: key, productId: r.productId, ...owner, ...values }).onDuplicateKeyUpdate({ set: values });
    }
  });
  await logActivity(user, "update", "affiliate", key, `Updated affiliate product rules (${key})`);
  refresh();
  return { ok: true, message: "Saved. Partners see the change straight away." };
}

/* ───────────── partners ───────────── */

export async function setPartnerStatus(id: number, status: "approved" | "rejected" | "suspended") {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [row] = await db
    .select({ status: affiliates.status, approvedAt: affiliates.approvedAt, name: affiliates.name, code: affiliates.code, email: customers.email, firstName: customers.firstName, discordId: customers.discordId })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(eq(affiliates.id, id))
    .limit(1);
  // Partners must have Discord linked to be approved (the partner page hides Approve until they do).
  if (!row || row.status === status || (status === "approved" && !row.discordId)) return;
  await db
    .update(affiliates)
    .set({ status, ...(status === "approved" && !row.approvedAt ? { approvedAt: new Date() } : {}) })
    .where(eq(affiliates.id, id));
  // Tell applicants the decision; suspending or reinstating an existing partner is a conversation, not an email.
  if (row.status === "pending" && status !== "suspended") await sendPartnerDecision(row.email, row.firstName || null, status === "approved", row.code);
  await logActivity(user, "update", "affiliate", id, `Partner ${row.name}: ${row.status} → ${status}`);
  refresh();
}

export async function savePartner(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const db = getDb();
  const name = str(fd.get("name"));
  const code = normaliseCode(str(fd.get("code")));
  const groupId = whole(fd.get("groupId"));
  const paypalEmail = str(fd.get("paypalEmail"));
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) fieldErrors.name = "2 to 120 characters.";
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) fieldErrors.code = "3 to 32 letters, numbers, - or _.";
  else if (await codeTaken(code, id, db)) fieldErrors.code = "Another partner or a discount code already uses this.";
  if (paypalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) fieldErrors.paypalEmail = "Enter a valid email.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  await db
    .update(affiliates)
    .set({ name, code, groupId: Number.isNaN(groupId) ? null : groupId, paypalEmail: paypalEmail || null, notes: str(fd.get("notes")) || null })
    .where(eq(affiliates.id, id));
  await logActivity(user, "update", "affiliate", id, `Updated partner ${name}`);
  refresh();
  return { ok: true, message: "Partner saved." };
}

/** A manual credit (positive) or deduction (negative) on the partner's balance, available straight away. */
export async function addAdjustment(affiliateId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const raw = str(fd.get("amount"));
  const negative = raw.startsWith("-");
  const cents = parseCents(negative ? raw.slice(1) : raw);
  const note = str(fd.get("note")).slice(0, 255);
  if (cents === null || Number.isNaN(cents) || cents === 0) return { ok: false, message: "Enter an amount, e.g. 25 or -10.", fieldErrors: { amount: "Enter an amount." } };
  if (!note) return { ok: false, message: "Say what it's for.", fieldErrors: { note: "Required." } };
  const amountCents = negative ? -cents : cents;
  await getDb().insert(affiliateCommissions).values({ affiliateId, kind: "adjustment", amountCents, status: "approved", approvedAt: new Date(), note });
  await logActivity(user, "update", "affiliate", affiliateId, `Partner adjustment ${negative ? "-" : "+"}${money(cents)}: ${note}`);
  refresh();
  return { ok: true, message: "Adjustment added." };
}

/** Approve a pending commission early, or reverse one that hasn't been paid out. */
export async function setCommissionStatus(id: number, status: "approved" | "reversed") {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [c] = await db.select().from(affiliateCommissions).where(eq(affiliateCommissions.id, id)).limit(1);
  if (!c || c.payoutId || c.status === "paid" || c.status === status) return;
  if (status === "approved" && c.status !== "pending") return;
  await db
    .update(affiliateCommissions)
    .set({ status, ...(status === "approved" ? { approvedAt: new Date() } : {}) })
    .where(and(eq(affiliateCommissions.id, id), isNull(affiliateCommissions.payoutId)));
  await logActivity(user, "update", "affiliate", c.affiliateId, `Commission ${c.note ?? `#${id}`} ${status}`);
  refresh();
}

/* ───────────── groups ───────────── */

export async function saveGroup(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const name = str(fd.get("name"));
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Give the group a name.", fieldErrors: { name: "2 to 80 characters." } };
  const values = { name, description: str(fd.get("description")).slice(0, 255), isDefault: fd.get("isDefault") === "on" };
  const db = getDb();
  let groupId = id;
  await db.transaction(async (tx) => {
    if (groupId) await tx.update(affiliateGroups).set(values).where(eq(affiliateGroups.id, groupId));
    else [{ id: groupId }] = await tx.insert(affiliateGroups).values(values).$returningId();
    // One default group: the one new partners join.
    if (values.isDefault) await tx.update(affiliateGroups).set({ isDefault: false }).where(ne(affiliateGroups.id, groupId!));
  });
  await logActivity(user, id ? "update" : "create", "affiliate", `group:${groupId}`, `${id ? "Updated" : "Created"} partner group ${name}`);
  if (!id) redirect(`/admin/affiliates/groups/${groupId}`);
  refresh();
  return { ok: true, message: "Group saved." };
}

export async function deleteGroup(id: number) {
  const user = await requireAdmin("admin");
  const [g] = await getDb().select({ name: affiliateGroups.name }).from(affiliateGroups).where(eq(affiliateGroups.id, id)).limit(1);
  if (!g) return;
  // Its partners fall back to the default group; its rules go with it.
  await getDb().delete(affiliateGroups).where(eq(affiliateGroups.id, id));
  await logActivity(user, "delete", "affiliate", `group:${id}`, `Deleted partner group ${g.name}`);
  redirect("/admin/affiliates?tab=groups");
}

/* ───────────── payouts ───────────── */

export async function payPayout(payoutId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const reference = str(fd.get("reference")).slice(0, 191);
  if (!reference) return { ok: false, message: "Enter the PayPal transaction ID.", fieldErrors: { reference: "Required." } };
  const p = await markPayoutPaid(payoutId, reference, user.id);
  if (!p) return { ok: false, message: "That payout isn't waiting to be paid any more." };
  const [who] = await getDb()
    .select({ email: customers.email, firstName: customers.firstName, name: affiliates.name })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(eq(affiliates.id, p.affiliateId))
    .limit(1);
  if (who) await sendPayoutPaid(who.email, who.firstName || null, p.amountCents, reference);
  await logActivity(user, "update", "affiliate", p.affiliateId, `Paid ${money(p.amountCents)} to ${who?.name ?? "a partner"} by PayPal (${reference})`);
  refresh();
  return { ok: true, message: "Marked paid. The partner has been emailed." };
}

export async function declinePayout(payoutId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const note = str(fd.get("note")).slice(0, 255);
  if (!note) return { ok: false, message: "Say why, for the partner.", fieldErrors: { note: "Required." } };
  const p = await rejectPayout(payoutId, note, user.id);
  if (!p) return { ok: false, message: "That payout isn't waiting to be paid any more." };
  await logActivity(user, "update", "affiliate", p.affiliateId, `Rejected a ${money(p.amountCents)} payout request: ${note}`);
  refresh();
  return { ok: true, message: "Rejected. The amount is back in the partner's available balance." };
}
