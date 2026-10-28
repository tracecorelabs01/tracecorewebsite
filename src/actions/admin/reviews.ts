"use server";

import { refresh, updateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { getDb, products, reviews } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { bulkInput } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";

const SOURCES = ["trustpilot", "discord", "email", "other"] as const;
const MODERATED = ["approved", "rejected"] as const;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Product star ratings are derived from approved reviews, so both caches go stale together. */
function refreshStorefront() {
  updateTag(TAGS.reviews);
  updateTag(TAGS.catalog);
}

export async function setReviewStatus(reviewId: number, status: (typeof MODERATED)[number]) {
  const user = await requireAdmin("staff");
  if (!Number.isInteger(reviewId) || !MODERATED.includes(status)) return;
  const db = getDb();
  const [r] = await db.select({ name: reviews.name, rating: reviews.rating }).from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (r) {
    await db.update(reviews).set({ status }).where(eq(reviews.id, reviewId));
    await logActivity(user, status === "approved" ? "approve" : "reject", "review", reviewId, `${status === "approved" ? "Approved" : "Rejected"} ${r.rating}-star review from ${r.name}`);
  }
  refreshStorefront();
}

export async function deleteReview(reviewId: number) {
  const user = await requireAdmin("staff");
  if (!Number.isInteger(reviewId)) return;
  const db = getDb();
  const [r] = await db.select({ name: reviews.name, rating: reviews.rating }).from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (r) {
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    await logActivity(user, "delete", "review", reviewId, `Deleted ${r.rating}-star review from ${r.name}`);
  }
  refreshStorefront();
}

export async function bulkModerateReviews(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const { ids, action } = bulkInput(fd);
  if (!ids.length) return { ok: false, message: "Select at least one review." };
  if (action !== "approved" && action !== "rejected" && action !== "delete") return { ok: false, message: "Choose an action." };
  const db = getDb();
  const rows = await db.select({ id: reviews.id, name: reviews.name, rating: reviews.rating }).from(reviews).where(inArray(reviews.id, ids));
  if (!rows.length) return { ok: false, message: "Those reviews no longer exist." };
  const where = inArray(
    reviews.id,
    rows.map((r) => r.id),
  );
  const n = `${rows.length} review${rows.length === 1 ? "" : "s"}`;
  if (action === "delete") await db.delete(reviews).where(where);
  else await db.update(reviews).set({ status: action }).where(where);
  const done = action === "delete" ? `Deleted ${n}` : `${action === "approved" ? "Approved" : "Rejected"} ${n}`;
  await logActivity(user, action === "delete" ? "delete" : action === "approved" ? "approve" : "reject", "review", null, `Bulk: ${done}: ${rows.map((r) => `${r.rating}★ ${r.name}`).join(", ")}`);
  refreshStorefront();
  refresh();
  return { ok: true, message: `${done}.` };
}

/** Import a genuine review received elsewhere (Trustpilot, Discord, email). Published straight away. */
export async function addReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const fieldErrors: Record<string, string> = {};

  const name = str(fd.get("name"));
  const handle = str(fd.get("handle"));
  const rating = Number(str(fd.get("rating")));
  const body = str(fd.get("body"));
  const productRaw = str(fd.get("productId"));
  const productId = productRaw ? Number(productRaw) : null;
  const source = str(fd.get("source")) as (typeof SOURCES)[number];

  if (!name) fieldErrors.name = "Name is required.";
  else if (name.length > 80) fieldErrors.name = "Keep the name under 80 characters.";
  if (handle.length > 80) fieldErrors.handle = "Keep the handle under 80 characters.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fieldErrors.rating = "Choose a rating.";
  if (!body) fieldErrors.body = "Paste the customer's review.";
  else if (body.length > 5000) fieldErrors.body = "Keep the review under 5,000 characters.";
  if (!SOURCES.includes(source)) fieldErrors.source = "Choose where it was posted.";

  const db = getDb();
  if (productId !== null) {
    const [p] = Number.isInteger(productId) ? await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1) : [];
    if (!p) fieldErrors.productId = "That product no longer exists.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const [{ id }] = await db
    .insert(reviews)
    .values({ productId, name, handle: handle || null, rating, body, status: "approved", source })
    .$returningId();
  await logActivity(user, "create", "review", id, `Added a ${rating}-star ${source} review from ${name}`);
  refreshStorefront();
  return { ok: true, message: "Review published." };
}
