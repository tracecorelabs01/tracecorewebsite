"use client";

import { useActionState, useState, useTransition, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, Loader2, Star } from "lucide-react";
import { changePassword, login, openAccount, redeem, submitReview, type AccountFormState } from "@/actions/account";
import { cn } from "@/lib/utils";

type Action = (prev: AccountFormState, fd: FormData) => Promise<AccountFormState>;

/** Submits through a transition (not the form `action` prop) so a failed attempt keeps what was typed. */
function useAccountForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => formAction(fd));
  };
  return { state, pending, onSubmit };
}

const inputClass = "mt-2 h-12 w-full rounded-xl border border-line-strong bg-ink-900 px-4 outline-none transition-colors placeholder:text-dim focus:border-blaze";

function Field({ label, error, hint, className, ...props }: { label: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="type-kicker text-dim">{label}</span>
      <input {...props} aria-invalid={error ? true : undefined} className={cn(inputClass, error && "border-ember")} />
      {error ? <span className="mt-1.5 block text-xs text-[#ff6b5e]">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-dim">{hint}</span> : null}
    </label>
  );
}

function Submit({ pending, children, className }: { pending: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex h-12 items-center justify-center gap-2.5 bg-brand px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:13px] hover:brightness-110 disabled:opacity-70",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function Status({ state }: { state: AccountFormState }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-ok" : "text-[#ff6b5e]")}>
      {state.message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, onSubmit } = useAccountForm(login);
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Status state={state} />
      <Submit pending={pending}>Log in</Submit>
    </form>
  );
}

export function OpenAccountForm({ email, order }: { email?: string; order?: string }) {
  const { state, pending, onSubmit } = useAccountForm(openAccount);
  const e = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Email you ordered with" name="email" type="email" autoComplete="email" defaultValue={email} error={e.email} required />
      <Field label="Order number" name="order" defaultValue={order} placeholder="TCL-XXXXXX" autoComplete="off" spellCheck={false} error={e.order} hint="From your order confirmation." className="[&_input]:uppercase" required />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={e.password} hint="At least 10 characters." required />
      <Field label="Repeat password" name="confirm" type="password" autoComplete="new-password" error={e.confirm} required />
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Status state={state} />
        <Submit pending={pending} className="sm:ml-auto">
          Open my account
        </Submit>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const { state, pending, onSubmit } = useAccountForm(changePassword);
  const e = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" error={e.current} className="sm:col-span-2" required />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={e.password} hint="At least 10 characters." required />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" error={e.confirm} required />
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Status state={state} />
        <Submit pending={pending} className="sm:ml-auto">
          Change password
        </Submit>
      </div>
    </form>
  );
}

export function ReviewForm({ productId, defaultName }: { productId: number; defaultName: string }) {
  const { state, pending, onSubmit } = useAccountForm(submitReview.bind(null, productId));
  const [rating, setRating] = useState(0);
  const e = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset>
        <legend className="type-kicker text-dim">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <Star className={cn("size-6 transition-colors", n <= rating ? "fill-blaze text-blaze" : "text-white/25")} aria-hidden />
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
        {e.rating && <span className="mt-1 block text-xs text-[#ff6b5e]">{e.rating}</span>}
      </fieldset>
      <label className="block">
        <span className="type-kicker text-dim">Your review</span>
        <textarea name="body" rows={4} maxLength={2000} placeholder="What did you like? How was setup?" className={cn("mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink-900 px-4 py-3 outline-none transition-colors placeholder:text-dim focus:border-blaze", e.body && "border-ember")} />
        {e.body && <span className="mt-1 block text-xs text-[#ff6b5e]">{e.body}</span>}
      </label>
      <Field label="Name shown with it" name="name" defaultValue={defaultName} maxLength={80} error={e.name} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Status state={state} />
        <Submit pending={pending} className="sm:ml-auto">
          Send review
        </Submit>
      </div>
    </form>
  );
}

export function RedeemButton({ offerId, short }: { offerId: number; short: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  if (result?.ok) return <p className="text-sm text-ok">{result.message}</p>;
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={pending || short > 0}
        onClick={() => start(async () => setResult(await redeem(offerId)))}
        className="flex h-10 items-center justify-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:10px] hover:brightness-110 disabled:bg-none disabled:bg-white/[0.06] disabled:text-dim"
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {short > 0 ? `${short.toLocaleString("en-US")} more points` : "Redeem"}
      </button>
      {result && <p className="text-xs text-[#ff6b5e]">{result.message}</p>}
    </div>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}
      className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 font-mono text-sm tracking-wider transition-colors hover:border-blaze"
      aria-label={`Copy code ${code}`}
    >
      {code}
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5 text-dim" />}
    </button>
  );
}
