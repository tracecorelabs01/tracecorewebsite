// Content patches: reviewed, one-off edits to store content that lives in the database (product copy, category
// intros, the announcement bar, guides). Each patch is a JSON file in content/patches/ (the format is in
// content/patches/README.md). Patches apply in filename order, once per database, each in one transaction, and
// are recorded in content_patches.
//
// Plain ESM with no TypeScript or path aliases, so one file serves both callers: scripts/predeploy.mjs runs it with
// Node before `next build` reads the database, and src/instrumentation.ts runs it (bundled) when the server starts,
// so a deploy whose build had no database still catches up.
//
// A patch never overwrites an edit made in the admin since it was written: each field carries the value it expects
// to replace ("from"), and a field whose current value differs is skipped and logged, never forced.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ID = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Matches the admin's limit (storeSettingsSchema): a longer message would make the saved settings invalid. */
const ANNOUNCEMENT_MAX = 140;
const GUIDE_SECTIONS = ["dma", "fuser", "input", "reference"];
const GUIDE_KINDS = ["guide", "comparison", "glossary"];

// Fields a patch may change. `optional` fields are also written when they're empty now, whatever "from" says.
const text = (max, more = {}) => ({ kind: "text", max, ...more });
const PRODUCT_FIELDS = {
  name: text(160, { required: true }),
  tagline: text(255, { notNull: true }),
  summary: text(65535),
  highlights: { kind: "list" },
  specs: { kind: "specs" },
  in_the_box: { kind: "list" },
  seo_title: text(160, { optional: true }),
  seo_description: text(320, { optional: true }),
  description: text(16_000_000, { optional: true }),
  brand: text(80, { optional: true }),
  mpn: text(80, { optional: true }),
  gtin: { kind: "gtin", optional: true },
};
const CATEGORY_FIELDS = {
  name: text(120, { required: true }),
  blurb: text(255, { notNull: true }),
  intro: text(65535, { optional: true }),
  seo_title: text(160, { optional: true }),
  seo_description: text(320, { optional: true }),
};
// Guide frontmatter: one `key: <JSON value>` per line.
const GUIDE_META = {
  title: text(200, { required: true }),
  description: text(320, { required: true }),
  section: { kind: "enum", values: GUIDE_SECTIONS, required: true },
  kind: { kind: "enum", values: GUIDE_KINDS },
  seo_title: text(160),
  cover_url: text(500),
  cover_alt: text(255),
  related_products: { kind: "list" },
  reviewed_by: text(120),
  sort_order: { kind: "int" },
};

export function defaultPatchesDir() {
  return process.env.CONTENT_PATCHES_DIR || path.join(process.cwd(), "content", "patches");
}

/**
 * Reads and validates every patch in `dir` (and the guide files its guide.insert operations name, from the sibling
 * guides/ folder), in filename order. Throws on the first malformed file, before anything is written.
 * @param {string} [dir]
 * @returns {Promise<Array<{ id: string, description: string, operations: Array<Record<string, any>> }>>}
 */
export async function loadPatches(dir = defaultPatchesDir()) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  const guidesDir = path.join(dir, "..", "guides");
  const patches = [];
  for (const file of files) {
    const where = `content patch ${file}`;
    let patch;
    try {
      patch = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    } catch (err) {
      throw new Error(`${where}: not valid JSON (${err.message})`);
    }
    check(patch && typeof patch === "object" && !Array.isArray(patch), where, "must be a JSON object");
    allowKeys(patch, ["id", "description", "operations"], where);
    check(typeof patch.id === "string" && ID.test(patch.id), where, '"id" must be lowercase letters, digits, dots, dashes or underscores');
    check(patch.id === file.slice(0, -".json".length), where, `"id" must match the file name (${file.slice(0, -5)})`);
    check(patch.description === undefined || (typeof patch.description === "string" && patch.description.length <= 255), where, '"description" must be text up to 255 characters');
    check(Array.isArray(patch.operations) && patch.operations.length > 0, where, '"operations" must be a non-empty list');
    const operations = [];
    for (const [i, op] of patch.operations.entries()) operations.push(await validateOperation(op, `${where}, operation ${i + 1}`, guidesDir));
    patches.push({ id: patch.id, description: patch.description ?? "", operations });
  }
  return patches;
}

/**
 * Applies the patches in `dir` that this database hasn't recorded yet. Stops at the first patch that fails (after
 * rolling it back) by throwing.
 * @param {import("mysql2/promise").Pool} pool
 * @param {{ dir?: string, log?: (line: string) => void }} [options]
 * @returns {Promise<string[]>} ids of the patches applied in this run
 */
export async function applyContentPatches(pool, options = {}) {
  const log = options.log ?? ((line) => console.log(`[content] ${line}`));
  const patches = await loadPatches(options.dir);
  if (!patches.length) return [];
  const [rows] = await pool.query("SELECT id FROM content_patches");
  const done = new Set(rows.map((r) => r.id));
  const applied = [];

  for (const patch of patches) {
    if (done.has(patch.id)) continue;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      try {
        // Recorded first: a second server applying the same patch at the same moment waits on this row, then stops here.
        await conn.query("INSERT INTO content_patches (id, description) VALUES (?, ?)", [patch.id, patch.description]);
      } catch (err) {
        if (err?.code !== "ER_DUP_ENTRY") throw err;
        await conn.rollback();
        continue;
      }
      const result = { applied: [], skipped: [] };
      for (const op of patch.operations) await OPERATIONS[op.op](conn, op, result);
      await conn.query("UPDATE content_patches SET log = ? WHERE id = ?", [JSON.stringify(result), patch.id]);
      await conn.commit();
      applied.push(patch.id);
      for (const line of result.applied) log(`${patch.id}: ${line}`);
      for (const line of result.skipped) log(`${patch.id}: skipped ${line}`);
      log(`applied ${patch.id} (${plural(result.applied.length, "change")}, ${result.skipped.length} skipped)`);
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw new Error(`content patch ${patch.id} failed and was rolled back: ${err?.message ?? err}`, { cause: err });
    } finally {
      conn.release();
    }
  }
  return applied;
}

/* ───────────── operations ───────────── */

const OPERATIONS = {
  "product.update": async (conn, op, result) => {
    const [[row]] = await conn.query("SELECT * FROM products WHERE slug = ? FOR UPDATE", [op.slug]);
    const where = `product ${op.slug}`;
    if (!row) {
      result.skipped.push(`${where}: no product with this slug`);
      return;
    }
    let changed = await updateFields(conn, "products", row, op.fields, PRODUCT_FIELDS, where, result);
    for (const image of op.images ?? []) {
      const [images] = await conn.query("SELECT id, alt FROM product_images WHERE product_id = ? AND url = ? FOR UPDATE", [row.id, image.url]);
      if (!images.length) result.skipped.push(`${where}: image ${image.url}: the product has no image with this URL`);
      for (const img of images) {
        // An empty alt is filled too: the page shows the product name for it, so "from" can't tell the two apart.
        const verdict = decide(img.alt, image.alt, true);
        if (verdict) {
          result.skipped.push(`${where}: image ${image.url} alt (${verdict})`);
          continue;
        }
        await conn.query("UPDATE product_images SET alt = ? WHERE id = ?", [image.alt.to, img.id]);
        result.applied.push(`${where}: image ${image.url} alt`);
        changed = true;
      }
    }
    if (changed) await conn.query("UPDATE products SET content_updated_at = UTC_TIMESTAMP() WHERE id = ?", [row.id]);
  },

  "category.update": async (conn, op, result) => {
    const [[row]] = await conn.query("SELECT * FROM categories WHERE slug = ? FOR UPDATE", [op.slug]);
    const where = `category ${op.slug}`;
    if (!row) {
      result.skipped.push(`${where}: no category with this slug`);
      return;
    }
    if (await updateFields(conn, "categories", row, op.fields, CATEGORY_FIELDS, where, result)) {
      await conn.query("UPDATE categories SET content_updated_at = UTC_TIMESTAMP() WHERE id = ?", [row.id]);
    }
  },

  // Literal find and replace (no patterns) inside the announcement bar messages saved in Settings.
  "settings.announcements.replace": async (conn, op, result) => {
    const where = "settings announcements";
    const [[row]] = await conn.query("SELECT value FROM settings WHERE `key` = 'store' FOR UPDATE");
    if (!row) {
      result.skipped.push(`${where}: no saved store settings (the storefront uses the built-in defaults)`);
      return;
    }
    const value = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    const messages = Array.isArray(value?.announcements) ? value.announcements : [];
    let found = false;
    let changed = false;
    const next = messages.map((msg, i) => {
      if (typeof msg !== "string" || !msg.includes(op.find)) return msg;
      found = true;
      const label = `${where}: message ${i + 1} ${JSON.stringify(msg)}`;
      if (op.where_contains && !msg.toLowerCase().includes(op.where_contains.toLowerCase())) {
        result.skipped.push(`${label} (doesn't mention ${JSON.stringify(op.where_contains)})`);
        return msg;
      }
      const out = msg.split(op.find).join(op.replace);
      if (out.length > ANNOUNCEMENT_MAX) {
        result.skipped.push(`${label} (would be longer than ${ANNOUNCEMENT_MAX} characters)`);
        return msg;
      }
      result.applied.push(`${label} -> ${JSON.stringify(out)}`);
      changed = true;
      return out;
    });
    if (!found) result.skipped.push(`${where}: no message contains ${JSON.stringify(op.find)}`);
    if (changed) await conn.query("UPDATE settings SET value = ? WHERE `key` = 'store'", [JSON.stringify({ ...value, announcements: next })]);
  },

  // Adds a published guide from content/guides/<slug>.md unless that slug exists (a guide is never overwritten).
  "guide.insert": async (conn, op, result) => {
    const where = `guide ${op.slug}`;
    const [[exists]] = await conn.query("SELECT id FROM guides WHERE slug = ?", [op.slug]);
    if (exists) {
      result.skipped.push(`${where}: a guide with this slug exists (guides are never overwritten)`);
      return;
    }
    const { meta, body } = op.guide;
    const [inserted] = await conn.query(
      `INSERT INTO guides (slug, title, seo_title, description, section, kind, body, cover_url, cover_alt, related_products, status,
        reviewed_by, reviewed_at, review_due, published_at, content_updated_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 6 MONTH), UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?)`,
      [
        op.slug,
        meta.title,
        meta.seo_title ?? null,
        meta.description,
        meta.section,
        meta.kind ?? "guide",
        body,
        meta.cover_url ?? null,
        meta.cover_alt ?? "",
        JSON.stringify(meta.related_products ?? []),
        meta.reviewed_by ?? null,
        meta.sort_order ?? 0,
      ],
    );
    await conn.query("INSERT INTO guide_revisions (guide_id, title, body) VALUES (?, ?, ?)", [inserted.insertId, meta.title, body]);
    result.applied.push(`${where}: inserted (published)`);
  },
};

/** Writes each field whose current value still matches its "from". Returns whether anything changed. */
async function updateFields(conn, table, row, fields = {}, allowed, where, result) {
  const set = {};
  for (const [field, change] of Object.entries(fields)) {
    const spec = allowed[field];
    const current = isJsonKind(spec) && typeof row[field] === "string" ? JSON.parse(row[field]) : row[field];
    const verdict = decide(current, change, spec.optional);
    if (verdict) result.skipped.push(`${where}: ${field} (${verdict})`);
    else set[field] = isJsonKind(spec) ? JSON.stringify(change.to) : change.to;
  }
  const names = Object.keys(set);
  if (!names.length) return false;
  // Column names come from the allowed-field lists above, never from the patch file as-is.
  await conn.query(`UPDATE ${table} SET ${names.map((n) => `\`${n}\` = ?`).join(", ")} WHERE id = ?`, [...names.map((n) => set[n]), row.id]);
  for (const n of names) result.applied.push(`${where}: ${n}`);
  return true;
}

/** Why a change is skipped, or null to write it. */
function decide(current, change, optional) {
  if (same(current, change.to)) return "already has this value";
  if (same(current, change.from) || (optional && isEmpty(current))) return null;
  return `current value differs from "from"; current: ${preview(current)}`;
}

const collapse = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);
/** Whitespace-collapsed strings; arrays and objects compared by structure (object keys in any order). */
function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, normalize(v[k])]));
  return collapse(v);
}
const isEmpty = (v) => v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
const same = (a, b) => (isEmpty(a) && isEmpty(b)) || JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
const preview = (v) => {
  const s = JSON.stringify(v) ?? "null";
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ───────────── validation ───────────── */

function check(ok, where, message) {
  if (!ok) throw new Error(`${where}: ${message}`);
}

function allowKeys(obj, keys, where) {
  for (const k of Object.keys(obj)) check(keys.includes(k), where, `unknown key "${k}" (allowed: ${keys.join(", ")})`);
}

const isJsonKind = (spec) => spec.kind === "list" || spec.kind === "specs";

/** Checks one value against its field spec; returns an error message or null. */
function invalid(value, spec) {
  if (value === null || value === undefined) return spec.required || spec.notNull ? "can't be empty" : null;
  switch (spec.kind) {
    case "text":
      if (typeof value !== "string") return "must be text";
      if (spec.required && !value.trim()) return "can't be empty";
      return value.length > spec.max ? `must be at most ${spec.max} characters` : null;
    case "gtin":
      return typeof value === "string" && /^(\d{8}|\d{12,14})$/.test(value) ? null : "must be 8, 12, 13 or 14 digits";
    case "list":
      return Array.isArray(value) && value.every((s) => typeof s === "string") ? null : "must be a list of text";
    case "specs":
      return Array.isArray(value) && value.every((s) => s && typeof s.label === "string" && typeof s.value === "string" && Object.keys(s).length === 2)
        ? null
        : 'must be a list of { "label": text, "value": text }';
    case "enum":
      return spec.values.includes(value) ? null : `must be one of ${spec.values.join(", ")}`;
    case "int":
      return Number.isInteger(value) ? null : "must be a whole number";
  }
  return "unknown field type";
}

function validateFields(fields, allowed, where) {
  check(fields && typeof fields === "object" && !Array.isArray(fields), where, '"fields" must be an object');
  for (const [field, change] of Object.entries(fields)) {
    const at = `${where}, field ${field}`;
    check(Object.hasOwn(allowed, field), where, `unknown field "${field}" (allowed: ${Object.keys(allowed).join(", ")})`);
    check(change && typeof change === "object" && "from" in change && "to" in change, at, 'must be { "from": ..., "to": ... }');
    allowKeys(change, ["from", "to"], at);
    const problem = invalid(change.to, allowed[field]);
    check(!problem, at, `"to" ${problem}`);
  }
}

async function validateOperation(op, where, guidesDir) {
  check(op && typeof op === "object" && Object.hasOwn(OPERATIONS, op.op), where, `"op" must be one of ${Object.keys(OPERATIONS).join(", ")}`);
  switch (op.op) {
    case "product.update":
      allowKeys(op, ["op", "slug", "fields", "images"], where);
      check(typeof op.slug === "string" && SLUG.test(op.slug), where, '"slug" must be a product slug');
      check(op.fields !== undefined || op.images !== undefined, where, 'needs "fields", "images" or both');
      if (op.fields !== undefined) validateFields(op.fields, PRODUCT_FIELDS, where);
      if (op.images !== undefined) {
        check(Array.isArray(op.images), where, '"images" must be a list');
        for (const img of op.images) {
          check(img && typeof img.url === "string" && img.url, where, 'each image needs a "url"');
          allowKeys(img, ["url", "alt"], `${where}, image ${img.url}`);
          check(img.alt && "from" in img.alt && "to" in img.alt, `${where}, image ${img.url}`, '"alt" must be { "from": ..., "to": ... }');
          const problem = invalid(img.alt.to, text(255, { notNull: true }));
          check(!problem, `${where}, image ${img.url}`, `alt "to" ${problem}`);
        }
      }
      return op;
    case "category.update":
      allowKeys(op, ["op", "slug", "fields"], where);
      check(typeof op.slug === "string" && SLUG.test(op.slug), where, '"slug" must be a category slug');
      validateFields(op.fields, CATEGORY_FIELDS, where);
      return op;
    case "settings.announcements.replace":
      allowKeys(op, ["op", "find", "replace", "where_contains"], where);
      check(typeof op.find === "string" && op.find !== "", where, '"find" must be non-empty text');
      check(typeof op.replace === "string", where, '"replace" must be text');
      check(op.where_contains === undefined || (typeof op.where_contains === "string" && op.where_contains), where, '"where_contains" must be non-empty text');
      return op;
    case "guide.insert": {
      allowKeys(op, ["op", "slug"], where);
      check(typeof op.slug === "string" && SLUG.test(op.slug), where, '"slug" must be lowercase words joined by dashes');
      const file = path.join(guidesDir, `${op.slug}.md`);
      let source;
      try {
        source = await readFile(file, "utf8");
      } catch {
        throw new Error(`${where}: can't read the guide file ${file}`);
      }
      return { ...op, guide: parseGuideFile(source, `${where} (${op.slug}.md)`) };
    }
  }
}

/**
 * A guide file: frontmatter between two `---` lines with one `key: <JSON value>` per line, then the Markdown body.
 * @param {string} source
 * @param {string} [where]
 * @returns {{ meta: Record<string, any>, body: string }}
 */
export function parseGuideFile(source, where = "guide file") {
  const lines = source.replace(/^﻿/, "").split(/\r?\n/);
  check(lines[0].trim() === "---", where, "must start with a --- line");
  const end = lines.indexOf("---", 1);
  check(end > 0, where, "frontmatter needs a closing --- line");
  const meta = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const m = /^([a-z_]+):\s*(.+)$/.exec(line);
    check(m, where, `frontmatter line ${JSON.stringify(line)} must be key: <JSON value>`);
    check(Object.hasOwn(GUIDE_META, m[1]), where, `unknown frontmatter key "${m[1]}" (allowed: ${Object.keys(GUIDE_META).join(", ")})`);
    try {
      meta[m[1]] = JSON.parse(m[2]);
    } catch {
      throw new Error(`${where}: frontmatter ${m[1]} must be a JSON value (quote text: "like this")`);
    }
  }
  for (const [key, spec] of Object.entries(GUIDE_META)) {
    const problem = invalid(meta[key], spec);
    check(!problem, where, `frontmatter ${key} ${problem}`);
  }
  const body = lines.slice(end + 1).join("\n").trim();
  check(body, where, "has no body");
  return { meta, body: `${body}\n` };
}
