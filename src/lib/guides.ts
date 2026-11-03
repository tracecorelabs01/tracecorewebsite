import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, getTableColumns, inArray, ne } from "drizzle-orm";
import { adminUsers, getDb, guideRevisions, guides as guidesT, isDbConfigured } from "@/db";
import { TAGS } from "@/lib/catalog/server";
import { GUIDE_KIND_LABELS, GUIDE_SECTION_LABELS, type GuideKind, type GuideSection } from "@/lib/guide-labels";
import { recordSlugRedirect } from "@/lib/slug-redirects";
import { omit } from "@/lib/utils";

// Setup and reference guides at /guides/<slug>. Bodies are GitHub-flavoured Markdown, rendered by
// src/components/content/Markdown.tsx after fillTokens(body, await getTokenContext()) fills {{price:<slug>}} and the
// settings tokens, so a guide never contradicts the product pages. The storefront reads published guides through
// the cached loaders below (tag TAGS.guides: a save calls updateTag(TAGS.guides)); the admin uses the uncached
// helpers at the end. Guides also arrive through content patches (guide.insert, from content/guides/<slug>.md).

export { GUIDE_KIND_LABELS, GUIDE_SECTION_LABELS, type GuideKind, type GuideSection };

export interface GuideSummary {
  id: number;
  slug: string;
  title: string;
  /** Meta description and card summary. */
  description: string;
  section: GuideSection;
  kind: GuideKind;
  coverUrl: string | null;
  coverAlt: string;
  /** Slugs of the products the guide covers, all from one family. */
  relatedProducts: string[];
  sortOrder: number;
  /** ISO times. "Last reviewed" shows reviewedAt; lastmod and dateModified use contentUpdatedAt. */
  publishedAt: string | null;
  contentUpdatedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface Guide extends GuideSummary {
  seoTitle: string | null;
  /** Markdown, tokens not yet filled. */
  body: string;
  reviewDue: string | null;
}

export interface AdminGuide extends Guide {
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

/** What the admin editor saves. */
export interface GuideInput {
  slug: string;
  title: string;
  seoTitle: string | null;
  description: string;
  section: GuideSection;
  kind: GuideKind;
  body: string;
  coverUrl: string | null;
  coverAlt: string;
  relatedProducts: string[];
  status: "draft" | "published";
  reviewedBy: string | null;
  sortOrder: number;
}

/** Guides are due for review this long after publishing or their last review. */
const REVIEW_MONTHS = 6;
/** Revisions kept per guide. */
const REVISIONS_KEPT = 20;

type GuideRow = typeof guidesT.$inferSelect;
const SUMMARY_COLUMNS = omit(getTableColumns(guidesT), "body", "seoTitle", "reviewDue", "status", "createdAt", "updatedAt");
const iso = (d: Date | null) => d?.toISOString() ?? null;

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function toSummary(row: Pick<GuideRow, keyof typeof SUMMARY_COLUMNS>): GuideSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    section: row.section,
    kind: row.kind,
    coverUrl: row.coverUrl,
    coverAlt: row.coverAlt,
    relatedProducts: row.relatedProducts ?? [],
    sortOrder: row.sortOrder,
    publishedAt: iso(row.publishedAt),
    contentUpdatedAt: iso(row.contentUpdatedAt),
    reviewedAt: iso(row.reviewedAt),
    reviewedBy: row.reviewedBy,
  };
}

const toGuide = (row: GuideRow): Guide => ({ ...toSummary(row), seoTitle: row.seoTitle, body: row.body, reviewDue: iso(row.reviewDue) });

const toAdminGuide = (row: GuideRow): AdminGuide => ({ ...toGuide(row), status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

/* ───────────── storefront (cached) ───────────── */

/** Published guides, by section in hub order, then sort order, then title. None without a database. */
export async function getGuides(): Promise<GuideSummary[]> {
  if (!isDbConfigured()) return [];
  return loadGuides();
}

/** A published guide with its body, or null. Check findSlugRedirect("guide", slug) before notFound(). */
export async function getGuide(slug: string): Promise<Guide | null> {
  if (!isDbConfigured()) return null;
  return loadGuide(slug);
}

/** Published guides that cover a product (its "Setup and guides" block). */
export async function guidesForProduct(productSlug: string): Promise<GuideSummary[]> {
  return (await getGuides()).filter((g) => g.relatedProducts.includes(productSlug));
}

/** Every published guide for the sitemap: lastmod from contentUpdatedAt, image from the cover. */
export async function getGuideSlugsForSitemap(): Promise<Pick<GuideSummary, "slug" | "contentUpdatedAt" | "coverUrl">[]> {
  return (await getGuides()).map(({ slug, contentUpdatedAt, coverUrl }) => ({ slug, contentUpdatedAt, coverUrl }));
}

// "minutes", like the catalogue: the CDN keeps pages for 60 s, so a longer life would outlast an admin save.
async function loadGuides(): Promise<GuideSummary[]> {
  "use cache";
  cacheTag(TAGS.guides);
  cacheLife("minutes");
  const rows = await getDb()
    .select(SUMMARY_COLUMNS)
    .from(guidesT)
    .where(eq(guidesT.status, "published"))
    .orderBy(asc(guidesT.section), asc(guidesT.sortOrder), asc(guidesT.title));
  return rows.map(toSummary);
}

async function loadGuide(slug: string): Promise<Guide | null> {
  "use cache";
  cacheTag(TAGS.guides);
  cacheLife("minutes");
  const [row] = await getDb()
    .select()
    .from(guidesT)
    .where(and(eq(guidesT.slug, slug), eq(guidesT.status, "published")))
    .limit(1);
  return row ? toGuide(row) : null;
}

/* ───────────── admin (uncached) ───────────── */

/** Every guide, drafts too, most recently updated first. Bodies are included for word counts and warnings. */
export async function listGuidesForAdmin(): Promise<AdminGuide[]> {
  const rows = await getDb().select().from(guidesT).orderBy(desc(guidesT.updatedAt), desc(guidesT.id));
  return rows.map(toAdminGuide);
}

export async function getGuideForEdit(id: number): Promise<AdminGuide | null> {
  const [row] = await getDb().select().from(guidesT).where(eq(guidesT.id, id)).limit(1);
  return row ? toAdminGuide(row) : null;
}

/** True when a guide other than `exceptId` already uses `slug`. */
export async function isGuideSlugTaken(slug: string, exceptId?: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: guidesT.id })
    .from(guidesT)
    .where(and(eq(guidesT.slug, slug), exceptId ? ne(guidesT.id, exceptId) : undefined))
    .limit(1);
  return Boolean(row);
}

/** A guide's saved revisions, newest first, without their bodies. */
export async function listGuideRevisions(guideId: number): Promise<{ id: number; title: string; savedBy: string | null; createdAt: string }[]> {
  const rows = await getDb()
    .select({ id: guideRevisions.id, title: guideRevisions.title, savedBy: adminUsers.name, createdAt: guideRevisions.createdAt })
    .from(guideRevisions)
    .leftJoin(adminUsers, eq(guideRevisions.savedBy, adminUsers.id))
    .where(eq(guideRevisions.guideId, guideId))
    .orderBy(desc(guideRevisions.id));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** One revision with its body, to restore (save it back with saveGuide). */
export async function getGuideRevision(id: number): Promise<{ id: number; guideId: number; title: string; body: string; createdAt: string } | null> {
  const [row] = await getDb().select().from(guideRevisions).where(eq(guideRevisions.id, id)).limit(1);
  return row ? { id: row.id, guideId: row.guideId, title: row.title, body: row.body, createdAt: row.createdAt.toISOString() } : null;
}

/**
 * Creates (`id` null) or updates a guide, in one transaction. The admin save action checks the admin, validates the
 * input (zod, content guard, placeholders, literal prices), calls this, then updateTag(TAGS.guides). This also:
 * - keeps a revision whenever the title or body changes (the newest 20 per guide),
 * - stamps content_updated_at when the title, description or body changes,
 * - the first time it's published, sets published_at, reviewed_at and a review due date 6 months on,
 * - records a redirect from the old URL when a guide that has been published gets a new slug.
 * Check isGuideSlugTaken() first: a duplicate slug fails the save.
 */
export async function saveGuide(id: number | null, input: GuideInput, adminId: number | null): Promise<{ id: number; slug: string }> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const publishing = input.status === "published";

    if (id === null) {
      const [{ id: newId }] = await tx
        .insert(guidesT)
        .values({
          ...input,
          contentUpdatedAt: now,
          ...(publishing ? { publishedAt: now, reviewedAt: now, reviewDue: addMonths(now, REVIEW_MONTHS) } : {}),
        })
        .$returningId();
      await tx.insert(guideRevisions).values({ guideId: newId, title: input.title, body: input.body, savedBy: adminId });
      return { id: newId, slug: input.slug };
    }

    const [before] = await tx.select().from(guidesT).where(eq(guidesT.id, id)).for("update").limit(1);
    if (!before) throw new Error(`No guide with id ${id}.`);
    const textChanged = before.title !== input.title || before.body !== input.body;
    const firstPublish = publishing && !before.publishedAt;
    await tx
      .update(guidesT)
      .set({
        ...input,
        ...(textChanged || before.description !== input.description ? { contentUpdatedAt: now } : {}),
        ...(firstPublish ? { publishedAt: now, reviewedAt: before.reviewedAt ?? now, reviewDue: before.reviewDue ?? addMonths(now, REVIEW_MONTHS) } : {}),
      })
      .where(eq(guidesT.id, id));

    if (textChanged) {
      await tx.insert(guideRevisions).values({ guideId: id, title: input.title, body: input.body, savedBy: adminId });
      const old = await tx
        .select({ id: guideRevisions.id })
        .from(guideRevisions)
        .where(eq(guideRevisions.guideId, id))
        .orderBy(desc(guideRevisions.id))
        .limit(1000)
        .offset(REVISIONS_KEPT);
      if (old.length) await tx.delete(guideRevisions).where(inArray(guideRevisions.id, old.map((r) => r.id)));
    }
    if (before.slug !== input.slug && before.publishedAt) await recordSlugRedirect(tx, "guide", before.slug, input.slug);
    return { id, slug: input.slug };
  });
}

/** "Reviewed": records who checked the guide against the hardware, and when, and moves its next review 6 months on. */
export async function markGuideReviewed(id: number, reviewedBy: string) {
  const now = new Date();
  await getDb()
    .update(guidesT)
    .set({ reviewedBy, reviewedAt: now, reviewDue: addMonths(now, REVIEW_MONTHS) })
    .where(eq(guidesT.id, id));
}
