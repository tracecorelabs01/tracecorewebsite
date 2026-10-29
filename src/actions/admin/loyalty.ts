"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { customers, getDb, loyaltyLedger, loyaltyOffers, settings } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { parseCents } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { LOYALTY_KEY, MAX_POINTS_PER_DOLLAR, getLoyaltyConfig, rewardLabel } from "@/lib/loyalty";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const int = (v: FormDataEntryValue | null) => {
  const s = str(v).replace(/[,\s]/g, "");
  return s && /^-?\d+$/.test(s) ? Number(s) : NaN;
};
// $1,000,000: above any real reward and safely inside the INT columns.
const MAX_CENTS = 100_000_000;
const MAX_POINTS = 1_000_000_000;

export async function saveLoyaltySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const pointsPerDollar = int(fd.get("pointsPerDollar"));
  if (!Number.isInteger(pointsPerDollar) || pointsPerDollar < 0 || pointsPerDollar > MAX_POINTS_PER_DOLLAR) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { pointsPerDollar: `Enter a whole number from 0 to ${MAX_POINTS_PER_DOLLAR.toLocaleString("en-US")}.` } };
  }
  const next = { enabled: fd.get("enabled") === "on", pointsPerDollar };
  const before = await getLoyaltyConfig();
  await getDb().insert(settings).values({ key: LOYALTY_KEY, value: next }).onDuplicateKeyUpdate({ set: { value: next } });
  await logActivity(user, "update", "settings", LOYALTY_KEY, `Loyalty: ${next.enabled ? "on" : "off"}, ${next.pointsPerDollar} points per $1 (was ${before.enabled ? "on" : "off"}, ${before.pointsPerDollar})`);
  refresh();
  return { ok: true, message: "Loyalty settings saved." };
}

function parseOffer(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const title = str(fd.get("title"));
  if (!title) fieldErrors.title = "Give the offer a name customers will see.";
  else if (title.length > 80) fieldErrors.title = "Keep it to 80 characters.";
  const description = str(fd.get("description"));
  if (description.length > 255) fieldErrors.description = "Keep it to 255 characters.";
  const pointsCost = int(fd.get("pointsCost"));
  if (!Number.isInteger(pointsCost) || pointsCost < 1 || pointsCost > MAX_POINTS) fieldErrors.pointsCost = "Enter how many points it costs (1 or more).";

  const kind = str(fd.get("kind")) === "fixed" ? "fixed" : "percent";
  let value = 0;
  if (kind === "percent") {
    const n = int(fd.get("value"));
    if (Number.isInteger(n) && n >= 1 && n <= 100) value = n;
    else fieldErrors.value = "Enter a whole percentage from 1 to 100.";
  } else {
    const cents = parseCents(fd.get("value"));
    if (cents !== null && cents > 0 && cents <= MAX_CENTS) value = cents;
    else fieldErrors.value = "Enter an amount above $0, e.g. 10.00.";
  }
  const minSubtotal = parseCents(fd.get("minSubtotal"));
  if (Number.isNaN(minSubtotal) || (minSubtotal ?? 0) > MAX_CENTS) fieldErrors.minSubtotal = "Enter an amount, or leave blank for no minimum.";

  return { fieldErrors, data: { title, description, pointsCost, kind: kind as "percent" | "fixed", value, minSubtotalCents: minSubtotal ?? 0, isActive: fd.get("isActive") === "on" } };
}

export async function saveOffer(offerId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  if (offerId !== null && !Number.isInteger(offerId)) return { ok: false, message: "Unknown offer." };
  const { data, fieldErrors } = parseOffer(fd);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const db = getDb();
  let id = offerId;
  if (id) {
    const [existing] = await db.select({ id: loyaltyOffers.id }).from(loyaltyOffers).where(eq(loyaltyOffers.id, id)).limit(1);
    if (!existing) return { ok: false, message: "This offer was deleted. Go back to Loyalty to create it again." };
    await db.update(loyaltyOffers).set(data).where(eq(loyaltyOffers.id, id));
  } else {
    [{ id }] = await db.insert(loyaltyOffers).values(data).$returningId();
  }
  // Codes already issued keep the value they were redeemed for.
  await logActivity(user, offerId ? "update" : "create", "loyalty_offer", id, `${offerId ? "Updated" : "Created"} loyalty offer "${data.title}": ${rewardLabel(data)} for ${data.pointsCost.toLocaleString("en-US")} points`.slice(0, 255));
  refresh();
  return { ok: true, message: offerId ? "Offer saved." : `Offer "${data.title}" created.` };
}

export async function setOfferActive(offerId: number, active: boolean) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(offerId) || typeof active !== "boolean") return;
  const db = getDb();
  const [o] = await db.select({ title: loyaltyOffers.title }).from(loyaltyOffers).where(eq(loyaltyOffers.id, offerId)).limit(1);
  if (o) {
    await db.update(loyaltyOffers).set({ isActive: active }).where(eq(loyaltyOffers.id, offerId));
    await logActivity(user, active ? "enable" : "disable", "loyalty_offer", offerId, `${active ? "Showed" : "Hid"} loyalty offer "${o.title}"`.slice(0, 255));
  }
  refresh();
}

export async function deleteOffer(offerId: number) {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(offerId)) return;
  const db = getDb();
  const [o] = await db.select({ title: loyaltyOffers.title }).from(loyaltyOffers).where(eq(loyaltyOffers.id, offerId)).limit(1);
  if (o) {
    // Codes customers already redeemed are separate rows and keep working.
    await db.delete(loyaltyOffers).where(eq(loyaltyOffers.id, offerId));
    await logActivity(user, "delete", "loyalty_offer", offerId, `Deleted loyalty offer "${o.title}"`.slice(0, 255));
  }
  redirect("/admin/loyalty?deleted=1");
}

/** Give or take points by hand, e.g. a goodwill gesture. Recorded with who did it and why. */
export async function adjustPoints(customerId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  if (!Number.isInteger(customerId)) return { ok: false, message: "Unknown customer." };
  const points = int(fd.get("points"));
  const note = str(fd.get("note"));
  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_POINTS) fieldErrors.points = "Enter a whole number: positive to add, negative (e.g. -500) to remove.";
  if (!note) fieldErrors.note = "Add a short reason. The customer sees it in their points history.";
  else if (note.length > 200) fieldErrors.note = "Keep it to 200 characters.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const db = getDb();
  const [c] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!c) return { ok: false, message: "This customer no longer exists." };
  await db.insert(loyaltyLedger).values({ customerId, points, kind: "adjust", adminId: user.id, note });
  await logActivity(user, "update", "customer", customerId, `${points > 0 ? "Added" : "Removed"} ${Math.abs(points).toLocaleString("en-US")} loyalty points for ${c.email}: ${note}`.slice(0, 255));
  refresh();
  return { ok: true, message: `${points > 0 ? "Added" : "Removed"} ${Math.abs(points).toLocaleString("en-US")} points.` };
}
