"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { discountCodes, getDb } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { discountLabel } from "@/lib/admin/discounts";
import { parseCents } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

const KINDS = ["percent", "fixed"] as const;
const CODE_RE = /^[A-Z0-9_-]+$/;
// $1,000,000 — far above any real discount and safely inside the INT columns.
const MAX_CENTS = 100_000_000;
const CLASH = "Another code already uses this.";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** A `datetime-local` value ("2026-11-01T09:00") read as UTC. null when blank, an Invalid Date when malformed. */
function parseUtc(value: FormDataEntryValue | null) {
  const raw = str(value);
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw);
  if (!m) return new Date(NaN);
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, Number(m[6] ?? 0)));
  // Date.UTC rolls impossible values over (Feb 30 → Mar 2); reject those instead.
  const exact = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && date.getUTCHours() === h && date.getUTCMinutes() === mi;
  return exact && y >= 2000 ? date : new Date(NaN);
}

const invalidDate = (d: Date | null) => d !== null && Number.isNaN(d.getTime());

function isDuplicate(err: unknown) {
  const e = err as { cause?: { code?: string }; code?: string };
  return (e.cause?.code ?? e.code) === "ER_DUP_ENTRY";
}

function parseDiscount(fd: FormData) {
  const fieldErrors: Record<string, string> = {};

  const code = str(fd.get("code")).toUpperCase();
  if (code.length < 2 || code.length > 40) fieldErrors.code = "Use 2–40 characters.";
  else if (!CODE_RE.test(code)) fieldErrors.code = "Use only letters, numbers, dashes (-) and underscores (_).";

  const kind = str(fd.get("kind")) as (typeof KINDS)[number];
  let value = 0;
  if (!KINDS.includes(kind)) {
    fieldErrors.kind = "Choose a discount type.";
  } else if (kind === "percent") {
    const n = Number(str(fd.get("value")).replace(/%$/, ""));
    if (Number.isInteger(n) && n >= 1 && n <= 100) value = n;
    else fieldErrors.value = "Enter a whole percentage from 1 to 100.";
  } else {
    const cents = parseCents(fd.get("value"));
    if (cents !== null && cents > 0 && cents <= MAX_CENTS) value = cents;
    else fieldErrors.value = "Enter an amount above $0, e.g. 20.00.";
  }

  const minSubtotal = parseCents(fd.get("minSubtotal"));
  if (Number.isNaN(minSubtotal) || (minSubtotal ?? 0) > MAX_CENTS) fieldErrors.minSubtotal = "Enter an amount, or leave blank for no minimum.";

  const maxUsesRaw = str(fd.get("maxUses"));
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 1_000_000_000)) {
    fieldErrors.maxUses = "Enter a whole number (1 or more), or leave blank for unlimited.";
  }

  const startsAt = parseUtc(fd.get("startsAt"));
  const endsAt = parseUtc(fd.get("endsAt"));
  if (invalidDate(startsAt)) fieldErrors.startsAt = "Enter a valid date and time.";
  if (invalidDate(endsAt)) fieldErrors.endsAt = "Enter a valid date and time.";
  else if (startsAt && endsAt && !invalidDate(startsAt) && endsAt <= startsAt) fieldErrors.endsAt = "Must be after the start.";

  return {
    fieldErrors,
    data: { code, kind, value, minSubtotalCents: minSubtotal ?? 0, maxUses, startsAt, endsAt, isActive: fd.get("isActive") === "on" },
  };
}

export async function saveDiscount(discountId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  if (discountId !== null && !Number.isInteger(discountId)) return { ok: false, message: "Unknown discount code." };
  const { data, fieldErrors } = parseDiscount(fd);
  const db = getDb();

  if (discountId) {
    const [existing] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.id, discountId)).limit(1);
    if (!existing) return { ok: false, message: "This code was deleted. Go back to Discounts to create a new one." };
  }
  if (!fieldErrors.code) {
    const [clash] = await db
      .select({ id: discountCodes.id })
      .from(discountCodes)
      .where(discountId ? and(eq(discountCodes.code, data.code), ne(discountCodes.id, discountId)) : eq(discountCodes.code, data.code))
      .limit(1);
    if (clash) fieldErrors.code = CLASH;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  let id = discountId;
  try {
    if (id) await db.update(discountCodes).set(data).where(eq(discountCodes.id, id));
    else [{ id }] = await db.insert(discountCodes).values(data).$returningId();
  } catch (err) {
    // Lost a race with another save of the same code.
    if (isDuplicate(err)) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { code: CLASH } };
    throw err;
  }

  await logActivity(user, discountId ? "update" : "create", "discount", id, `${discountId ? "Updated" : "Created"} discount code ${data.code} (${discountLabel(data)})`);
  refresh();
  return { ok: true, message: discountId ? "Code saved." : `Code ${data.code} created.` };
}

export async function setDiscountActive(discountId: number, active: boolean) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(discountId) || typeof active !== "boolean") return;
  const db = getDb();
  const [d] = await db.select({ code: discountCodes.code }).from(discountCodes).where(eq(discountCodes.id, discountId)).limit(1);
  if (d) {
    await db.update(discountCodes).set({ isActive: active }).where(eq(discountCodes.id, discountId));
    await logActivity(user, active ? "enable" : "disable", "discount", discountId, `${active ? "Enabled" : "Disabled"} discount code ${d.code}`);
  }
  refresh();
}

export async function deleteDiscount(discountId: number) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(discountId)) return;
  const db = getDb();
  const [d] = await db.select({ code: discountCodes.code }).from(discountCodes).where(eq(discountCodes.id, discountId)).limit(1);
  if (d) {
    // Orders keep the code text and amount they were charged, so history is unaffected.
    await db.delete(discountCodes).where(eq(discountCodes.id, discountId));
    await logActivity(user, "delete", "discount", discountId, `Deleted discount code ${d.code}`);
  }
  redirect("/admin/discounts?deleted=1");
}
