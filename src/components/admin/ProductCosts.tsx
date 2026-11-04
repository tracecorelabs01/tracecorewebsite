"use client";

import { useState } from "react";
import Link from "next/link";
import { money, parseCents } from "@/lib/admin/format";
import { COST_KIND_HINTS, costInput, formatCost, parseCost, saleCosts, totalCost, type CostField, type CostValues } from "@/lib/costs";
import { cn } from "@/lib/utils";
import { Field, Input } from "./forms";
import { Card } from "./ui";

export type ProductCostSetup = {
  fields: CostField[];
  /** This product's own values (none for a new product). */
  values: CostValues;
  /** Store shipping, to work out what a customer pays for one of these on its own. */
  shipping: { flatCents: number; freeOverCents: number };
};

/** The product's costs (Expenses > Product costs) and the profit on one sold on its own, worked out as you type. */
export function ProductCosts({ price, fields, values, shipping }: ProductCostSetup & { price: string }) {
  const [inputs, setInputs] = useState<Record<number, string>>(() => Object.fromEntries(fields.map((f) => [f.id, costInput(values[f.id])])));

  if (!fields.length) {
    return (
      <Card title="Costs">
        <p className="text-sm text-muted">
          Add costs such as supplier price, postage and payment fees in{" "}
          <Link href="/admin/expenses/costs" className="text-fg underline underline-offset-4 hover:text-amber">
            Expenses → Product costs
          </Link>
          , then set them here to see this product&apos;s profit.
        </p>
      </Card>
    );
  }

  const own: CostValues = {};
  for (const f of fields) {
    const v = parseCost(f.kind, inputs[f.id] ?? "");
    if (v !== null && !Number.isNaN(v)) own[f.id] = v;
  }
  const priceCents = parseCents(price) || 0;
  const shippingCents = priceCents >= shipping.freeOverCents ? 0 : shipping.flatCents;
  const paid = priceCents + shippingCents;
  const costs = saleCosts(fields, { totalCents: paid, lines: [{ values: own, qty: 1, lineTotalCents: priceCents }] });
  const profit = paid - totalCost(costs);

  return (
    <div id="costs" className="scroll-mt-24">
      <Card title="Costs" description="What a sale of this product costs you. Leave a cost blank to use its default.">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <Field
              key={f.id}
              label={`${f.name} (${f.kind === "percent" ? "%" : "USD"})`}
              name={`cost:${f.id}`}
              hint={`${COST_KIND_HINTS[f.kind]}${f.defaultValue != null ? ` Default: ${formatCost(f.kind, f.defaultValue)}.` : ""}`}
            >
              <Input
                name={`cost:${f.id}`}
                inputMode="decimal"
                value={inputs[f.id] ?? ""}
                onChange={(e) => setInputs({ ...inputs, [f.id]: e.target.value })}
                placeholder={f.defaultValue != null ? costInput(f.defaultValue) : "0.00"}
                autoComplete="off"
                className="tabular-nums"
              />
            </Field>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-line bg-ink-950/60 p-4 text-sm">
          <p className="mb-3 text-xs text-dim">One of these ordered on its own</p>
          <dl className="space-y-1.5 tabular-nums">
            <Row label="Price" value={money(priceCents)} />
            <Row label={shippingCents ? "Shipping charged" : "Shipping charged (free over the threshold)"} value={money(shippingCents)} />
            <Row label="Customer pays" value={money(paid)} strong />
            {costs.map((c) => (
              <Row key={c.name} label={c.name} value={`−${money(c.cents)}`} muted />
            ))}
            <div className="border-t border-line pt-2">
              <Row
                label="Profit"
                value={`${money(profit)}${paid > 0 ? ` · ${((profit / paid) * 100).toFixed(1)}%` : ""}`}
                strong
                tone={profit < 0 ? "text-warn" : profit > 0 ? "text-ok" : undefined}
              />
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, strong, muted, tone }: { label: string; value: string; strong?: boolean; muted?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn(muted ? "text-dim" : "text-muted")}>{label}</dt>
      <dd className={cn("font-mono", strong && "font-semibold text-fg", muted && "text-muted", tone)}>{value}</dd>
    </div>
  );
}
