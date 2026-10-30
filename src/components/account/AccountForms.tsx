"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, Loader2, Star } from "lucide-react";
import { login, redeem, requestCode, requestTrackCode, submitReview, verifyTrackCode, type AccountFormState } from "@/actions/account";
import { cn } from "@/lib/utils";

type Action = (prev: AccountFormState, fd: FormData) => Promise<AccountFormState>;

/** Submits through a transition (not the form `action` prop) so a failed attempt keeps what was typed. */
function useAccountForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // With the button that was pressed, so a second submit button (name/value) can change what the form asks for.
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
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

// The same two steps sign an account in, or show a guest their orders on /track.
const FLOWS = {
  account: { request: requestCode, verify: login, submit: "Log in", tip: "this is your account's email." },
  track: { request: requestTrackCode, verify: verifyTrackCode, submit: "Show my orders", tip: "this is the email you ordered with." },
};
type Flow = keyof typeof FLOWS;

/** Sign in with a code: enter the email, then the 6-digit code we email to it. */
export function LoginForm({ email, next, flow = "account" }: { email?: string; next?: string; flow?: Flow }) {
  // Changing the key starts over with a fresh email step.
  const [round, setRound] = useState(0);
  return <EmailStep key={round} email={email} next={next} flow={flow} onRestart={() => setRound((n) => n + 1)} />;
}

/** Guests: see the orders placed with an email, after a code sent to it. */
export function TrackForm({ email }: { email?: string }) {
  return <LoginForm email={email} flow="track" />;
}

function EmailStep({ email, next, flow, onRestart }: { email?: string; next?: string; flow: Flow; onRestart: () => void }) {
  const { state, pending, onSubmit } = useAccountForm(FLOWS[flow].request);
  if (state?.ok && state.email) return <CodeStep email={state.email} next={next} flow={flow} create={state.create} sent={state.message} onRestart={onRestart} />;
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email ?? email} error={state?.fieldErrors?.email} hint="The one you ordered with." required />
      <Status state={state} />
      {state?.guest ? (
        // Orders but no account: create it with a code, or just track the orders.
        <div className="grid gap-3">
          <button
            type="submit"
            name="create"
            value="1"
            disabled={pending}
            className="flex h-12 items-center justify-center gap-2.5 bg-brand px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:13px] hover:brightness-110 disabled:opacity-70"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create my account
          </button>
          <Link href={`/track?${new URLSearchParams({ email: state.email ?? "" })}`} className="text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Or track your orders without an account
          </Link>
        </div>
      ) : (
        <Submit pending={pending}>Email me a code</Submit>
      )}
    </form>
  );
}

function CodeStep({ email, next, flow, create, sent, onRestart }: { email: string; next?: string; flow: Flow; create?: boolean; sent?: string; onRestart: () => void }) {
  const { state, pending, onSubmit } = useAccountForm(FLOWS[flow].verify);
  const [resent, setResent] = useState<AccountFormState>(null);
  const [resending, startResend] = useTransition();
  const resend = () =>
    startResend(async () => {
      const fd = new FormData();
      fd.set("email", email);
      if (create) fd.set("create", "1");
      setResent(await FLOWS[flow].request(null, fd));
    });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <p role="status" className="text-sm text-muted">
        {sent}
      </p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next ?? ""} />
      {create && <input type="hidden" name="create" value="1" />}
      <Field
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        error={state?.fieldErrors?.code}
        className="[&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.4em]"
        required
      />
      <Status state={state} />
      <Submit pending={pending}>{create ? "Create my account" : FLOWS[flow].submit}</Submit>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <button type="button" onClick={resend} disabled={resending} className="underline-offset-4 hover:text-fg hover:underline disabled:opacity-60">
          {resending ? "Sending…" : "Send a new code"}
        </button>
        <button type="button" onClick={onRestart} className="underline-offset-4 hover:text-fg hover:underline">
          Use a different email
        </button>
      </div>
      {resent && <Status state={resent} />}
      <p className="text-xs text-dim">No email after a minute? Check your spam folder, and that {FLOWS[flow].tip}</p>
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
