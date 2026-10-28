"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";
import sharp from "sharp";
import type { ActionState } from "@/components/admin/forms";
import { categories, getDb, productImages, products } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { bulkInput, lines, parseCents, slugify } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { ART_KEYS } from "@/lib/catalog/types";
import { deleteObject, newKey, putObject } from "@/lib/storage";

const STATUSES = ["active", "draft", "archived"] as const;
const int = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const opt = (v: FormDataEntryValue | null) => str(v) || null;

function parseProduct(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const name = str(fd.get("name"));
  const slug = slugify(str(fd.get("slug")) || name);
  const priceCents = parseCents(fd.get("price"));
  const compareAtCents = parseCents(fd.get("compareAt"));
  const status = str(fd.get("status")) as (typeof STATUSES)[number];
  const artKey = str(fd.get("artKey"));

  if (!name) fieldErrors.name = "Name is required.";
  if (name.length > 160) fieldErrors.name = "Keep the name under 160 characters.";
  if (!slug) fieldErrors.slug = "Slug is required.";
  if (priceCents === null || Number.isNaN(priceCents)) fieldErrors.price = "Enter a valid price.";
  if (Number.isNaN(compareAtCents)) fieldErrors.compareAt = "Enter a valid price or leave blank.";
  if (!STATUSES.includes(status)) fieldErrors.status = "Choose a status.";

  const specs = lines(fd.get("specs")).map((line) => {
    const i = line.indexOf(":");
    return i > 0 ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : { label: line, value: "" };
  });
  if (specs.some((s) => !s.value)) fieldErrors.specs = 'Write each spec as "Label: Value".';
  const optionValues = lines(fd.get("optionValues"));
  const optionName = opt(fd.get("optionName"));
  if (optionName && optionValues.length < 2) fieldErrors.optionValues = "Add at least two values (one per line).";

  return {
    fieldErrors,
    data: {
      name,
      slug,
      tagline: str(fd.get("tagline")).slice(0, 255),
      categoryId: int(fd.get("categoryId")) || null,
      status,
      priceCents: priceCents ?? 0,
      compareAtCents: compareAtCents && compareAtCents > 0 ? compareAtCents : null,
      badge: opt(fd.get("badge"))?.slice(0, 40) ?? null,
      featured: fd.get("featured") === "on",
      sortOrder: int(fd.get("sortOrder")),
      trackInventory: fd.get("trackInventory") === "on",
      stockQty: int(fd.get("stockQty")),
      lowStockThreshold: Math.max(0, int(fd.get("lowStockThreshold"), 5)),
      allowBackorder: fd.get("allowBackorder") === "on",
      summary: str(fd.get("summary")) || null,
      highlights: lines(fd.get("highlights")),
      specs,
      inTheBox: lines(fd.get("inTheBox")),
      optionName: optionValues.length ? optionName : null,
      optionValues: optionName ? optionValues : [],
      artKey: (ART_KEYS as readonly string[]).includes(artKey) ? artKey : null,
      seoTitle: opt(fd.get("seoTitle"))?.slice(0, 160) ?? null,
      seoDescription: opt(fd.get("seoDescription"))?.slice(0, 320) ?? null,
    },
  };
}

export async function saveProduct(productId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const { data, fieldErrors } = parseProduct(fd);
  const db = getDb();

  const [clash] = await db
    .select({ id: products.id })
    .from(products)
    .where(productId ? and(eq(products.slug, data.slug), ne(products.id, productId)) : eq(products.slug, data.slug))
    .limit(1);
  if (clash) fieldErrors.slug = "Another product already uses this slug.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  let id = productId;
  if (id) {
    await db.update(products).set(data).where(eq(products.id, id));
    await logActivity(user, "update", "product", id, `Updated product ${data.name}`);
  } else {
    [{ id }] = await db.insert(products).values(data).$returningId();
    await logActivity(user, "create", "product", id, `Created product ${data.name}`);
  }
  updateTag(TAGS.catalog);
  if (!productId) redirect(`/admin/products/${id}?created=1`);
  return { ok: true, message: "Product saved — live on the store." };
}

export async function duplicateProduct(productId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [p] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return;
  let slug = `${p.slug}-copy`;
  for (let n = 2; (await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1)).length; n++) slug = `${p.slug}-copy-${n}`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip identity columns
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  const [{ id }] = await db
    .insert(products)
    .values({ ...rest, slug, name: `${p.name} (copy)`, status: "draft" })
    .$returningId();
  await logActivity(user, "create", "product", id, `Duplicated ${p.name}`);
  redirect(`/admin/products/${id}?created=1`);
}

export async function deleteProduct(productId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
  const images = await db.select({ key: productImages.storageKey }).from(productImages).where(eq(productImages.productId, productId));
  // Order history keeps its snapshot (product_id is set to NULL on delete).
  await db.delete(products).where(eq(products.id, productId));
  await Promise.all(images.map((i) => (i.key ? deleteObject(i.key) : null)));
  await logActivity(user, "delete", "product", productId, `Deleted product ${p?.name ?? productId}`);
  updateTag(TAGS.catalog);
  redirect("/admin/products?deleted=1");
}

/* ───────────── bulk edit ───────────── */

export async function bulkUpdateProducts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const { ids, action, value } = bulkInput(fd);
  if (!ids.length) return { ok: false, message: "Select at least one product." };
  const db = getDb();
  const rows = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids));
  if (!rows.length) return { ok: false, message: "Those products no longer exist." };
  const where = inArray(
    products.id,
    rows.map((r) => r.id),
  );
  const n = `${rows.length} product${rows.length === 1 ? "" : "s"}`;
  const num = Number(value);
  let done: string;

  if (action.startsWith("status:")) {
    const status = action.slice(7) as (typeof STATUSES)[number];
    if (!STATUSES.includes(status)) return { ok: false, message: "Choose an action." };
    await db.update(products).set({ status }).where(where);
    done = `Set ${n} to ${status}`;
  } else if (action === "category") {
    let category: { id: number; name: string } | null = null;
    if (value !== "none") {
      [category] = Number.isInteger(num) ? await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.id, num)).limit(1) : [];
      if (!category) return { ok: false, message: "Choose a category." };
    }
    await db
      .update(products)
      .set({ categoryId: category?.id ?? null })
      .where(where);
    done = category ? `Moved ${n} to ${category.name}` : `Removed ${n} from their category`;
  } else if (action === "featured:on" || action === "featured:off") {
    await db.update(products).set({ featured: action === "featured:on" }).where(where);
    done = `${action === "featured:on" ? "Featured" : "Unfeatured"} ${n}`;
  } else if (action === "stock-set") {
    if (!value || !Number.isInteger(num) || num < -9999 || num > 1_000_000) return { ok: false, message: "Enter a whole number for stock." };
    await db.update(products).set({ stockQty: num }).where(where);
    done = `Set stock to ${num} on ${n}`;
  } else if (action === "stock-adjust") {
    if (!value || !Number.isInteger(num) || num === 0 || Math.abs(num) > 1_000_000) return { ok: false, message: "Enter a whole number to add or remove, e.g. 10 or -5." };
    await db
      .update(products)
      .set({ stockQty: sql`GREATEST(-9999, LEAST(${products.stockQty} + ${num}, 1000000))` })
      .where(where);
    done = `Adjusted stock by ${num > 0 ? "+" : ""}${num} on ${n}`;
  } else if (action === "price-percent") {
    if (!value || !Number.isFinite(num) || num === 0 || num < -90 || num > 500) return { ok: false, message: "Enter a percentage between -90 and 500, e.g. -10 for 10% off." };
    await db
      .update(products)
      .set({ priceCents: sql`GREATEST(0, ROUND(${products.priceCents} * ${100 + num} / 100))` })
      .where(where);
    done = `Changed price by ${num > 0 ? "+" : ""}${num}% on ${n}`;
  } else if (action === "delete") {
    const images = await db.select({ key: productImages.storageKey }).from(productImages).where(inArray(productImages.productId, rows.map((r) => r.id)));
    // Order history keeps its snapshot (product_id is set to NULL on delete).
    await db.delete(products).where(where);
    await Promise.all(images.map((i) => (i.key ? deleteObject(i.key) : null)));
    done = `Deleted ${n}`;
  } else {
    return { ok: false, message: "Choose an action." };
  }

  await logActivity(user, action === "delete" ? "delete" : action.startsWith("stock") ? "stock" : "update", "product", null, `Bulk: ${done}: ${rows.map((r) => r.name).join(", ")}`);
  updateTag(TAGS.catalog);
  refresh();
  return { ok: true, message: `${done}.` };
}

/* ───────────── images ───────────── */

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadProductImages(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "Choose one or more images to upload." };
  if (files.length > 10) return { ok: false, message: "Upload up to 10 images at a time." };
  for (const f of files) {
    if (!f.type.startsWith("image/")) return { ok: false, message: `${f.name} isn't an image.` };
    if (f.size > MAX_BYTES) return { ok: false, message: `${f.name} is larger than 10 MB.` };
  }

  const db = getDb();
  const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return { ok: false, message: "Product not found." };
  const [{ top }] = await db.select({ top: max(productImages.sortOrder) }).from(productImages).where(eq(productImages.productId, productId));
  let order = (top ?? -1) + 1;

  try {
    for (const f of files) {
      // Normalise: respect EXIF rotation, strip metadata, cap size, encode WebP.
      const { data, info } = await sharp(Buffer.from(await f.arrayBuffer()))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer({ resolveWithObject: true });
      const key = newKey("products", "webp");
      const url = await putObject(key, data, "image/webp");
      await db.insert(productImages).values({ productId, url, storageKey: key, alt: p.name, width: info.width, height: info.height, sortOrder: order++ });
    }
  } catch (err) {
    console.error("[upload]", err);
    return { ok: false, message: "One of the images couldn't be processed. Try a JPG, PNG or WebP." };
  }
  await logActivity(user, "update", "product", productId, `Uploaded ${files.length} image(s) to ${p.name}`);
  updateTag(TAGS.catalog);
  return { ok: true, message: `${files.length} image${files.length > 1 ? "s" : ""} uploaded.` };
}

export async function updateImageAlt(imageId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin("admin");
  await getDb().update(productImages).set({ alt: str(fd.get("alt")).slice(0, 255) }).where(eq(productImages.id, imageId));
  updateTag(TAGS.catalog);
  return { ok: true, message: "Saved" };
}

export async function moveImage(imageId: number, direction: -1 | 1) {
  await requireAdmin("admin");
  const db = getDb();
  const [img] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!img) return;
  const siblings = await db.select().from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const i = siblings.findIndex((s) => s.id === imageId);
  const j = i + direction;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await db.transaction(async (tx) => {
    for (const [order, s] of siblings.entries()) await tx.update(productImages).set({ sortOrder: order }).where(eq(productImages.id, s.id));
  });
  updateTag(TAGS.catalog);
}

export async function deleteImage(imageId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [img] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!img) return;
  await db.delete(productImages).where(eq(productImages.id, imageId));
  if (img.storageKey) await deleteObject(img.storageKey);
  await logActivity(user, "update", "product", img.productId, "Removed a product image");
  updateTag(TAGS.catalog);
}

/* ───────────── categories ───────────── */

export async function saveCategory(categoryId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const name = str(fd.get("name"));
  const slug = slugify(str(fd.get("slug")) || name).slice(0, 80);
  if (!name) return { ok: false, message: "Name is required.", fieldErrors: { name: "Required" } };
  const db = getDb();
  const [clash] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(categoryId ? and(eq(categories.slug, slug), ne(categories.id, categoryId)) : eq(categories.slug, slug))
    .limit(1);
  if (clash) return { ok: false, message: "That slug is taken.", fieldErrors: { slug: "Already used" } };
  const values = { name: name.slice(0, 120), slug, blurb: str(fd.get("blurb")).slice(0, 255), sortOrder: int(fd.get("sortOrder")) };
  if (categoryId) await db.update(categories).set(values).where(eq(categories.id, categoryId));
  else await db.insert(categories).values(values);
  await logActivity(user, categoryId ? "update" : "create", "category", categoryId, `${categoryId ? "Updated" : "Created"} category ${name}`);
  updateTag(TAGS.catalog);
  return { ok: true, message: categoryId ? "Category saved." : "Category added." };
}

export async function deleteCategory(categoryId: number) {
  const user = await requireAdmin("admin");
  await getDb().delete(categories).where(eq(categories.id, categoryId));
  await logActivity(user, "delete", "category", categoryId, "Deleted a category (its products are now uncategorised)");
  updateTag(TAGS.catalog);
}

/* ───────────── inventory (staff can do this) ───────────── */

export async function setStock(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const stockQty = int(fd.get("stockQty"), NaN);
  const lowStockThreshold = int(fd.get("lowStockThreshold"), NaN);
  if (!Number.isFinite(stockQty) || stockQty < -9999 || stockQty > 1_000_000) return { ok: false, message: "Enter a whole number." };
  const db = getDb();
  const [p] = await db.select({ name: products.name, stockQty: products.stockQty }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return { ok: false, message: "Product not found." };
  await db
    .update(products)
    .set({ stockQty, ...(Number.isFinite(lowStockThreshold) && lowStockThreshold >= 0 ? { lowStockThreshold } : {}) })
    .where(eq(products.id, productId));
  await logActivity(user, "stock", "product", productId, `Stock for ${p.name}: ${p.stockQty} → ${stockQty}`);
  updateTag(TAGS.catalog);
  return { ok: true, message: "Updated" };
}

export async function adjustStock(productId: number, change: number) {
  const user = await requireAdmin("staff");
  await getDb()
    .update(products)
    .set({ stockQty: sql`${products.stockQty} + ${change}` })
    .where(eq(products.id, productId));
  await logActivity(user, "stock", "product", productId, `Adjusted stock by ${change > 0 ? "+" : ""}${change}`);
  updateTag(TAGS.catalog);
}
