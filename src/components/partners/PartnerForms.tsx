"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { applyAsPartner, requestPartnerPayout, savePayoutEmail, type PartnerFormState } from "@/actions/partner";
import { Field, Status, Submit } from "@/components/account/AccountForms";
import { cn } from "@/lib/utils";

type Action = (prev: PartnerFormState, fd: FormData) => Promise<PartnerFormState>;

/** Submits through a transition so a failed attempt keeps what was typed. */
function usePartnerForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => formAction(fd));
  };
  return { state, pending, onSubmit };
}

export function ApplyForm({ defaultName }: { defaultName: string }) {
  const { state, pending, onSubmit } = usePartnerForm(applyAsPartner);
  const e = state?.fieldErrors ?? {};
  if (state?.ok) return <Status state={state} />;
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Channel, shop or display name" name="name" defaultValue={defaultName} maxLength={120} error={e.name} required />
      <Field label="Website or main channel (optional)" name="website" type="url" placeholder="https://" maxLength={255} error={e.website} />
      <label className="block sm:col-span-2">
        <span className="type-kicker text-dim">Where and how would you promote us?</span>
        <textarea
          name="audience"
          rows={5}
          maxLength={2000}
          placeholder="Your channels or community, audience size, and what you'd make: reviews, setup guides, streams…"
          className={cn("mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink-900 px-4 py-3 outline-none transition-colors placeholder:text-dim focus:border-blaze", e.audience && "border-ember")}
        />
        {e.audience && <span className="mt-1.5 block text-xs text-[#ff6b5e]">{e.audience}</span>}
      </label>
      <Field label="PayPal email for payouts (optional)" name="paypalEmail" type="email" autoComplete="email" maxLength={191} error={e.paypalEmail} hint="You can add or change it later." className="sm:col-span-2" />
      <label className="flex items-start gap-3 text-sm text-muted sm:col-span-2">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[#ff3d00]" />
        <span>
          I agree to the{" "}
          <Link href="/legal/affiliate" target="_blank" className="text-fg underline underline-offset-4">
            partner program terms
          </Link>
          , including promoting the products honestly and saying when a link is an affiliate link.
          {e.terms && <span className="mt-1 block text-xs text-[#ff6b5e]">{e.terms}</span>}
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Status state={state} />
        <Submit pending={pending} className="sm:ml-auto">
          Send application
        </Submit>
      </div>
    </form>
  );
}

export function PayoutEmailForm({ email }: { email: string | null }) {
  const { state, pending, onSubmit } = usePartnerForm(savePayoutEmail);
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <Field label="PayPal email" name="paypalEmail" type="email" defaultValue={email ?? ""} maxLength={191} error={state?.fieldErrors?.paypalEmail} required />
      <div className="flex items-center justify-between gap-3">
        <Status state={state} />
        <Submit pending={pending} className="ml-auto h-10 px-5 text-[11px]">
          Save
        </Submit>
      </div>
    </form>
  );
}

/** Pay out the available balance: as store credit now, or by PayPal once the team sends it. */
export function PayoutButtons({ availableCents, minPayoutCents, hasPaypal }: { availableCents: number; minPayoutCents: number; hasPaypal: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const amount = `$${(availableCents / 100).toFixed(2)}`;
  const run = (method: "paypal" | "store_credit", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    start(async () => setResult(await requestPartnerPayout(method)));
  };
  const button =
    "flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending || availableCents <= 0}
          onClick={() => run("store_credit", `Turn ${amount} into a store credit code? It works once, on an order of ${amount} or more.`)}
          className={cn(button, "border-blaze bg-brand text-white hover:brightness-110")}
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Store credit
        </button>
        <button
          type="button"
          disabled={pending || !hasPaypal || availableCents < minPayoutCents || availableCents <= 0}
          onClick={() => run("paypal", `Ask for ${amount} by PayPal?`)}
          className={cn(button, "border-line-strong text-fg hover:border-blaze")}
        >
          PayPal
        </button>
      </div>
      {!hasPaypal && <p className="text-xs text-dim">Add your PayPal email below to be paid by PayPal.</p>}
      {hasPaypal && availableCents < minPayoutCents && <p className="text-xs text-dim">PayPal payouts start at ${(minPayoutCents / 100).toFixed(2)}.</p>}
      {result && <p className={cn("text-sm", result.ok ? "text-ok" : "text-[#ff6b5e]")}>{result.message}</p>}
    </div>
  );
}

export function CopyText({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 font-mono text-sm transition-colors hover:border-blaze"
      aria-label={`Copy ${label ?? text}`}
    >
      <span className="truncate">{label ?? text}</span>
      {copied ? <Check className="size-3.5 shrink-0 text-ok" /> : <Copy className="size-3.5 shrink-0 text-dim" />}
    </button>
  );
}
