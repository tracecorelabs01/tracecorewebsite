// Product costs (supplier price, postage, payment fees): what a sale costs the business. Shared by the admin forms
// (client), checkout, which records each order's costs, and the profit reports. Values are cents, or hundredths of a
// percent for "percent" (185 = 1.85%).

import type { COST_KINDS } from "@/db/schema";
import { money } from "@/lib/admin/format";

export type CostKind = (typeof COST_KINDS)[number];
export type CostField = { id: number; name: string; kind: CostKind; defaultValue: number | null };
/** A product's own values, by cost field id. */
export type CostValues = Record<number, number>;
export type CostLine = { name: string; cents: number };

export const COST_KIND_LABELS: Record<CostKind, string> = {
  "per-item": "Amount per item",
  "per-order": "Amount per order",
  percent: "Percent of the order total",
};

export const COST_KIND_HINTS: Record<CostKind, string> = {
  "per-item": "Counted for every unit sold.",
  "per-order": "Counted once per order. An order with several products uses the highest of their values.",
  percent: "Of what the customer paid, shipping included and after discounts.",
};

/** A cost as typed in a form ("120", "$1,200.50", "1.85%") → its stored value, null when blank, NaN when invalid. */
export function parseCost(kind: CostKind, raw: string) {
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > (kind === "percent" ? 100 : 1_000_000)) return NaN;
  return Math.round(n * 100);
}

/** The stored value as a form shows it: "120.00", or "1.85" for a percent. */
export const costInput = (value: number | null | undefined) => (value == null ? "" : (value / 100).toFixed(2));

/** "$120.00" or "1.85%". */
export const formatCost = (kind: CostKind, value: number) =>
  kind === "percent" ? `${(value / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : money(value);

/**
 * What a sale costs, by cost field. Each product uses its own value, else the field's default. A percent applies to
 * each product's share of the order total. Fields that come to $0 are left out.
 */
export function saleCosts(fields: CostField[], sale: { totalCents: number; lines: { values?: CostValues; qty: number; lineTotalCents: number }[] }): CostLine[] {
  const subtotal = sale.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const share = (lineTotalCents: number) => (subtotal ? (sale.totalCents * lineTotalCents) / subtotal : sale.totalCents / sale.lines.length);
  return fields
    .map((f) => {
      const values = sale.lines.map((l) => l.values?.[f.id] ?? f.defaultValue ?? 0);
      const cents =
        f.kind === "per-order"
          ? Math.max(0, ...values)
          : f.kind === "per-item"
            ? sale.lines.reduce((sum, l, i) => sum + values[i] * l.qty, 0)
            : sale.lines.reduce((sum, l, i) => sum + (share(l.lineTotalCents) * values[i]) / 10_000, 0);
      return { name: f.name, cents: Math.round(cents) };
    })
    .filter((c) => c.cents > 0);
}

export const totalCost = (costs: CostLine[]) => costs.reduce((sum, c) => sum + c.cents, 0);
