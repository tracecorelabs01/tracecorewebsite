// Checks content files before they ship: guides (content/guides/*.md) and content patches (content/patches/*.json),
// or any other folders or files given. Fails on excluded terms (src/lib/content-guard.ts), literal dollar amounts,
// em or en dashes, an H1 in a guide body, broken frontmatter, and internal links to pages that don't exist.
//   npx tsx scripts/check-content.ts [paths...] [--snapshot <snapshot.json>]
// With --snapshot (a list of products with slug and category), product links and related products are checked too.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { findBlocked, findLiteralPrices } from "../src/lib/content-guard";
import { loadPatches, parseGuideFile } from "../src/lib/content-patches.mjs";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const snapshotPath = option("--snapshot");
// A file of guide slugs (one per line) that will exist, so links to guides not written yet don't fail.
const plannedGuides = option("--planned-guides");
const targets = args.length ? args : ["content/guides", "content/patches"];

const SHOP = new Set(["dma", "fuser", "input", "accessory", "bundle"]);
const PAGES = new Set(["/", "/shop", "/guides", "/faq", "/support", "/about", "/partners", "/track", "/tools/pixel-clock-calculator"]);
const LEGAL = new Set(["terms", "privacy", "refunds", "shipping", "affiliate", "warranty"]);

const products = new Map<string, string>(); // slug -> category
if (snapshotPath) {
  const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
  for (const p of snap.products ?? []) products.set(p.slug, p.category?.slug ?? p.category ?? p.categorySlug ?? "");
}

const files = targets.flatMap((t) => (statSync(t).isDirectory() ? readdirSync(t).map((f) => path.join(t, f)) : [t]));
const guideSlugs = new Set(files.filter((f) => f.endsWith(".md")).map((f) => path.basename(f, ".md")));
// Guides that already exist elsewhere (content/guides) count as valid link targets too.
try {
  for (const f of readdirSync("content/guides")) if (f.endsWith(".md")) guideSlugs.add(path.basename(f, ".md"));
} catch {}
if (plannedGuides) for (const s of readFileSync(plannedGuides, "utf8").split(/\r?\n/)) if (s.trim()) guideSlugs.add(s.trim());

const problems: string[] = [];
const warn = (where: string, msg: string) => problems.push(`${where}: ${msg}`);

function scanText(where: string, text: string) {
  for (const t of findBlocked(text)) warn(where, `excluded term "${t}"`);
  for (const p of findLiteralPrices(text)) warn(where, `literal amount "${p}" (use {{price:<slug>}} or a settings token)`);
  if (/[–—]/.test(text)) warn(where, "em or en dash");
}

function checkLinks(where: string, markdown: string) {
  for (const m of markdown.matchAll(/\]\((\/[^)\s#]*)(?:#[^)\s]*)?\)/g)) {
    const url = m[1].replace(/\/$/, "") || "/";
    const [, first, second] = url.split("/");
    const ok =
      PAGES.has(url) ||
      (first === "guides" && guideSlugs.has(second)) ||
      (first === "shop" && SHOP.has(second)) ||
      (first === "legal" && LEGAL.has(second)) ||
      (first === "product" && (!snapshotPath || products.has(second))) ||
      first === "media" ||
      first === "products";
    if (!ok) warn(where, `link to ${m[1]} (no such page)`);
  }
}

// The text a file publishes: old values a patch replaces ("from", "find") and working notes are not checked.
const SKIP_KEYS = new Set(["from", "find", "where_contains", "notes", "id", "description_of_change"]);
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => (SKIP_KEYS.has(k) ? [] : strings(x)));
  return [];
}

for (const file of files) {
  const where = path.relative(process.cwd(), file);
  if (file.endsWith(".md") && path.basename(file) !== "README.md") {
    let guide: { meta: Record<string, unknown>; body: string };
    try {
      guide = parseGuideFile(readFileSync(file, "utf8"), where);
    } catch (err) {
      warn(where, (err as Error).message);
      continue;
    }
    scanText(where, [guide.meta.title, guide.meta.seo_title, guide.meta.description, guide.meta.cover_alt, guide.body].filter(Boolean).join("\n"));
    if (/^# /m.test(guide.body)) warn(where, "the body has an H1 (the page renders the title as the H1)");
    checkLinks(where, guide.body);
    const related = (guide.meta.related_products as string[] | undefined) ?? [];
    if (snapshotPath) {
      for (const s of related) if (!products.has(s)) warn(where, `related product "${s}" doesn't exist`);
      const families = new Set(related.map((s) => products.get(s)).filter((c) => c && c !== "accessory" && c !== "bundle"));
      if (families.size > 1) warn(where, `related products span families (${[...families].join(", ")})`);
    }
    const words = guide.body.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`${where}: ${words} words`);
  } else if (file.endsWith(".json")) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    scanText(where, strings(data).join("\n"));
    for (const s of strings(data)) checkLinks(where, s);
  }
}

async function main() {
  // Content patches must also pass the applier's own validation (the same code predeploy.mjs runs).
  for (const dir of targets.filter((t) => path.basename(t) === "patches" && statSync(t).isDirectory())) {
    try {
      const patches = await loadPatches(dir);
      console.log(`${dir}: ${patches.length} content patch(es) valid`);
    } catch (err) {
      warn(dir, (err as Error).message);
    }
  }
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("content check passed");
}

main();
