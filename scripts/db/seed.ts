// Seeds categories, the starter catalogue and default settings. Safe to re-run:
// existing rows (matched by slug/key) are left alone. Never seeds reviews or orders.
//   npm run db:seed

import { eq } from "drizzle-orm";
import { createDb, createPool } from "../../src/db/client";
import { categories, productImages, products, settings } from "../../src/db/schema";
import { categories as starterCategories, products as starterProducts } from "../../src/data/products";
import { defaultSettings } from "../../src/lib/settings";

const STOCK = { "in-stock": 25, "low-stock": 3, preorder: 0, "sold-out": 0 } as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (add it to .env.local).");
  const pool = createPool(url);
  const db = createDb(pool);
  try {
    const categoryIds = new Map<string, number>();
    for (const [i, c] of starterCategories.entries()) {
      const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, c.id)).limit(1);
      if (row) {
        categoryIds.set(c.id, row.id);
        continue;
      }
      const [inserted] = await db.insert(categories).values({ slug: c.id, name: c.label, blurb: c.blurb, sortOrder: i }).$returningId();
      categoryIds.set(c.id, inserted.id);
      console.log(`+ category ${c.label}`);
    }

    for (const [i, p] of starterProducts.entries()) {
      const [exists] = await db.select({ id: products.id }).from(products).where(eq(products.slug, p.slug)).limit(1);
      if (exists) continue;
      const [inserted] = await db
        .insert(products)
        .values({
          slug: p.slug,
          name: p.name,
          tagline: p.tagline,
          categoryId: categoryIds.get(p.category) ?? null,
          status: "active",
          priceCents: Math.round(p.price * 100),
          compareAtCents: p.compareAt ? Math.round(p.compareAt * 100) : null,
          badge: p.badge ?? null,
          featured: Boolean(p.featured),
          sortOrder: i,
          trackInventory: true,
          stockQty: STOCK[p.status],
          lowStockThreshold: 5,
          allowBackorder: p.status === "preorder",
          summary: p.summary,
          highlights: p.highlights,
          specs: p.specs,
          inTheBox: p.inTheBox,
          optionName: p.option?.name ?? null,
          optionValues: p.option?.values ?? [],
          artKey: p.visual.kind === "art" ? p.visual.art : null,
        })
        .$returningId();
      const gallery = p.gallery ?? (p.visual.kind === "image" ? [p.visual] : []);
      for (const [j, g] of gallery.entries()) {
        if (g.kind !== "image") continue;
        await db.insert(productImages).values({ productId: inserted.id, url: g.src, alt: g.alt, sortOrder: j });
      }
      console.log(`+ product ${p.name}`);
    }

    const [store] = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, "store")).limit(1);
    if (!store) {
      await db.insert(settings).values({ key: "store", value: defaultSettings });
      console.log("+ default store settings");
    }
    console.log("✓ Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
