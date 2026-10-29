"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { ActionState } from "@/components/admin/forms";
import { getDb, settings } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { lines } from "@/lib/admin/format";
import { STORE_SETTINGS_KEY } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { resolveSettings, storeSettingsSchema, type StoreSettings } from "@/lib/settings";

const STAT_ROWS = 4;
const LINK_KEYS = ["discord", "x", "youtube", "tiktok"] as const;
const MONEY_FIELDS = new Set(["freeShippingThreshold", "flatShipping"]);
const LIST_NOUNS = { announcements: "announcement", payments: "payment method" } as const;
const SECTIONS: Record<keyof StoreSettings, string> = {
  announcements: "announcements",
  freeShippingThreshold: "free-shipping threshold",
  flatShipping: "flat shipping",
  supportEmail: "support email",
  links: "links",
  stats: "homepage stats",
  payments: "payment methods",
  orderNote: "order note",
  reservationHours: "unpaid order reservation time",
  setupDiscountPercent: "setup discount",
};

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
/** Number from a form field; blank or unparseable becomes NaN so validation flags it. */
const num = (v: FormDataEntryValue | null) => {
  const s = str(v).replace(/[$,\s]/g, "");
  return s ? Number(s) : NaN;
};
const dollars = (v: FormDataEntryValue | null) => {
  const n = num(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : n;
};
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isWebUrl = (v: string) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

// The setup discount is edited on the Setup builder page, so this form leaves it as it is.
function readForm(fd: FormData): Omit<StoreSettings, "setupDiscountPercent"> {
  const payments = lines(fd.get("payments"));
  return {
    announcements: lines(fd.get("announcements")),
    freeShippingThreshold: dollars(fd.get("freeShippingThreshold")),
    flatShipping: dollars(fd.get("flatShipping")),
    supportEmail: str(fd.get("supportEmail")),
    links: Object.fromEntries(LINK_KEYS.map((k) => [k, str(fd.get(`links.${k}`))])) as StoreSettings["links"],
    stats: Array.from({ length: STAT_ROWS }, (_, i) => {
      const decimals = num(fd.get(`stats.${i}.decimals`)) || 0;
      // Keep 0 implicit, like the built-in defaults.
      return { value: num(fd.get(`stats.${i}.value`)), suffix: str(fd.get(`stats.${i}.suffix`)), label: str(fd.get(`stats.${i}.label`)), ...(decimals ? { decimals } : {}) };
    }),
    // The footer keys badges by name, so drop repeats.
    payments: payments.filter((p, i) => payments.findIndex((o) => o.toLowerCase() === p.toLowerCase()) === i),
    orderNote: str(fd.get("orderNote")),
    reservationHours: num(fd.get("reservationHours")),
  };
}

/** Turn a zod issue into [form field name, message the admin can act on]. */
function describeIssue(issue: z.core.$ZodIssue): [string, string] {
  const [top, index] = issue.path;
  if (top === "announcements" || top === "payments") {
    const noun = LIST_NOUNS[top];
    if (issue.code === "too_big" && issue.origin === "array") return [top, `Add up to ${issue.maximum} ${noun}s, one per line.`];
    const line = typeof index === "number" ? `Line ${index + 1}` : "One line";
    if (issue.code === "too_big") return [top, `${line} is too long — keep each ${noun} to ${issue.maximum} characters.`];
    return [top, `${line} isn't a valid ${noun}.`];
  }
  const field = issue.path.map(String).join(".");
  const money = MONEY_FIELDS.has(field);
  switch (issue.code) {
    case "invalid_type":
      return [field, money ? "Enter an amount in dollars, e.g. 250." : "Enter a number."];
    case "too_small":
      if (issue.origin === "string") return [field, "This can't be empty."];
      return [field, money ? "Can't be negative." : `Must be at least ${issue.minimum}.`];
    case "too_big":
      if (issue.origin === "string") return [field, `Keep it to ${issue.maximum} characters.`];
      return [field, money ? `Must be $${Number(issue.maximum).toLocaleString("en-US")} or less.` : `Must be ${issue.maximum} or less.`];
    default:
      return [field, "Check this value."];
  }
}

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const db = getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1);
  const before = resolveSettings(row?.value);
  const input: StoreSettings = { ...readForm(fd), setupDiscountPercent: before.setupDiscountPercent };
  const parsed = storeSettingsSchema.safeParse(input);

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [field, message] = describeIssue(issue);
      fieldErrors[field] ??= message;
    }
  }
  // Checks the schema leaves to us: these values end up in mailto: and link hrefs on the store.
  if (!fieldErrors.supportEmail && !isEmail(input.supportEmail)) fieldErrors.supportEmail = "Enter a valid email address.";
  for (const k of LINK_KEYS) {
    const url = input.links[k];
    if (url && !fieldErrors[`links.${k}`] && !isWebUrl(url)) fieldErrors[`links.${k}`] = "Use a full link starting with https://";
  }
  input.stats.forEach((s, i) => {
    const first = input.stats.findIndex((o) => o.label.toLowerCase() === s.label.toLowerCase());
    if (s.label && first < i) fieldErrors[`stats.${i}.label`] ??= `Stat ${first + 1} already uses this label.`;
  });
  if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const data = parsed.data;
  if (row) await db.update(settings).set({ value: data }).where(eq(settings.key, STORE_SETTINGS_KEY));
  else await db.insert(settings).values({ key: STORE_SETTINGS_KEY, value: data }).onDuplicateKeyUpdate({ set: { value: data } });
  updateTag(TAGS.settings);

  const changed = (Object.keys(SECTIONS) as (keyof StoreSettings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(data[k]));
  await logActivity(user, "update", "settings", STORE_SETTINGS_KEY, changed.length ? `Updated store settings: ${changed.map((k) => SECTIONS[k]).join(", ")}` : "Saved store settings (no changes)");
  return { ok: true, message: "Settings saved — live on the store." };
}
