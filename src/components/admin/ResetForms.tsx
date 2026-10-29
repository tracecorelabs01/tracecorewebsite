"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { requestAdminReset, resetAdminPassword } from "@/actions/admin/auth";
import { LogoMark } from "@/components/brand/Logo";
import { inputClass } from "./ui";

const buttonClass =
  "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgb(255_61_0/0.9)] transition-[filter] hover:brightness-110 disabled:opacity-60";

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <LogoMark className="mb-8 h-9" />
        <h1 className="font-display text-4xl uppercase">{title}</h1>
        <p className="mt-2 text-sm text-muted">{intro}</p>
        {children}
        <Link href="/admin/login" className="mt-6 inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={ok ? "flex items-start gap-2 text-sm text-ok" : "flex items-start gap-2 text-sm text-[#ff6b5e]"} role={ok ? "status" : "alert"}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />} {text}
    </p>
  );
}

export function AdminForgotForm() {
  const [state, action, pending] = useActionState(requestAdminReset, null);
  return (
    <Shell title="Forgot password" intro="Enter your work email and we'll send you a link to choose a new password.">
      {state?.ok ? (
        <div className="mt-8">
          <Message ok text={state.message} />
        </div>
      ) : (
        <form action={action} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
            <input name="email" type="email" autoComplete="username" required autoFocus className={inputClass} />
          </label>
          {state && <Message ok={false} text={state.message} />}
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Email me a link
          </button>
        </form>
      )}
    </Shell>
  );
}

export function AdminResetForm({ token, live }: { token: string; live: boolean }) {
  const [state, action, pending] = useActionState(resetAdminPassword.bind(null, token), null);
  if (!live) {
    return (
      <Shell title="Link expired" intro="This link has expired or was already used. Links work once, for one hour.">
        <Link href="/admin/forgot" className={`${buttonClass} mt-8`}>
          Send me a new link
        </Link>
      </Shell>
    );
  }
  return (
    <Shell title="New password" intro="Choose a new password. You'll be signed out everywhere and can sign in with it straight away.">
      <form action={action} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">New password (at least 10 characters)</span>
          <input name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Repeat password</span>
          <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
        </label>
        {state && <Message ok={false} text={state.message} />}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Save password
        </button>
      </form>
    </Shell>
  );
}
