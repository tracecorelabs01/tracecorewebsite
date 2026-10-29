import "server-only";
import { asc, eq } from "drizzle-orm";
import { categories, getDb, products, settings } from "@/db";
import type { SetupBuilderConfig } from "@/lib/setup-builder";
import { resolveSetupBuilder, SETUP_BUILDER_KEY } from "@/lib/setup-builder-schema";

/** A product as the editor's pickers show it. */
export interface BuilderProduct {
  slug: string;
  name: string;
  price: number;
  status: "active" | "draft" | "archived";
  category: string;
  categoryName: string;
}

/** Saved config merged over the defaults. Uncached so the editor always shows the latest save. */
export async function getSetupBuilderForEdit(): Promise<{ config: SetupBuilderConfig; updatedAt: Date | null }> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, SETUP_BUILDER_KEY)).limit(1);
  return { config: resolveSetupBuilder(row?.value), updatedAt: row?.updatedAt ?? null };
}

/** Every product, drafts included (the builder can be set up before launch), in category order. */
export async function listBuilderProducts(): Promise<BuilderProduct[]> {
  const rows = await getDb()
    .select({ slug: products.slug, name: products.name, priceCents: products.priceCents, status: products.status, category: categories.slug, categoryName: categories.name })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(categories.sortOrder), asc(products.sortOrder), asc(products.name));
  return rows.map((r) => ({ slug: r.slug, name: r.name, price: r.priceCents / 100, status: r.status, category: r.category ?? "", categoryName: r.categoryName ?? "No category" }));
}
