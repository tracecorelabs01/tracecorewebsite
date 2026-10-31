"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, Loader2, Plus, Star } from "lucide-react";
import {
  deleteMyAddress,
  login,
  makeMyDefaultAddress,
  redeem,
  requestCode,
  requestTrackCode,
  saveMyAddress,
  submitReview,
  updateProfile,
  verifyTrackCode,
  type AccountFormState,
} from "@/actions/account";
import { Pill } from "@/components/account/AccountShell";
import type { SavedAddress } from "@/lib/address";
import { COUNTRIES } from "@/lib/countries";
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

export const inputClass = "mt-2 h-12 w-full rounded-xl border border-line-strong bg-ink-900 px-4 outline-none transition-colors placeholder:text-dim focus:border-blaze";

export function Field({ label, error, hint, className, ...props }: { label: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="type-kicker text-dim">{label}</span>
      <input {...props} aria-invalid={error ? true : undefined} className={cn(inputClass, error && "border-ember")} />
      {error ? <span className="mt-1.5 block text-xs text-[#ff6b5e]">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-dim">{hint}</span> : null}
    </label>
  );
}

export function Submit({ pending, children, className }: { pending: boolean; children: ReactNode; className?: string }) {
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

export function Status({ state }: { state: { ok: boolean; message?: string } | null }) {
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

/* ───────────── Details (/account/details): the account's name, phone and saved addresses ───────────── */

export function ProfileForm({ email, firstName, lastName, phone }: { email: string; firstName: string; lastName: string; phone: string }) {
  const { state, pending, onSubmit } = useAccountForm(updateProfile);
  const errs = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="type-kicker text-dim">Email</p>
        <p className="mt-2 break-all">{email}</p>
        <p className="mt-1.5 text-xs text-dim">You sign in with it. To change it, contact us.</p>
      </div>
      <Field label="First name" name="firstName" autoComplete="given-name" defaultValue={firstName} maxLength={80} error={errs.firstName} required />
      <Field label="Last name" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={80} error={errs.lastName} required />
      <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40} error={errs.phone} className="sm:col-span-2" />
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Status state={state} />
        <Submit pending={pending} className="sm:ml-auto">
          Save
        </Submit>
      </div>
    </form>
  );
}

/** The addresses checkout offers, default first. Add, edit, remove, or pick the default. */
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  // The address open for editing: its id, "new" for one being added, or null.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const done = () => setEditing(null);
  return (
    <div className="grid gap-4">
      {addresses.length === 0 && editing !== "new" && <p className="text-muted">No saved addresses yet. The address of your next order is kept here, or add one now.</p>}
      {addresses.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={editing === a.id ? "sm:col-span-2" : undefined}>
              {editing === a.id ? <AddressForm address={a} onDone={done} /> : <AddressCard address={a} onEdit={() => setEditing(a.id)} />}
            </li>
          ))}
        </ul>
      )}
      {editing === "new" ? (
        <AddressForm onDone={done} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-blaze hover:text-fg"
        >
          <Plus className="size-4" /> Add an address
        </button>
      )}
    </div>
  );
}

const linkButton = "underline-offset-4 transition-colors hover:text-fg hover:underline disabled:opacity-60";

function AddressCard({ address: a, onEdit }: { address: SavedAddress; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const remove = () => {
    if (window.confirm("Remove this address?")) start(() => deleteMyAddress(a.id));
  };
  return (
    <div className={cn("flex h-full flex-col gap-4 rounded-2xl border p-5", a.isDefault ? "border-blaze/50 bg-blaze/[0.04]" : "border-line")}>
      <address className="flex-1 text-sm not-italic leading-relaxed text-muted">
        <span className="block font-medium text-fg">
          {a.firstName} {a.lastName}
        </span>
        {a.address1}
        {a.address2 && `, ${a.address2}`}
        <br />
        {[a.city, a.region, a.postalCode].filter(Boolean).join(", ")}
        <br />
        {a.country}
      </address>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        {a.isDefault ? (
          <Pill tone="ok">Default</Pill>
        ) : (
          <button type="button" disabled={pending} onClick={() => start(() => makeMyDefaultAddress(a.id))} className={linkButton}>
            Make default
          </button>
        )}
        <button type="button" disabled={pending} onClick={onEdit} className={linkButton}>
          Edit
        </button>
        <button type="button" disabled={pending} onClick={remove} className={linkButton}>
          Remove
        </button>
        {pending && <Loader2 className="size-3.5 animate-spin" />}
      </div>
    </div>
  );
}

function AddressForm({ address: a, onDone }: { address?: SavedAddress; onDone: () => void }) {
  const [state, setState] = useState<AccountFormState>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveMyAddress(a?.id ?? null, null, fd);
      if (res?.ok) onDone();
      else setState(res);
    });
  };
  const errs = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-2xl border border-line-strong p-5 sm:grid-cols-2">
      <p className="font-display text-xl uppercase sm:col-span-2">{a ? "Edit address" : "New address"}</p>
      <Field label="First name" name="firstName" autoComplete="given-name" defaultValue={a?.firstName} maxLength={80} error={errs.firstName} required />
      <Field label="Last name" name="lastName" autoComplete="family-name" defaultValue={a?.lastName} maxLength={80} error={errs.lastName} required />
      <Field label="Address" name="address1" autoComplete="address-line1" defaultValue={a?.address1} maxLength={191} error={errs.address1} className="sm:col-span-2" required />
      <Field label="Apartment, suite (optional)" name="address2" autoComplete="address-line2" defaultValue={a?.address2 ?? ""} maxLength={191} className="sm:col-span-2" />
      <Field label="City" name="city" autoComplete="address-level2" defaultValue={a?.city} maxLength={120} error={errs.city} required />
      <Field label="State / region (optional)" name="region" autoComplete="address-level1" defaultValue={a?.region ?? ""} maxLength={120} />
      <Field label="Postal code" name="postalCode" autoComplete="postal-code" defaultValue={a?.postalCode} maxLength={40} error={errs.postalCode} required />
      <label className="block">
        <span className="type-kicker text-dim">Country</span>
        <select name="country" required defaultValue={a && COUNTRIES.includes(a.country) ? a.country : ""} className={cn(inputClass, "text-fg", errs.country && "border-ember")}>
          <option value="" disabled>
            Select country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {errs.country && <span className="mt-1.5 block text-xs text-[#ff6b5e]">{errs.country}</span>}
      </label>
      {!a?.isDefault && (
        <label className="flex items-center gap-3 text-sm text-muted sm:col-span-2">
          <input type="checkbox" name="isDefault" className="size-4 accent-[#ff3d00]" /> Make this my default address
        </label>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <Status state={state} />
        <div className="flex items-center justify-end gap-5 sm:ml-auto">
          <button type="button" onClick={onDone} className={cn(linkButton, "text-sm text-muted")}>
            Cancel
          </button>
          <Submit pending={pending}>Save address</Submit>
        </div>
      </div>
    </form>
  );
}
