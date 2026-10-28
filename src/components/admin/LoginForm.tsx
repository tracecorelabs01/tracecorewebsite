"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { login } from "@/actions/admin/auth";
import { LogoMark } from "@/components/brand/Logo";
import { inputClass } from "./ui";

export function LoginForm({ next, dbReady }: { next?: string; dbReady: boolean }) {
  const [state, action, pending] = useActionState(login, null);

  return (
    <div className="w-full max-w-sm">
      <LogoMark className="mb-8 h-9 lg:hidden" />
      <h2 className="font-display text-4xl uppercase">Sign in</h2>
      <p className="mt-2 text-sm text-muted">Staff access only.</p>

      {!dbReady && (
        <p className="mt-6 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-fg/90">
          No database connected yet. Add <code className="font-mono text-xs">DATABASE_URL</code>, run <code className="font-mono text-xs">npm run db:setup</code> and{" "}
          <code className="font-mono text-xs">npm run admin:create</code>.
        </p>
      )}

      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
          {/* React resets the form after each attempt; defaultValue keeps the email filled in. */}
          <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.email} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
        {state?.error && (
          <p className="flex items-center gap-2 text-sm text-[#ff6b5e]" role="alert">
            <AlertCircle className="size-4" /> {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !dbReady}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgb(255_61_0/0.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {pending ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
