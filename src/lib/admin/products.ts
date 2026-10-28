import "server-only";
import { and, asc, count, desc, eq, gt, isNull, like, lte, or, sql } from "drizzle-orm";
import { categories, getDb, productImages, products } from "@/db";

export const PAGE_SIZE = 25;

export const PRODUCT_SORTS = {
  name: { label: "Name (A–Z)", order: [asc(products.name)] },
  "price-asc": { label: "Price (low to high)", order: [asc(products.priceCents), asc(products.name)] },
  "price-desc": { label: "Price (high to low)", order: [desc(products.priceCents), asc(products.name)] },
  stock: { label: "Stock (lowest first)", order: [asc(products.stockQty), asc(products.name)] },
  updated: { label: "Recently updated", order: [desc(products.updatedAt)] },
  newest: { label: "Newest first", order: [desc(products.id)] },
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;
export const isProductSort = (v: unknown): v is ProductSort => typeof v === "string" && Object.hasOwn(PRODUCT_SORTS, v);

export const STOCK_FILTERS = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
export type StockFilter = keyof typeof STOCK_FILTERS;
export const isStockFilter = (v: unknown): v is StockFilter => typeof v === "string" && Object.hasOwn(STOCK_FILTERS, v);

/** Matches what the storefront shows: untracked products are always in stock. */
function stockWhere(stock?: StockFilter) {
  if (stock === "out") return and(eq(products.trackInventory, true), lte(products.stockQty, 0));
  if (stock === "low") return and(eq(products.trackInventory, true), gt(products.stockQty, 0), lte(products.stockQty, products.lowStockThreshold));
  if (stock === "in") return or(eq(products.trackInventory, false), gt(products.stockQty, products.lowStockThreshold));
  return undefined;
}

export async function listProducts({
  q,
  status,
  categoryId,
  stock,
  sort,
  page,
}: {
  q?: string;
  status?: string;
  /** A category id, or "none" for uncategorised products. */
  categoryId?: number | "none";
  stock?: StockFilter;
  sort?: ProductSort;
  page: number;
}) {
  const db = getDb();
  const byStatus = status === "active" || status === "draft" || status === "archived" ? eq(products.status, status) : undefined;
  const bySearch = q ? or(like(products.name, `%${q}%`), like(products.slug, `%${q}%`)) : undefined;
  const byCategory = categoryId === "none" ? isNull(products.categoryId) : categoryId ? eq(products.categoryId, categoryId) : undefined;
  const byStock = stockWhere(stock);
  const where = and(byStatus, bySearch, byCategory, byStock);

  // Correlated subquery: keeps table-qualified columns only because this select has a join (see Drizzle's single-table select behaviour).
  const thumb = sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.sortOrder}, ${productImages.id} limit 1)`;
  const [rows, [{ total }], statusCounts, categoryCounts] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        status: products.status,
        priceCents: products.priceCents,
        compareAtCents: products.compareAtCents,
        trackInventory: products.trackInventory,
        allowBackorder: products.allowBackorder,
        stockQty: products.stockQty,
        lowStockThreshold: products.lowStockThreshold,
        featured: products.featured,
        artKey: products.artKey,
        updatedAt: products.updatedAt,
        category: categories.name,
        categorySlug: categories.slug,
        thumb,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(...(sort ? PRODUCT_SORTS[sort].order : [asc(products.sortOrder), desc(products.id)]))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(products).where(where),
    // Each count applies every filter except its own, so the numbers on the tabs and chips are what you'd get by clicking them.
    db.select({ status: products.status, n: count() }).from(products).where(and(bySearch, byCategory, byStock)).groupBy(products.status),
    db.select({ categoryId: products.categoryId, n: count() }).from(products).where(and(byStatus, bySearch, byStock)).groupBy(products.categoryId),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Record<string, number>;
  const all = statusCounts.reduce((n, s) => n + s.n, 0);
  const byCategoryCount = Object.fromEntries(categoryCounts.map((c) => [c.categoryId ?? "none", c.n])) as Record<string, number>;
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: { ...counts, all } as Record<string, number>,
    categoryCounts: { ...byCategoryCount, all: categoryCounts.reduce((n, c) => n + c.n, 0) } as Record<string, number>,
  };
}

export async function getProductForEdit(id: number) {
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder), asc(productImages.id));
  return { product, images };
}

export async function listCategories() {
  const db = getDb();
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, blurb: categories.blurb, sortOrder: categories.sortOrder, products: count(products.id) })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}

export async function listInventory(q?: string) {
  const db = getDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      status: products.status,
      trackInventory: products.trackInventory,
      allowBackorder: products.allowBackorder,
      stockQty: products.stockQty,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(products)
    .where(q ? or(like(products.name, `%${q}%`), like(products.slug, `%${q}%`)) : undefined)
    .orderBy(sql`${products.trackInventory} desc`, asc(products.stockQty), asc(products.name));
}
