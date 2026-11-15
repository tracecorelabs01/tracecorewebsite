"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { affiliateCommissions, affiliateGroups, affiliateRules, affiliates, customers, getDb, products, settings } from "@/db";
import { AFFILIATE_SETTINGS_KEY, codeTaken, markPayoutPaid, normaliseCode, programSchema, rejectPayout, scopeKey, type Scope } from "@/lib/affiliates";
import { MAX_DISCOUNT, type CommissionKind } from "@/lib/affiliate-terms";
import { logActivity } from "@/lib/admin/audit";
import { bulkInput, parseCents } from "@/lib/admin/format";
import { requireAdmin, type AdminUser } from "@/lib/auth/session";
import { sendPartnerDecision, sendPayoutPaid } from "@/lib/emails/partners";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const whole = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s && /^\d+$/.test(s) ? Number(s) : NaN;
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What happened to one row of a bulk action. */
type Outcome = { changed: boolean; message: string };
/** "Updated 3 of 5 partners. Skipped 2: why." */
function bulkResult(outcomes: Outcome[], noun: string): ActionState {
  const changed = outcomes.filter((o) => o.changed).length;
  const skipped = outcomes.filter((o) => !o.changed);
  const reasons = [...new Set(skipped.map((o) => o.message))].slice(0, 3).join(" ");
  return { ok: changed > 0, message: `Updated ${changed} of ${plural(outcomes.length, noun)}.${skipped.length ? ` Skipped ${skipped.length}: ${reasons}` : ""}` };
}

/** A group's or partner's own commission and discount limit from its form. Blank means use the level above. */
function readTerms(fd: FormData, fieldErrors: Record<string, string>) {
  const kind = str(fd.get("commissionKind"));
  const value = parseCents(fd.get("commissionValue"));
  const maxDiscount = parseCents(fd.get("maxDiscount"));
  const own: CommissionKind | null = kind === "percent" ? "percent" : kind === "fixed" ? "fixed" : null;
  if (own && (value === null || Number.isNaN(value) || (own === "percent" && value > 10_000))) fieldErrors.commissionValue = own === "percent" ? "0 to 100." : "Enter an amount.";
  if (!own && value !== null) fieldErrors.commissionValue = "Choose percent or fixed first, or clear this.";
  if (maxDiscount !== null && (Number.isNaN(maxDiscount) || maxDiscount > MAX_DISCOUNT)) fieldErrors.maxDiscount = `0 to ${MAX_DISCOUNT / 100}.`;
  return { commissionKind: own, commissionValue: own ? value : null, maxDiscount };
}

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
    maxDiscount: parseCents(fd.get("maxDiscount")) ?? 0,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      fieldErrors[k === "minPayoutCents" ? "minPayout" : k] ??= k === "maxDiscount" ? `0 to ${MAX_DISCOUNT / 100}.` : "Enter a valid value.";
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
    if (price !== null && Number.isNaN(price)) fieldErrors[`p_${id}`] = "A price, or blank";
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

type NewStatus = "approved" | "rejected" | "suspended";

async function changePartnerStatus(user: AdminUser, id: number, status: NewStatus): Promise<Outcome> {
  const db = getDb();
  const [row] = await db
    .select({ status: affiliates.status, approvedAt: affiliates.approvedAt, name: affiliates.name, code: affiliates.code, email: customers.email, firstName: customers.firstName, discordId: customers.discordId })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(eq(affiliates.id, id))
    .limit(1);
  if (!row) return { changed: false, message: "Partner not found." };
  if (row.status === status) return { changed: false, message: `Already ${status}.` };
  // Partners sign up through Discord: no linked Discord, no approval.
  if (status === "approved" && !row.discordId) return { changed: false, message: "No Discord linked, so they can't be approved." };
  if (status === "rejected" && row.status !== "pending") return { changed: false, message: "Only applications can be declined. Suspend an active partner instead." };
  if (status === "suspended" && row.status !== "approved") return { changed: false, message: "Only active partners can be suspended." };
  await db
    .update(affiliates)
    .set({ status, ...(status === "approved" && !row.approvedAt ? { approvedAt: new Date() } : {}) })
    .where(eq(affiliates.id, id));
  // Tell applicants the decision; suspending or reinstating an existing partner is a conversation, not an email.
  if (row.status === "pending" && status !== "suspended") await sendPartnerDecision(row.email, row.firstName || null, status === "approved", row.code);
  await logActivity(user, "update", "affiliate", id, `Partner ${row.name}: ${row.status} → ${status}`);
  return { changed: true, message: "" };
}

export async function setPartnerStatus(id: number, status: NewStatus) {
  const user = await requireAdmin("admin");
  if ((await changePartnerStatus(user, id, status)).changed) refresh();
}

/** The partners list and the applications inbox: approve, decline or suspend many at once, or move them to a group. */
export async function bulkUpdatePartners(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const { ids, action, value } = bulkInput(fd);
  if (!ids.length) return { ok: false, message: "Select at least one partner." };

  if (action === "group") {
    const db = getDb();
    const groupId = value === "default" ? null : Number(value);
    const [group] = groupId ? await db.select({ name: affiliateGroups.name }).from(affiliateGroups).where(eq(affiliateGroups.id, groupId)).limit(1) : [];
    if (value !== "default" && !group) return { ok: false, message: "Choose a group." };
    await db.update(affiliates).set({ groupId }).where(inArray(affiliates.id, ids));
    await logActivity(user, "update", "affiliate", null, `Moved ${plural(ids.length, "partner")} to ${group ? `the group ${group.name}` : "the default group"}`);
    refresh();
    return { ok: true, message: `Moved ${plural(ids.length, "partner")} to ${group?.name ?? "the default group"}. Its commission and discount limit apply to them now.` };
  }
  if (action !== "approved" && action !== "rejected" && action !== "suspended") return { ok: false, message: "Choose an action." };
  // One at a time: each decision emails its applicant, exactly as when made by hand.
  const outcomes: Outcome[] = [];
  for (const id of ids) outcomes.push(await changePartnerStatus(user, id, action));
  if (outcomes.some((o) => o.changed)) refresh();
  return bulkResult(outcomes, "partner");
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
  const terms = readTerms(fd, fieldErrors);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  await db
    .update(affiliates)
    .set({ name, code, groupId: Number.isNaN(groupId) ? null : groupId, paypalEmail: paypalEmail || null, notes: str(fd.get("notes")) || null, ...terms })
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
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 80) fieldErrors.name = "2 to 80 characters.";
  const terms = readTerms(fd, fieldErrors);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  const values = { name, description: str(fd.get("description")).slice(0, 255), isDefault: fd.get("isDefault") === "on", ...terms };
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

/**
 * The payouts to send: mark the ticked ones paid with one PayPal transaction or batch ID (each partner is emailed),
 * or reject them with a reason (the amount goes back to the partner's available balance).
 */
export async function bulkPayouts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const { ids, action, value } = bulkInput(fd);
  if (!ids.length) return { ok: false, message: "Select at least one payout." };
  if (action !== "paid" && action !== "rejected") return { ok: false, message: "Choose an action." };
  const text = value.slice(0, action === "paid" ? 191 : 255);
  if (!text) return { ok: false, message: action === "paid" ? "Enter the PayPal transaction or batch ID." : "Say why, for the partner." };

  const gone: Outcome = { changed: false, message: "No longer waiting to be paid." };
  const outcomes: Outcome[] = [];
  for (const id of ids) {
    const p = action === "paid" ? await markPayoutPaid(id, text, user.id) : await rejectPayout(id, text, user.id);
    outcomes.push(p ? { changed: true, message: "" } : gone);
    if (!p) continue;
    if (action === "rejected") {
      await logActivity(user, "update", "affiliate", p.affiliateId, `Rejected a ${money(p.amountCents)} payout request: ${text}`);
      continue;
    }
    const [who] = await getDb()
      .select({ email: customers.email, firstName: customers.firstName, name: affiliates.name })
      .from(affiliates)
      .innerJoin(customers, eq(affiliates.customerId, customers.id))
      .where(eq(affiliates.id, p.affiliateId))
      .limit(1);
    if (who) await sendPayoutPaid(who.email, who.firstName || null, p.amountCents, text, p.id);
    await logActivity(user, "update", "affiliate", p.affiliateId, `Paid ${money(p.amountCents)} to ${who?.name ?? "a partner"} by PayPal (${text})`);
  }
  if (outcomes.some((o) => o.changed)) refresh();
  return bulkResult(outcomes, "payout");
}
