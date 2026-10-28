import "server-only";
import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { categories, getDb, productImages, products } from "@/db";

export const PAGE_SIZE = 25;

export async function listProducts({ q, status, page }: { q?: string; status?: string; page: number }) {
  const db = getDb();
  const filters: SQL[] = [];
  if (status === "active" || status === "draft" || status === "archived") filters.push(eq(products.status, status));
  if (q) filters.push(or(like(products.name, `%${q}%`), like(products.slug, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;

  // Correlated subquery: keeps table-qualified columns only because this select has a join (see Drizzle's single-table select behaviour).
  const thumb = sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.sortOrder}, ${productImages.id} limit 1)`;
  const [rows, [{ total }], statusCounts] = await Promise.all([
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
        thumb,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(asc(products.sortOrder), desc(products.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(products).where(where),
    db.select({ status: products.status, n: count() }).from(products).groupBy(products.status),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Record<string, number>;
  const all = statusCounts.reduce((n, s) => n + s.n, 0);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts: { ...counts, all } as Record<string, number> };
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
