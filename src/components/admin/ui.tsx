import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────── layout ───────────── */

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-3.5" /> {back.label}
          </Link>
        )}
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-ink-900/70", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-dim">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "neutral" | "brand" | "warn" | "ok" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-900/70 p-5">
      {tone === "brand" && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgb(255_61_0/0.16),transparent_55%)]" />}
      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">{label}</span>
        {icon && <span className={cn("text-dim", tone === "warn" && "text-warn", tone === "ok" && "text-ok", tone === "brand" && "text-blaze")}>{icon}</span>}
      </div>
      <div className="relative mt-3 font-display text-4xl leading-none tracking-wide tabular-nums">{value}</div>
      {hint && <div className="relative mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/* ───────────── badges ───────────── */

const TONES = {
  neutral: "border-line-strong bg-white/[0.04] text-muted",
  brand: "border-blaze/40 bg-blaze/10 text-amber",
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-ember/40 bg-ember/10 text-[#ff6b5e]",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", TONES[tone], className)}>{children}</span>
  );
}

const ORDER_TONE: Record<string, Tone> = { pending: "warn", processing: "info", shipped: "brand", delivered: "ok", cancelled: "neutral", refunded: "danger" };
const PAYMENT_TONE: Record<string, Tone> = { unpaid: "warn", paid: "ok", refunded: "danger", failed: "danger" };

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{status}</Badge>;
}

/* ───────────── tables ───────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className, ...props }: ComponentProps<"th">) {
  return (
    <th className={cn("border-b border-line px-4 py-3 text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.14em] text-dim", className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-line/70 px-4 py-3 align-middle", className)} {...props}>
      {children}
    </td>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-line-strong bg-ink-850 text-blaze">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ───────────── navigation helpers ───────────── */

export function FilterTabs({ items }: { items: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink-900/70 p-1">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
            t.active ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("font-mono text-[11px] tabular-nums", t.active ? "text-amber" : "text-dim")}>{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Plain GET search form — works without JavaScript and keeps other filters. */
export function SearchBox({ action, defaultValue, placeholder = "Search…", keep = {} }: { action: string; defaultValue?: string; placeholder?: string; keep?: Record<string, string | undefined> }) {
  return (
    <form action={action} className="relative w-full md:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className={cn(inputClass, "pl-9")} />
    </form>
  );
}

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-line px-4 py-3 text-sm" aria-label="Pagination">
      <span className="text-dim">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={cn(buttonClass("secondary", "sm"), page <= 1 && "pointer-events-none opacity-40")}>
          <ChevronLeft className="size-4" /> Prev
        </Link>
        <Link aria-disabled={page >= pageCount} href={href(Math.min(pageCount, page + 1))} className={cn(buttonClass("secondary", "sm"), page >= pageCount && "pointer-events-none opacity-40")}>
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}

/** Build a query string from the current filters, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

/* ───────────── buttons & inputs (class helpers shared with client forms) ───────────── */

export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,filter] disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-brand text-white shadow-[0_8px_24px_-12px_rgb(255_61_0/0.8)] hover:brightness-110",
    variant === "secondary" && "border border-line-strong bg-ink-850 text-fg hover:border-white/25 hover:bg-ink-800",
    variant === "danger" && "border border-ember/40 text-[#ff6b5e] hover:bg-ember/10",
    variant === "ghost" && "text-muted hover:bg-white/[0.05] hover:text-fg",
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

export const inputClass =
  "h-10 w-full rounded-lg border border-line-strong bg-ink-950/80 px-3 text-sm text-fg outline-none transition-colors placeholder:text-dim focus:border-blaze disabled:opacity-60";

export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line/70 text-sm">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-3 gap-4 py-2.5">
          <dt className="text-dim">{it.label}</dt>
          <dd className="col-span-2 break-words text-fg/90">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
