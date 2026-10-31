import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { categories as categoriesT, getDb, isDbConfigured, productImages, products as productsT, reviews as reviewsT, settings as settingsT } from "@/db";
import { categories as demoCategories, products as demoProducts } from "@/data/products";
import { reviews as demoReviews, ratingSummary as demoSummary } from "@/data/reviews";
import { isRazorpayConfigured, razorpayCardNetworks } from "@/lib/razorpay";
import { defaultSettings, resolveSettings, type StoreSettings } from "@/lib/settings";
import type { PublicSettings } from "@/lib/settings-defaults";
import { defaultSetupBuilder, type SetupBuilderConfig } from "@/lib/setup-builder";
import { resolveSetupBuilder, SETUP_BUILDER_KEY } from "@/lib/setup-builder-schema";
import { ART_KEYS, type ArtKey, type CategoryInfo, type Product, type ProductVisual, type PublicReview, type ReviewSummary, type ShopMenu, type StockStatus } from "./types";

// Cache tags — admin mutations call updateTag() with these.
export const TAGS = { catalog: "catalog", settings: "settings", reviews: "reviews" } as const;

export interface Catalog {
  products: Product[];
  categories: CategoryInfo[];
}

/** Active products + categories. Uses the database when configured, else the demo catalogue. */
export async function getCatalog(): Promise<Catalog> {
  if (!isDbConfigured()) return { products: demoProducts, categories: demoCategories };
  return loadCatalog();
}

/** The header's Shop mega menu: categories that have products, and Ferrum to feature. */
export async function getShopMenu(): Promise<ShopMenu> {
  const { products, categories } = await getCatalog();
  const ferrum = products.find((p) => p.slug === "ferrum");
  return {
    categories: categories.map((c) => ({ ...c, count: products.filter((p) => p.category === c.id).length })).filter((c) => c.count > 0),
    featured: ferrum ? { slug: ferrum.slug, name: ferrum.name, tagline: ferrum.tagline, price: ferrum.price, compareAt: ferrum.compareAt, visual: ferrum.visual } : null,
  };
}

export async function getProductBySlug(slug: string) {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug);
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!isDbConfigured()) return defaultSettings;
  return loadSettings();
}

/** Settings for the storefront, with the payment logos worked out from what's actually set up. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const [settings, cards] = await Promise.all([getStoreSettings(), isRazorpayConfigured() ? razorpayCardNetworks() : []]);
  const payments = [...(cards.length ? ["razorpay", ...cards] : []), ...(settings.manualPayments.paypal ? ["paypal"] : []), ...(settings.manualPayments.crypto ? ["crypto"] : [])];
  return { ...settings, payments };
}

/** The Setup Builder's questions and product picks, managed in /admin/setup-builder. */
export async function getSetupBuilder(): Promise<SetupBuilderConfig> {
  if (!isDbConfigured()) return defaultSetupBuilder;
  return loadSetupBuilder();
}

/** Approved reviews for the homepage. Demo mode shows clearly-labelled samples. */
export async function getReviewsData(): Promise<{ reviews: PublicReview[]; summary: ReviewSummary | null }> {
  if (!isDbConfigured()) return { reviews: demoReviews, summary: demoSummary };
  return loadReviews();
}

/* ───────────── cached loaders ───────────── */

// "minutes": pages are sent with s-maxage=60. Hostinger's CDN honours it, so a longer life would keep
// serving old pages after an admin change (updateTag only refreshes this server, not the CDN).
const STOREFRONT_CACHE = "minutes";

async function loadCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife(STOREFRONT_CACHE);

  const db = getDb();
  const [cats, rows, images, ratings] = await Promise.all([
    db.select().from(categoriesT).orderBy(asc(categoriesT.sortOrder), asc(categoriesT.id)),
    db.select().from(productsT).where(eq(productsT.status, "active")).orderBy(asc(productsT.sortOrder), asc(productsT.id)),
    db.select().from(productImages).orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select({ productId: reviewsT.productId, average: sql<string>`avg(${reviewsT.rating})`, count: sql<number>`count(*)` })
      .from(reviewsT)
      .where(eq(reviewsT.status, "approved"))
      .groupBy(reviewsT.productId),
  ]);

  const catById = new Map(cats.map((c) => [c.id, c]));
  const ratingById = new Map(ratings.map((r) => [r.productId, r]));
  const imagesById = new Map<number, typeof images>();
  for (const img of images) imagesById.set(img.productId, [...(imagesById.get(img.productId) ?? []), img]);

  const products = rows.map((row): Product => {
    const cat = row.categoryId ? catById.get(row.categoryId) : undefined;
    const gallery: ProductVisual[] = (imagesById.get(row.id) ?? []).map((i) => ({ kind: "image", src: i.url, alt: i.alt || row.name }));
    const art: ArtKey = (ART_KEYS as readonly string[]).includes(row.artKey ?? "") ? (row.artKey as ArtKey) : "placeholder";
    const rating = ratingById.get(row.id);
    const tracked = row.trackInventory && !row.allowBackorder;
    return {
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      category: cat?.slug ?? "other",
      categoryLabel: cat?.name ?? "Other",
      price: row.priceCents / 100,
      compareAt: row.compareAtCents ? row.compareAtCents / 100 : undefined,
      badge: row.badge ?? undefined,
      status: stockStatus(row),
      maxQty: tracked ? Math.max(0, row.stockQty) : undefined,
      rating: rating ? Math.round(Number(rating.average) * 10) / 10 : 0,
      reviewCount: rating ? Number(rating.count) : 0,
      visual: gallery[0] ?? { kind: "art", art },
      gallery: gallery.length > 1 ? gallery : undefined,
      summary: row.summary ?? "",
      highlights: row.highlights ?? [],
      specs: row.specs ?? [],
      inTheBox: row.inTheBox ?? [],
      option: row.optionName && row.optionValues?.length ? { name: row.optionName, values: row.optionValues } : undefined,
      featured: row.featured,
      seoTitle: row.seoTitle ?? undefined,
      seoDescription: row.seoDescription ?? undefined,
    };
  });

  return {
    products,
    categories: cats.map((c) => ({ id: c.slug, label: c.name, blurb: c.blurb })),
  };
}

export function stockStatus(row: { trackInventory: boolean; stockQty: number; lowStockThreshold: number; allowBackorder: boolean }): StockStatus {
  if (!row.trackInventory) return "in-stock";
  if (row.stockQty <= 0) return row.allowBackorder ? "preorder" : "sold-out";
  if (row.stockQty <= row.lowStockThreshold) return "low-stock";
  return "in-stock";
}

async function loadSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife(STOREFRONT_CACHE);
  const [row] = await getDb().select().from(settingsT).where(eq(settingsT.key, "store")).limit(1);
  return resolveSettings(row?.value);
}

async function loadSetupBuilder(): Promise<SetupBuilderConfig> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife(STOREFRONT_CACHE);
  const [row] = await getDb().select().from(settingsT).where(eq(settingsT.key, SETUP_BUILDER_KEY)).limit(1);
  return resolveSetupBuilder(row?.value);
}

async function loadReviews(): Promise<{ reviews: PublicReview[]; summary: ReviewSummary | null }> {
  "use cache";
  cacheTag(TAGS.reviews);
  cacheLife(STOREFRONT_CACHE);
  const db = getDb();
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        name: reviewsT.name,
        handle: reviewsT.handle,
        rating: reviewsT.rating,
        body: reviewsT.body,
        createdAt: reviewsT.createdAt,
        product: productsT.name,
      })
      .from(reviewsT)
      .leftJoin(productsT, eq(reviewsT.productId, productsT.id))
      .where(eq(reviewsT.status, "approved"))
      .orderBy(desc(reviewsT.createdAt))
      .limit(24),
    db
      .select({ average: sql<string>`avg(${reviewsT.rating})`, count: sql<number>`count(*)` })
      .from(reviewsT)
      .where(and(eq(reviewsT.status, "approved"))),
  ]);
  const count = Number(agg?.count ?? 0);
  return {
    reviews: rows.map((r) => ({
      name: r.name,
      handle: r.handle ?? "",
      rating: r.rating,
      text: r.body,
      product: r.product ?? "TraceCoreLab",
      date: r.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
    })),
    summary: count > 0 ? { average: Math.round(Number(agg.average) * 10) / 10, count } : null,
  };
}
