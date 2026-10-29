"use client";

import { centsToInput } from "@/lib/admin/format";
import { PAYMENT_METHODS } from "@/lib/expenses";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, type ActionState } from "./forms";

type ExpenseDefaults = {
  spentOn: string;
  amountCents: number;
  category: string;
  vendor: string;
  description: string;
  paymentMethod: string;
  reference: string;
};

export function ExpenseForm({
  action,
  expense,
  today,
  categories,
  resetOnSuccess = false,
  submitLabel = "Save expense",
  compact = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  expense?: ExpenseDefaults;
  /** Default date for a new expense (UTC), from the server so the first render matches. */
  today: string;
  categories: string[];
  resetOnSuccess?: boolean;
  submitLabel?: string;
  /** One column, for the side panel. */
  compact?: boolean;
}) {
  const e = expense;
  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} showStatus={false}>
      <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        <Field label="Amount (USD)" name="amount">
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dim">$</span>
            <Input name="amount" inputMode="decimal" defaultValue={e ? centsToInput(e.amountCents) : ""} placeholder="0.00" required className="pl-7 tabular-nums" autoComplete="off" />
          </span>
        </Field>
        <Field label="Date paid" name="spentOn" hint="Dates are in UTC, like the rest of the console.">
          <Input name="spentOn" type="date" defaultValue={e?.spentOn ?? today} required />
        </Field>
        <Field label="Category" name="category" hint="Pick one or type your own.">
          <Input name="category" defaultValue={e?.category} list="expense-categories" maxLength={60} required placeholder="Shipping & postage" autoComplete="off" />
          <datalist id="expense-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Paid to" name="vendor" hint="Supplier, courier, service…">
          <Input name="vendor" defaultValue={e?.vendor} maxLength={120} placeholder="DHL Express" />
        </Field>
        <Field label="Payment method" name="paymentMethod">
          <Select name="paymentMethod" defaultValue={e?.paymentMethod ?? ""}>
            <option value="">Not recorded</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice or receipt no." name="reference">
          <Input name="reference" defaultValue={e?.reference} maxLength={120} placeholder="INV-1042" autoComplete="off" />
        </Field>
        <Field label="Notes" name="description" className={compact ? undefined : "sm:col-span-2 lg:col-span-3"}>
          <Textarea name="description" defaultValue={e?.description} maxLength={500} rows={2} className="min-h-0" placeholder="What it was for" />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        <FormStatus className="mt-0" />
        <SubmitButton pendingText="Saving…" className={compact ? "w-full" : undefined}>
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
