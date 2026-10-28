"use client";

import { useEffect, useRef, useState } from "react";
import { centsToInput } from "@/lib/admin/format";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Toggle, type ActionState } from "./forms";

type Kind = "percent" | "fixed";

type DiscountDefaults = {
  code: string;
  kind: Kind;
  /** percent: 1–100, fixed: cents */
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

/** Date → `datetime-local` value in UTC ("2026-11-01T09:00"). The action reads it back as UTC. */
const utcInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export function DiscountForm({
  action,
  discount,
  resetOnSuccess = false,
  submitLabel = "Save code",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  discount?: DiscountDefaults;
  resetOnSuccess?: boolean;
  submitLabel?: string;
}) {
  const d = discount;
  const defaultKind: Kind = d?.kind ?? "percent";
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
        <Field label="Code" name="code" hint="Letters, numbers, - and _. Customers can type it in any case.">
          <Input name="code" defaultValue={d?.code} required maxLength={40} placeholder="LAUNCH15" autoComplete="off" spellCheck={false} className="font-mono uppercase" />
        </Field>
        <Field label="Type" name="kind">
          <Select name="kind" defaultValue={defaultKind} onChange={(e) => setKind(e.target.value === "fixed" ? "fixed" : "percent")}>
            <option value="percent">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
          </Select>
        </Field>
        <Field label={percent ? "Percent off" : "Amount off (USD)"} name="value" hint={percent ? "Whole number from 1 to 100." : "Taken off the order subtotal."}>
          <Input
            name="value"
            inputMode={percent ? "numeric" : "decimal"}
            defaultValue={d ? (d.kind === "percent" ? String(d.value) : centsToInput(d.value)) : ""}
            placeholder={percent ? "15" : "20.00"}
            required
          />
        </Field>
        <Field label="Minimum subtotal (USD)" name="minSubtotal" hint="Leave blank for no minimum.">
          <Input name="minSubtotal" inputMode="decimal" defaultValue={d?.minSubtotalCents ? centsToInput(d.minSubtotalCents) : ""} placeholder="0.00" />
        </Field>
        <Field label="Usage limit" name="maxUses" hint="Total redemptions. Blank = unlimited.">
          <Input name="maxUses" type="number" min={1} step={1} defaultValue={d?.maxUses ?? ""} placeholder="Unlimited" />
        </Field>
        {d && (
          <Field label="Times used" hint="Counted at checkout. Read-only.">
            <Input value={d.usedCount} readOnly className="font-mono tabular-nums text-muted" />
          </Field>
        )}
        <Field label="Starts" name="startsAt" hint="Time in UTC. Blank = usable right away.">
          <Input name="startsAt" type="datetime-local" defaultValue={utcInput(d?.startsAt)} />
        </Field>
        <Field label="Ends" name="endsAt" hint="Time in UTC. Blank = never expires.">
          <Input name="endsAt" type="datetime-local" defaultValue={utcInput(d?.endsAt)} />
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Toggle name="isActive" label="Enabled" description="Turn off to pause the code without deleting it." defaultChecked={d?.isActive ?? true} />
        <div className="flex flex-wrap items-center gap-3">
          <FormStatus className="mt-0" />
          <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
