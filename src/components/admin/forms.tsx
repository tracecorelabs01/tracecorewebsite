"use client";

import { createContext, use, useActionState, useEffect, useRef, useTransition, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass, inputClass } from "./ui";

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;
type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

/**
 * Form wired to a Server Action with inline success/error feedback. Submits via
 * a transition (not the form `action` prop) so React doesn't wipe the inputs
 * when the server returns validation errors.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showStatus = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormContext value={{ state, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {children}
        {showStatus && <FormStatus />}
      </form>
    </FormContext>
  );
}

/** The surrounding ActionForm's last result and pending flag. */
export function useActionForm() {
  return use(FormContext);
}

export function FormStatus({ className }: { className?: string }) {
  const { state } = use(FormContext);
  if (!state?.message) return null;
  return (
    <p className={cn("mt-3 flex items-center gap-2 text-sm", state.ok ? "text-ok" : "text-[#ff6b5e]", className)} role={state.ok ? "status" : "alert"}>
      {state.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
      {state.message}
    </p>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className, pendingText }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md"; className?: string; pendingText?: string }) {
  const { pending } = use(FormContext);
  return (
    <button type="submit" disabled={pending} className={cn(buttonClass(variant, size), className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Field({ label, name, hint, children, className }: { label: string; name?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const { state } = use(FormContext);
  const error = name ? state?.fieldErrors?.[name] : undefined;
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-[#ff6b5e]">{error}</span> : hint ? <span className="mt-1 block text-xs text-dim">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  const { state } = use(FormContext);
  const invalid = props.name ? Boolean(state?.fieldErrors?.[props.name]) : false;
  return <input aria-invalid={invalid || undefined} className={cn(inputClass, invalid && "border-ember", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const { state } = use(FormContext);
  const invalid = props.name ? Boolean(state?.fieldErrors?.[props.name]) : false;
  return <textarea aria-invalid={invalid || undefined} className={cn(inputClass, "h-auto min-h-24 py-2 leading-relaxed", invalid && "border-ember", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** A select that submits its (GET) form as soon as it changes, for filter bars. */
export function AutoSubmitSelect({ className, children, ...props }: Omit<ComponentProps<"select">, "onChange">) {
  return (
    <select className={cn(inputClass, "pr-8", className)} onChange={(e) => e.currentTarget.form?.requestSubmit()} {...props}>
      {children}
    </select>
  );
}

/** Switch; pass `checked` + `onCheckedChange` to control it from state. */
export function Toggle({
  name,
  label,
  defaultChecked,
  description,
  checked,
  onCheckedChange,
}: {
  name?: string;
  label: string;
  defaultChecked?: boolean;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} checked={checked} onChange={onCheckedChange && ((e) => onCheckedChange(e.target.checked))} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-line-strong bg-ink-850 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-3.5 after:rounded-full after:bg-muted after:transition-transform peer-checked:border-transparent peer-checked:bg-brand peer-checked:after:translate-x-4 peer-checked:after:bg-white peer-focus-visible:outline-2 peer-focus-visible:outline-blaze" />
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="block text-xs text-dim">{description}</span>}
      </span>
    </label>
  );
}

/** A button that runs a bound Server Action after an optional confirm(). */
export function ConfirmButton({
  action,
  confirm,
  children,
  variant = "secondary",
  size = "sm",
  className,
}: {
  action: () => Promise<unknown>;
  confirm?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={cn(buttonClass(variant, size), className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          await action();
        });
      }}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}
