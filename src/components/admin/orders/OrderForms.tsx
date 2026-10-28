"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea, Toggle, type ActionState } from "@/components/admin/forms";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A local edit of a value that lives on the server. The edit is dropped as soon as the server value
 * changes (e.g. another form on the page moved the order on), so a select never shows — or
 * re-submits — a stale value, while a failed submit keeps the user's choice.
 */
function useDraft<T>(server: T) {
  const [draft, setDraft] = useState<{ base: T; value: T } | null>(null);
  const value = draft && Object.is(draft.base, server) ? draft.value : server;
  return [value, (next: T) => setDraft({ base: server, value: next })] as const;
}

function Hint({ children, tone }: { children: ReactNode; tone?: "warn" }) {
  return <p className={cn("text-xs", tone === "warn" ? "text-warn" : "text-dim")}>{children}</p>;
}

function StatusOptions({ statuses, current }: { statuses: readonly string[]; current: string }) {
  return statuses.map((s) => (
    <option key={s} value={s}>
      {label(s)}
      {s === current ? " (current)" : ""}
    </option>
  ));
}

export function StatusForm({
  action,
  status,
  statuses,
  restockUnits,
  restocked,
  emailEnabled,
}: {
  action: Action;
  status: string;
  statuses: readonly string[];
  /** Units with tracked stock that cancelling can put back. */
  restockUnits: number;
  /** This order's items were already put back once. */
  restocked: boolean;
  emailEnabled: boolean;
}) {
  const [next, setNext] = useDraft(status);
  const changing = next !== status;
  const blocked = status === "cancelled" && (next === "shipped" || next === "delivered");
  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="Order status" name="status">
        <Select name="status" value={next} onChange={(e) => setNext(e.target.value)}>
          <StatusOptions statuses={statuses} current={status} />
        </Select>
      </Field>
      {changing &&
        next === "cancelled" &&
        (restockUnits > 0 && !restocked ? (
          <Toggle
            name="restock"
            label="Restock items"
            description={`Puts ${restockUnits} tracked unit${restockUnits === 1 ? "" : "s"} back in inventory. Reopening the order later won't deduct them again.`}
            defaultChecked={status === "pending" || status === "processing"}
          />
        ) : (
          <Hint>{restocked ? "This order's items were already restocked." : "Nothing to restock — none of these items track stock."}</Hint>
        ))}
      {changing && next === "shipped" && !blocked && status !== "delivered" && <Hint>{emailEnabled ? "The customer will be emailed a shipping confirmation." : "Email isn't set up, so the customer won't be notified."}</Hint>}
      {changing && next === "refunded" && <Hint>Also marks the payment as refunded.</Hint>}
      {blocked && <Hint tone="warn">A cancelled order has to go back to processing before it can be marked {next}.</Hint>}
      <SubmitButton variant="secondary" className="w-full" pendingText="Updating…">
        Update status
      </SubmitButton>
    </ActionForm>
  );
}

export function PaymentForm({
  action,
  paymentStatus,
  paymentRef,
  statuses,
  canAdvance,
}: {
  action: Action;
  paymentStatus: string;
  paymentRef: string | null;
  statuses: readonly string[];
  /** The order is still pending, so marking it paid can also queue it for fulfilment. */
  canAdvance: boolean;
}) {
  const [next, setNext] = useDraft(paymentStatus);
  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="Payment status" name="paymentStatus">
        <Select name="paymentStatus" value={next} onChange={(e) => setNext(e.target.value)}>
          <StatusOptions statuses={statuses} current={paymentStatus} />
        </Select>
      </Field>
      <Field label="Payment reference" name="paymentRef" hint="Transaction, invoice or wallet ID — optional.">
        {/* Keyed so a newly saved value replaces what's shown. */}
        <Input key={paymentRef ?? ""} name="paymentRef" defaultValue={paymentRef ?? ""} maxLength={191} autoComplete="off" className="font-mono text-xs" />
      </Field>
      {canAdvance && next === "paid" && paymentStatus !== "paid" && <Toggle name="advance" label="Move to processing" description="Queue the order for fulfilment." defaultChecked />}
      <SubmitButton variant="secondary" className="w-full" pendingText="Saving…">
        Update payment
      </SubmitButton>
    </ActionForm>
  );
}

export function ShippingForm({
  action,
  carrier,
  trackingNumber,
  canShip,
  emailEnabled,
}: {
  action: Action;
  carrier: string | null;
  trackingNumber: string | null;
  /** Not shipped yet — offer to mark it shipped in the same step. */
  canShip: boolean;
  emailEnabled: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="Carrier" name="trackingCarrier">
        <Input key={carrier ?? ""} name="trackingCarrier" defaultValue={carrier ?? ""} maxLength={60} autoComplete="off" />
      </Field>
      <Field label="Tracking number" name="trackingNumber">
        <Input key={trackingNumber ?? ""} name="trackingNumber" defaultValue={trackingNumber ?? ""} maxLength={120} autoComplete="off" className="font-mono text-xs" />
      </Field>
      {canShip && <Toggle name="markShipped" label="Mark as shipped" description={emailEnabled ? "Also emails the customer a shipping confirmation." : "Also sets the order status to shipped."} />}
      <SubmitButton variant="secondary" className="w-full" pendingText="Saving…">
        Save tracking
      </SubmitButton>
    </ActionForm>
  );
}

export function InternalNoteForm({ action, note }: { action: Action; note: string | null }) {
  return (
    <ActionForm action={action} className="space-y-3">
      <Textarea key={note ?? ""} name="internalNote" defaultValue={note ?? ""} rows={4} maxLength={5000} aria-label="Internal note" placeholder="Packing notes, follow-ups, context for the team…" />
      <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
        Save note
      </SubmitButton>
    </ActionForm>
  );
}
