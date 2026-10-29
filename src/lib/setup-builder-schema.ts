// Validation for the Setup Builder config. Kept apart from setup-builder.ts so the storefront bundle skips zod.

import { z } from "zod";
import { defaultSetupBuilder, type SetupBuilderConfig } from "./setup-builder";

/** Row key in the `settings` table. */
export const SETUP_BUILDER_KEY = "setup-builder";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
const slug = text(120);
const product = slug.min(1);
const itemId = z.string().regex(/^[a-z0-9-]{1,40}$/);
const hz = z.number().int().min(0).max(1000);

const step = { label: required(24), title: required(120), hint: text(300) };
const heading = z.object({ text: text(80), highlight: text(80), newLine: z.boolean() });

export const setupBuilderSchema: z.ZodType<SetupBuilderConfig> = z.object({
  intro: z.object({ kicker: text(40), heading, headingDiscount: heading, text: text(300), discountText: text(300) }),
  discountCategories: z.array(text(80).min(1)).min(1).max(10),
  budget: z.object({
    ...step,
    tiers: z.array(z.object({ id: itemId, name: required(40), description: text(200), badge: text(24), card: product, input: slug })).min(1).max(6),
    role: required(40),
    whatItDoes: text(200),
    fromPrice: text(60),
    comingSoon: text(40),
  }),
  monitor: z.object({
    ...step,
    enabled: z.boolean(),
    screens: z.array(z.object({ id: itemId, label: required(40), detail: text(80) })).max(8),
    speeds: z.array(z.object({ hz: hz.min(1), label: required(20), detail: text(40) })).max(8),
    defaultHz: hz,
    fusers: z.array(z.object({ product, maxHz: z.record(z.string(), hz) })).max(10),
    unsureFuser: slug,
    role: required(40),
    whatItDoes: text(200),
    screenHeading: text(40),
    speedHeading: text(40),
    unsureTitle: required(60),
    unsureText: text(200),
    previewHeading: text(40),
    matchCaption: text(120),
    unsureCaption: text(120),
    noMatch: text(200),
    recapUnsure: text(40),
  }),
  pc: z.object({
    ...step,
    enabled: z.boolean(),
    product: slug,
    role: required(40),
    whatItDoes: text(200),
    haveTitle: required(60),
    haveText: text(200),
    needTitle: required(60),
    needText: text(200),
    unavailable: text(200),
    recapHave: text(40),
    recapNeed: text(40),
  }),
  input: z.object({
    ...step,
    enabled: z.boolean(),
    options: z.array(z.object({ product, title: text(40), description: text(200) })).max(6),
    role: required(40),
    whatItDoes: text(200),
    suggestedBadge: text(24),
    noneEnabled: z.boolean(),
    noneTitle: required(60),
    noneText: text(200),
    recapNone: text(40),
  }),
  summary: z.object({
    ...step,
    addons: z.array(z.object({ product, description: text(200) })).max(12),
    addonRole: required(40),
    addonsHeading: text(60),
    discountHint: text(200),
    seeButton: required(40),
    addButton: required(40),
    addedButton: required(40),
    note: text(200),
    startOver: required(40),
  }),
});

const SECTIONS = ["intro", "budget", "monitor", "pc", "input", "summary"] as const;

/** Merge a stored (possibly partial or older) config over the defaults; anything invalid falls back to them. */
export function resolveSetupBuilder(stored: unknown): SetupBuilderConfig {
  if (!stored || typeof stored !== "object") return defaultSetupBuilder;
  const s = stored as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaultSetupBuilder, ...s };
  for (const k of SECTIONS) {
    const v = s[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...defaultSetupBuilder[k], ...v } : defaultSetupBuilder[k];
  }
  const parsed = setupBuilderSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaultSetupBuilder;
}

/**
 * Rules the shape can't express: products and categories that exist, no repeats, and what a question needs
 * before it can be asked. Steps that are turned off aren't checked. Returns form field path → message.
 */
export function setupBuilderErrors(c: SetupBuilderConfig, known: { products: Set<string>; categories: Set<string> }) {
  const errors: Record<string, string> = {};
  const err = (path: string, message: string) => {
    errors[path] ??= message;
  };
  const exists = (path: string, value: string) => {
    if (value && !known.products.has(value)) err(path, "This product no longer exists. Pick another one.");
  };
  const unique = <T>(list: T[], key: (t: T) => string | number, path: (i: number) => string, message: string) => {
    const seen = new Set<string | number>();
    list.forEach((t, i) => {
      if (seen.has(key(t))) err(path(i), message);
      seen.add(key(t));
    });
  };
  const { intro, budget, monitor, pc, input, summary } = c;

  for (const k of ["headingDiscount", "heading"] as const) if (!intro[k].text && !intro[k].highlight) err(`intro.${k}.text`, "Enter a heading.");
  if (c.discountCategories.some((cat) => !known.categories.has(cat))) err("discountCategories", "A ticked category no longer exists. Untick it.");

  budget.tiers.forEach((t, i) => {
    exists(`budget.tiers.${i}.card`, t.card);
    if (input.enabled && t.input && !input.options.some((o) => o.product === t.input)) err(`budget.tiers.${i}.input`, "Pick one of the devices from the input device step.");
  });
  unique(budget.tiers, (t) => t.id, (i) => `budget.tiers.${i}.name`, "This option is a copy of another. Remove it and add a new one.");

  if (monitor.enabled) {
    if (!monitor.screens.length) err("monitor.screens", "Add at least one screen size, or turn this question off.");
    if (!monitor.speeds.length) err("monitor.speeds", "Add at least one speed, or turn this question off.");
    if (!monitor.fusers.length) err("monitor.fusers", "Add at least one fuser, or turn this question off.");
    if (monitor.speeds.length && !monitor.speeds.some((s) => s.hz === monitor.defaultHz)) err("monitor.defaultHz", "Pick one of the speeds above.");
    if (monitor.fusers.length && !monitor.fusers.some((f) => f.product === monitor.unsureFuser)) err("monitor.unsureFuser", "Pick one of the fusers above.");
    monitor.fusers.forEach((f, i) => exists(`monitor.fusers.${i}.product`, f.product));
    unique(monitor.screens, (s) => s.id, (i) => `monitor.screens.${i}.label`, "This size is a copy of another. Remove it and add a new one.");
    unique(monitor.speeds, (s) => s.hz, (i) => `monitor.speeds.${i}.hz`, "Another speed already uses this number.");
    unique(monitor.fusers, (f) => f.product, (i) => `monitor.fusers.${i}.product`, "This fuser is already listed.");
  }

  if (pc.enabled) {
    if (!pc.product) err("pc.product", "Pick the computer to offer.");
    exists("pc.product", pc.product);
  }

  if (input.enabled) {
    if (!input.options.length) err("input.options", "Add at least one input device, or turn this question off.");
    input.options.forEach((o, i) => exists(`input.options.${i}.product`, o.product));
    unique(input.options, (o) => o.product, (i) => `input.options.${i}.product`, "This device is already listed.");
  }

  summary.addons.forEach((a, i) => exists(`summary.addons.${i}.product`, a.product));
  unique(summary.addons, (a) => a.product, (i) => `summary.addons.${i}.product`, "This add-on is already listed.");
  return errors;
}
