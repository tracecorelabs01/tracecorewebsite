"use client";

import { useEffect, useRef, useState } from "react";
import { centsToInput } from "@/lib/admin/format";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Toggle, type ActionState } from "./forms";

type Kind = "percent" | "fixed";

type OfferDefaults = {
  title: string;
  description: string;
  pointsCost: number;
  kind: Kind;
  /** percent: 1–100, fixed: cents */
  value: number;
  minSubtotalCents: number;
  isActive: boolean;
};

export function LoyaltyOfferForm({
  action,
  offer,
  resetOnSuccess = false,
  submitLabel = "Save offer",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  offer?: OfferDefaults;
  resetOnSuccess?: boolean;
  submitLabel?: string;
}) {
  const o = offer;
  const defaultKind: Kind = o?.kind ?? "fixed";
  const [kind, setKind] = useState<Kind>(defaultKind);
  const root = useRef<HTMLDivElement>(null);

  // ActionForm clears the inputs after a successful create; keep the value label in step with the select.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const onReset = () => setKind(defaultKind);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultKind]);

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
        <Field label={percent ? "Percent off" : "Amount off (USD)"} name="value" hint={percent ? "Whole number from 1 to 100." : "Taken off the order subtotal."}>
          <Input name="value" inputMode={percent ? "numeric" : "decimal"} defaultValue={o ? (o.kind === "percent" ? String(o.value) : centsToInput(o.value)) : ""} placeholder={percent ? "10" : "10.00"} required />
        </Field>
        <Field label="Minimum order (USD)" name="minSubtotal" hint="Leave blank for no minimum.">
          <Input name="minSubtotal" inputMode="decimal" defaultValue={o?.minSubtotalCents ? centsToInput(o.minSubtotalCents) : ""} placeholder="0.00" />
        </Field>
        <Field label="Description" name="description" hint="Optional. Shown under the name." className="sm:col-span-2">
          <Input name="description" defaultValue={o?.description} maxLength={255} placeholder="Works on anything in the store." />
        </Field>
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
