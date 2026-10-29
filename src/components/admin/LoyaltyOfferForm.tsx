"use client";

import { useEffect, useRef, useState } from "react";
import { centsToInput, money } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Toggle, useActionForm, type ActionState } from "./forms";

type Kind = "percent" | "fixed";
type AppliesTo = "order" | "products";
export type OfferProduct = { id: number; name: string; priceCents: number; status: "active" | "draft" | "archived" };

type OfferDefaults = {
  title: string;
  description: string;
  pointsCost: number;
  kind: Kind;
  /** percent: 1–100, fixed: cents */
  value: number;
  minSubtotalCents: number;
  /** null: the whole order */
  productIds: number[] | null;
  isActive: boolean;
};

export function LoyaltyOfferForm({
  action,
  offer,
  products,
  resetOnSuccess = false,
  submitLabel = "Save offer",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  offer?: OfferDefaults;
  products: OfferProduct[];
  resetOnSuccess?: boolean;
  submitLabel?: string;
}) {
  const o = offer;
  const defaultKind: Kind = o?.kind ?? "fixed";
  const defaultAppliesTo: AppliesTo = o?.productIds?.length ? "products" : "order";
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [appliesTo, setAppliesTo] = useState<AppliesTo>(defaultAppliesTo);
  const root = useRef<HTMLDivElement>(null);

  // ActionForm clears the inputs after a successful create; keep the labels and the product list in step.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setKind(defaultKind);
      setAppliesTo(defaultAppliesTo);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultKind, defaultAppliesTo]);

  const percent = kind === "percent";
  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} showStatus={false}>
      <div ref={root} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" name="title" hint="What customers see, e.g. $10 off your next order." className="sm:col-span-2">
          <Input name="title" defaultValue={o?.title} maxLength={80} placeholder="$10 off your next order" required />
        </Field>
        <Field label="Points it costs" name="pointsCost" hint="Customers earn 100 points per $1 by default.">
          <Input name="pointsCost" inputMode="numeric" defaultValue={o?.pointsCost} placeholder="10000" required className="tabular-nums" />
        </Field>
        <Field label="Reward" name="kind">
          <Select name="kind" defaultValue={defaultKind} onChange={(e) => setKind(e.target.value === "percent" ? "percent" : "fixed")}>
            <option value="fixed">Amount off</option>
            <option value="percent">Percentage off</option>
          </Select>
        </Field>
        <Field label={percent ? "Percent off" : "Amount off (USD)"} name="value" hint={percent ? "Whole number from 1 to 100." : appliesTo === "products" ? "Taken off the chosen products." : "Taken off the order subtotal."}>
          <Input name="value" inputMode={percent ? "numeric" : "decimal"} defaultValue={o ? (o.kind === "percent" ? String(o.value) : centsToInput(o.value)) : ""} placeholder={percent ? "10" : "10.00"} required />
        </Field>
        <Field label="Minimum order (USD)" name="minSubtotal" hint="Leave blank for no minimum.">
          <Input name="minSubtotal" inputMode="decimal" defaultValue={o?.minSubtotalCents ? centsToInput(o.minSubtotalCents) : ""} placeholder="0.00" />
        </Field>
        <Field label="Description" name="description" hint="Optional. Shown under the name." className="sm:col-span-2">
          <Input name="description" defaultValue={o?.description} maxLength={255} placeholder="Works on anything in the store." />
        </Field>
        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className="mb-1.5 text-xs font-medium text-muted">Applies to</legend>
          <div className="inline-flex rounded-lg border border-line-strong p-1" role="radiogroup">
            {(
              [
                ["order", "Whole order"],
                ["products", "Specific products"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors", appliesTo === value ? "bg-brand text-white" : "text-muted hover:text-fg")}
              >
                <input type="radio" name="appliesTo" value={value} checked={appliesTo === value} onChange={() => setAppliesTo(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {/* Kept mounted while hidden so ticks survive switching back and forth. */}
          <div hidden={appliesTo !== "products"} className="mt-3">
            <ProductPicker products={products} selected={o?.productIds ?? []} />
          </div>
        </fieldset>
      </div>
      <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Toggle name="isActive" label="Show to customers" description="Hidden offers can't be redeemed. Codes already issued keep working." defaultChecked={o?.isActive ?? true} />
        <div className="flex flex-wrap items-center gap-3">
          <FormStatus className="mt-0" />
          <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

/** Tick the products the offer's codes discount. Long catalogues get a search box. */
function ProductPicker({ products, selected }: { products: OfferProduct[]; selected: number[] }) {
  const { state } = useActionForm();
  const error = state?.fieldErrors?.productIds;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  if (!products.length) return <p className="text-sm text-muted">There are no products yet. Add some under Products first.</p>;
  return (
    <div>
      {products.length > 9 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          className="mb-3 h-9 w-full max-w-xs rounded-lg border border-line-strong bg-ink-900 px-3 text-sm outline-none transition-colors placeholder:text-dim focus:border-blaze"
        />
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          // Filtered-out products stay in the form so their ticks are still sent.
          <li key={p.id} hidden={Boolean(q) && !p.name.toLowerCase().includes(q)}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line-strong px-3 py-2.5 transition-colors hover:border-white/25 has-[:checked]:border-blaze has-[:checked]:bg-blaze/[0.06]">
              <input type="checkbox" name="productIds" value={p.id} defaultChecked={selected.includes(p.id)} className="size-4 shrink-0 accent-[#ff3d00]" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg" title={p.name}>
                {p.name}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-dim">
                {money(p.priceCents)}
                {p.status === "draft" && " · draft"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-[#ff6b5e]">{error}</p>}
    </div>
  );
}
