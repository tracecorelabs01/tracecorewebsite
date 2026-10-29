"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionState } from "@/components/admin/forms";
import { categories, getDb, products, settings } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { STORE_SETTINGS_KEY } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { resolveSettings } from "@/lib/settings";
import { normalizeSetupBuilder, type SetupBuilderConfig } from "@/lib/setup-builder";
import { resolveSetupBuilder, SETUP_BUILDER_KEY, setupBuilderErrors, setupBuilderSchema } from "@/lib/setup-builder-schema";

const SECTIONS: Record<keyof SetupBuilderConfig, string> = {
  intro: "heading and intro",
  discountCategories: "discount rule",
  budget: "budget step",
  monitor: "monitor step",
  pc: "second PC step",
  input: "input device step",
  summary: "summary step",
};
const PRODUCT_FIELDS = new Set(["card", "product"]);
const percentSchema = z.number().int().min(0).max(50);

/** Turn a zod issue into [form field path, message the admin can act on]. */
function describeIssue(issue: z.core.$ZodIssue): [string, string] {
  const field = issue.path.map(String).join(".");
  const last = String(issue.path.at(-1) ?? "");
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "array") return [field, field === "discountCategories" ? "Tick at least one category." : `Add at least ${issue.minimum}.`];
      if (issue.origin === "string") return [field, PRODUCT_FIELDS.has(last) ? "Pick a product." : "This can't be empty."];
      return [field, `Must be at least ${issue.minimum}.`];
    case "too_big":
      if (issue.origin === "array") return [field, `You can add up to ${issue.maximum}.`];
      if (issue.origin === "string") return [field, `Keep it to ${issue.maximum} characters.`];
      return [field, `Must be ${issue.maximum} or less.`];
    case "invalid_type":
      return [field, issue.expected === "number" || issue.expected === "int" ? "Enter a whole number." : "Check this value."];
    default:
      return [field, "Check this value."];
  }
}

export async function saveSetupBuilder(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  let data: { config?: unknown; percent?: unknown } | null = null;
  try {
    data = JSON.parse(String(fd.get("data") ?? ""));
  } catch {
    // Reported just below.
  }
  if (!data || typeof data !== "object") return { ok: false, message: "The form couldn't be read. Reload the page and try again." };

  const parsed = setupBuilderSchema.safeParse(data.config);
  const percent = percentSchema.safeParse(data.percent);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [field, message] = describeIssue(issue);
      fieldErrors[field] ??= message;
    }
  }
  if (!percent.success) fieldErrors.percent = "Enter a whole number from 0 to 50.";

  const db = getDb();
  if (parsed.success) {
    const [productRows, categoryRows] = await Promise.all([db.select({ slug: products.slug }).from(products), db.select({ slug: categories.slug }).from(categories)]);
    const rules = setupBuilderErrors(parsed.data, { products: new Set(productRows.map((r) => r.slug)), categories: new Set(categoryRows.map((r) => r.slug)) });
    for (const [field, message] of Object.entries(rules)) fieldErrors[field] ??= message;
  }
  if (!parsed.success || !percent.success || Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const config = normalizeSetupBuilder(parsed.data);
  const [[builderRow], [storeRow]] = await Promise.all([
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, SETUP_BUILDER_KEY)).limit(1),
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1),
  ]);
  // The discount percent lives with the store settings: the cart, checkout and homepage read it there.
  const store = resolveSettings(storeRow?.value);
  const percentChanged = store.setupDiscountPercent !== percent.data;
  await db.transaction(async (tx) => {
    await tx.insert(settings).values({ key: SETUP_BUILDER_KEY, value: config }).onDuplicateKeyUpdate({ set: { value: config } });
    if (percentChanged) {
      const next = { ...store, setupDiscountPercent: percent.data };
      await tx.insert(settings).values({ key: STORE_SETTINGS_KEY, value: next }).onDuplicateKeyUpdate({ set: { value: next } });
    }
  });
  updateTag(TAGS.settings);

  const before = resolveSetupBuilder(builderRow?.value);
  const changed = (Object.keys(SECTIONS) as (keyof SetupBuilderConfig)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(config[k])).map((k) => SECTIONS[k]);
  if (percentChanged) changed.unshift(`discount ${store.setupDiscountPercent}% → ${percent.data}%`);
  await logActivity(user, "update", "settings", SETUP_BUILDER_KEY, changed.length ? `Updated setup builder: ${changed.join(", ")}` : "Saved setup builder (no changes)");
  return { ok: true, message: "Saved. The setup builder on the shop page now uses these settings." };
}
