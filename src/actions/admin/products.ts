"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";
import sharp from "sharp";
import type { ActionState } from "@/components/admin/forms";
import { categories, getDb, productCosts, productImages, products } from "@/db";
import type { Database } from "@/db/client";
import { logActivity } from "@/lib/admin/audit";
import { listCostFields } from "@/lib/admin/costs";
import { bulkInput, lines, parseCents, slugify } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { ART_KEYS } from "@/lib/catalog/types";
import { findBlocked, findLiteralPrices } from "@/lib/content-guard";
import { parseCost, type CostField } from "@/lib/costs";
import { recordSlugRedirect } from "@/lib/slug-redirects";
import { deleteObject, newKey, putObject } from "@/lib/storage";

const STATUSES = ["active", "draft", "archived"] as const;
const int = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const opt = (v: FormDataEntryValue | null) => str(v) || null;
/** Titles, meta descriptions and alt text are one line: line breaks and runs of spaces become one space. */
const oneLine = (v: FormDataEntryValue | null) => str(v).replace(/\s+/g, " ");
/** Multi-line text, stored with \n line endings: browsers submit textareas with \r\n, which would read as a content change. */
const multiline = (v: FormDataEntryValue | null) => str(v).replace(/\r\n?/g, "\n") || null;

/** A GTIN-8, -12 (UPC), -13 (EAN) or -14 whose last digit is the right check digit. */
function isGtin(gtin: string) {
  if (!/^(?:\d{8}|\d{12,14})$/.test(gtin)) return false;
  const digits = [...gtin].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, d, i) => total + d * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Adds a field error for each field holding wording the store never publishes (src/lib/content-guard.ts). */
function guardWording(fields: Record<string, string | null | undefined>, fieldErrors: Record<string, string>) {
  for (const [name, text] of Object.entries(fields)) {
    const terms = text ? findBlocked(text) : [];
    if (terms.length && !fieldErrors[name]) fieldErrors[name] = `Remove ${terms.map((t) => `“${t}”`).join(", ")}: the store never publishes this wording.`;
  }
}

/** Markdown copy names prices with {{price:<product-slug>}}, so it never disagrees with the product pages. */
function guardPrices(name: string, text: string | null, fieldErrors: Record<string, string>) {
  const prices = text ? findLiteralPrices(text) : [];
  if (prices.length && !fieldErrors[name]) fieldErrors[name] = `Write prices as {{price:<product-slug>}} so they always match the store, not ${prices.map((p) => `“${p}”`).join(", ")}.`;
}

/** True when two stored values read the same; empty strings, empty lists and null all count as empty. */
function same(a: unknown, b: unknown) {
  const norm = (v: unknown) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? null : JSON.stringify(v));
  return norm(a) === norm(b);
}

/** What visitors read on a product page. A change moves content_updated_at (sitemap lastmod, JSON-LD dateModified); stock, price, status and sort order don't. */
const PRODUCT_CONTENT = ["name", "tagline", "summary", "highlights", "specs", "inTheBox", "description", "brand", "mpn", "gtin", "seoTitle", "seoDescription"] as const;
const CATEGORY_CONTENT = ["name", "blurb", "intro", "seoTitle", "seoDescription"] as const;

/** Photos are product content too: uploads, alt text, order and deletions call this. */
async function touchProductContent(productId: number) {
  await getDb().update(products).set({ contentUpdatedAt: new Date() }).where(eq(products.id, productId));
}

function parseProduct(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const name = str(fd.get("name"));
  const slug = slugify(str(fd.get("slug")) || name);
  const priceCents = parseCents(fd.get("price"));
  const compareAtCents = parseCents(fd.get("compareAt"));
  const status = str(fd.get("status")) as (typeof STATUSES)[number];
  const artKey = str(fd.get("artKey"));
  const gtin = str(fd.get("gtin")).replace(/[\s-]/g, "");

  if (!name) fieldErrors.name = "Name is required.";
  if (name.length > 160) fieldErrors.name = "Keep the name under 160 characters.";
  if (!slug) fieldErrors.slug = "Slug is required.";
  if (priceCents === null || Number.isNaN(priceCents)) fieldErrors.price = "Enter a valid price.";
  if (Number.isNaN(compareAtCents)) fieldErrors.compareAt = "Enter a valid price or leave blank.";
  if (!STATUSES.includes(status)) fieldErrors.status = "Choose a status.";
  if (gtin && !isGtin(gtin)) fieldErrors.gtin = "Enter the 8, 12, 13 or 14 digit barcode number with its check digit, or leave blank.";

  const specs = lines(fd.get("specs")).map((line) => {
    const i = line.indexOf(":");
    return i > 0 ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : { label: line, value: "" };
  });
  if (specs.some((s) => !s.value)) fieldErrors.specs = 'Write each spec as "Label: Value".';
  const optionValues = lines(fd.get("optionValues"));
  const optionName = opt(fd.get("optionName"));
  if (optionName && optionValues.length < 2) fieldErrors.optionValues = "Add at least two values (one per line).";

  const data = {
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
    summary: multiline(fd.get("summary")),
    highlights: lines(fd.get("highlights")),
    specs,
    inTheBox: lines(fd.get("inTheBox")),
    optionName: optionValues.length ? optionName : null,
    optionValues: optionName ? optionValues : [],
    artKey: (ART_KEYS as readonly string[]).includes(artKey) ? artKey : null,
    brand: opt(fd.get("brand"))?.slice(0, 80) ?? null,
    mpn: opt(fd.get("mpn"))?.slice(0, 80) ?? null,
    gtin: gtin || null,
    description: multiline(fd.get("description")),
    seoTitle: oneLine(fd.get("seoTitle")).slice(0, 160) || null,
    seoDescription: oneLine(fd.get("seoDescription")).slice(0, 320) || null,
  };

  guardWording(
    {
      name,
      tagline: data.tagline,
      summary: data.summary,
      highlights: data.highlights.join("\n"),
      specs: specs.map((s) => `${s.label}: ${s.value}`).join("\n"),
      inTheBox: data.inTheBox.join("\n"),
      description: data.description,
      brand: data.brand,
      mpn: data.mpn,
      badge: data.badge,
      optionName: data.optionName,
      optionValues: data.optionValues.join("\n"),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
    },
    fieldErrors,
  );
  guardPrices("description", data.description, fieldErrors);

  return { fieldErrors, data };
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ProductCostInput = { fieldIds: number[]; values: { costFieldId: number; value: number }[] };

/**
 * The product's own costs from its form ("cost:<field id>"; blank uses the cost's default). Only costs the form
 * showed are touched, so one added while the form was open keeps any value set for it meanwhile.
 */
function parseCosts(fields: CostField[], fd: FormData, fieldErrors: Record<string, string>): ProductCostInput {
  const shown = fields.filter((f) => fd.has(`cost:${f.id}`));
  const values = shown.flatMap((f) => {
    const value = parseCost(f.kind, str(fd.get(`cost:${f.id}`)));
    if (Number.isNaN(value)) fieldErrors[`cost:${f.id}`] = f.kind === "percent" ? "Enter a percent from 0 to 100, or leave it blank." : "Enter an amount, e.g. 20.00, or leave it blank.";
    return value === null || Number.isNaN(value) ? [] : [{ costFieldId: f.id, value }];
  });
  return { fieldIds: shown.map((f) => f.id), values };
}

async function writeCosts(tx: Transaction, productId: number, costs: ProductCostInput) {
  if (costs.fieldIds.length) await tx.delete(productCosts).where(and(eq(productCosts.productId, productId), inArray(productCosts.costFieldId, costs.fieldIds)));
  if (costs.values.length) await tx.insert(productCosts).values(costs.values.map((c) => ({ ...c, productId })));
}

export async function saveProduct(productId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const { data, fieldErrors } = parseProduct(fd);
  const db = getDb();

  const [[clash], [current], fields] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(productId ? and(eq(products.slug, data.slug), ne(products.id, productId)) : eq(products.slug, data.slug))
      .limit(1),
    productId ? db.select().from(products).where(eq(products.id, productId)).limit(1) : [],
    listCostFields(),
  ]);
  if (productId && !current) return { ok: false, message: "This product no longer exists." };
  if (clash) fieldErrors.slug = "Another product already uses this slug.";
  const costs = parseCosts(fields, fd, fieldErrors);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const contentChanged = !current || PRODUCT_CONTENT.some((k) => !same(current[k], data[k]));
  const values = contentChanged ? { ...data, contentUpdatedAt: new Date() } : data;
  let id = productId;
  if (id && current) {
    await db.transaction(async (tx) => {
      await tx.update(products).set(values).where(eq(products.id, current.id));
      await recordSlugRedirect(tx, "product", current.slug, data.slug);
      await writeCosts(tx, current.id, costs);
    });
    const renamed = current.slug !== data.slug ? ` (URL /product/${current.slug} now redirects to /product/${data.slug})` : "";
    await logActivity(user, "update", "product", id, `Updated product ${data.name}${renamed}`);
  } else {
    id = await db.transaction(async (tx) => {
      const [{ id: newId }] = await tx.insert(products).values(values).$returningId();
      await writeCosts(tx, newId, costs);
      return newId;
    });
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
    .values({ ...rest, slug, name: `${p.name} (copy)`, status: "draft", contentUpdatedAt: new Date() })
    .$returningId();
  const costs = await db.select().from(productCosts).where(eq(productCosts.productId, productId));
  if (costs.length) await db.insert(productCosts).values(costs.map((c) => ({ ...c, productId: id })));
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
  await touchProductContent(productId);
  await logActivity(user, "update", "product", productId, `Uploaded ${files.length} image(s) to ${p.name}`);
  updateTag(TAGS.catalog);
  return { ok: true, message: `${files.length} image${files.length > 1 ? "s" : ""} uploaded.` };
}

export async function updateImageAlt(imageId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin("admin");
  const alt = oneLine(fd.get("alt")).slice(0, 255);
  const fieldErrors: Record<string, string> = {};
  guardWording({ alt }, fieldErrors);
  if (fieldErrors.alt) return { ok: false, message: fieldErrors.alt, fieldErrors };
  const db = getDb();
  const [img] = await db.select({ productId: productImages.productId, alt: productImages.alt }).from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!img) return { ok: false, message: "This photo no longer exists." };
  if (img.alt === alt) return { ok: true, message: "Saved" };
  await db.update(productImages).set({ alt }).where(eq(productImages.id, imageId));
  await touchProductContent(img.productId);
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
  await touchProductContent(img.productId);
  updateTag(TAGS.catalog);
}

export async function deleteImage(imageId: number) {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [img] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!img) return;
  await db.delete(productImages).where(eq(productImages.id, imageId));
  if (img.storageKey) await deleteObject(img.storageKey);
  await touchProductContent(img.productId);
  await logActivity(user, "update", "product", img.productId, "Removed a product image");
  updateTag(TAGS.catalog);
}

/* ───────────── categories ───────────── */

export async function saveCategory(categoryId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const name = str(fd.get("name"));
  const slug = slugify(str(fd.get("slug")) || name).slice(0, 80);
  if (!name) return { ok: false, message: "Name is required.", fieldErrors: { name: "Required" } };
  const values = {
    name: name.slice(0, 120),
    slug,
    blurb: str(fd.get("blurb")).slice(0, 255),
    sortOrder: int(fd.get("sortOrder")),
    intro: multiline(fd.get("intro")),
    seoTitle: oneLine(fd.get("seoTitle")).slice(0, 160) || null,
    seoDescription: oneLine(fd.get("seoDescription")).slice(0, 320) || null,
  };
  const fieldErrors: Record<string, string> = {};
  guardWording({ name: values.name, blurb: values.blurb, intro: values.intro, seoTitle: values.seoTitle, seoDescription: values.seoDescription }, fieldErrors);
  guardPrices("intro", values.intro, fieldErrors);
  const db = getDb();
  const [[clash], [current]] = await Promise.all([
    db
      .select({ id: categories.id })
      .from(categories)
      .where(categoryId ? and(eq(categories.slug, slug), ne(categories.id, categoryId)) : eq(categories.slug, slug))
      .limit(1),
    categoryId ? db.select().from(categories).where(eq(categories.id, categoryId)).limit(1) : [],
  ]);
  if (categoryId && !current) return { ok: false, message: "This category no longer exists." };
  if (clash) fieldErrors.slug = "Already used";
  if (Object.keys(fieldErrors).length) return { ok: false, message: clash ? "That slug is taken." : "Please fix the highlighted fields.", fieldErrors };

  const contentChanged = !current || CATEGORY_CONTENT.some((k) => !same(current[k], values[k]));
  const row = contentChanged ? { ...values, contentUpdatedAt: new Date() } : values;
  if (categoryId && current) {
    await db.transaction(async (tx) => {
      await tx.update(categories).set(row).where(eq(categories.id, current.id));
      await recordSlugRedirect(tx, "category", current.slug, slug);
    });
  } else await db.insert(categories).values(row);
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
