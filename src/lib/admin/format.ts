export function money(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

/** Dollars string from a form ("12.50", "$1,200") → integer cents, or null when blank/invalid. */
export function parseCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

export function centsToInput(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** One item per line, trimmed, blanks dropped. */
export function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function csvEscape(value: unknown) {
  const s = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formula injection. Always quote, so a ";" can't start a new
  // cell (and a formula) in locales where Excel splits on semicolons.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** First value of a search param. */
export function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

export function pageParam(value: string | string[] | undefined) {
  const n = Number(param(value));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Most rows one bulk action may touch (a page of results is 25). */
export const BULK_MAX = 100;

/** The selected row ids, chosen action and its value from a bulk-edit form. Ids are deduped, positive integers only. */
export function bulkInput(fd: FormData) {
  const ids = [...new Set(fd.getAll("ids").map((v) => Number(v)))].filter((n) => Number.isInteger(n) && n > 0).slice(0, BULK_MAX);
  return { ids, action: String(fd.get("action") ?? ""), value: String(fd.get("value") ?? "").trim() };
}
