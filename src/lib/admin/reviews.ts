import "server-only";
import { asc, count, desc, eq } from "drizzle-orm";
import { getDb, products, reviews } from "@/db";

const PAGE_SIZE = 25;

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export async function listReviews({ status, page }: { status: ReviewStatus | "all"; page: number }) {
  const db = getDb();
  const where = status === "all" ? undefined : eq(reviews.status, status);

  const [rows, [{ total }], statusCounts] = await Promise.all([
    db
      .select({
        id: reviews.id,
        name: reviews.name,
        handle: reviews.handle,
        email: reviews.email,
        rating: reviews.rating,
        body: reviews.body,
        status: reviews.status,
        source: reviews.source,
        createdAt: reviews.createdAt,
        product: products.name,
      })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(reviews).where(where),
    db.select({ status: reviews.status, n: count() }).from(reviews).groupBy(reviews.status),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Record<string, number>;
  const all = statusCounts.reduce((n, s) => n + s.n, 0);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts: { ...counts, all } as Record<string, number> };
}

/** Products for the "Add a review" picker, including drafts (reviews can arrive before launch). */
export async function listReviewProducts() {
  return getDb().select({ id: products.id, name: products.name, status: products.status }).from(products).orderBy(asc(products.name));
}
