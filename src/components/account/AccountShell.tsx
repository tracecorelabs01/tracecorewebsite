import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/account";
import { PageHero } from "@/components/ui/PageHero";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "Orders" },
  { href: "/account/rewards", label: "Rewards" },
  { href: "/account/reviews", label: "Reviews" },
] as const;

/** Hero, tabs and sign-out shared by the signed-in account pages. */
export function AccountShell({ active, title, description, children }: { active: (typeof TABS)[number]["href"]; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHero kicker="Your account" crumbs={[{ label: "Home", href: "/" }, { label: "Account" }]} lines={[title]} description={description} />
      <section className="container-x pb-28">
        <nav aria-label="Account" className="mb-8 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active === t.href ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                active === t.href ? "border-blaze bg-blaze/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {t.label}
            </Link>
          ))}
          <form action={logout} className="ml-auto">
            <button type="submit" className="flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg">
              <LogOut className="size-3.5" /> Log out
            </button>
          </form>
        </nav>
        {children}
      </section>
    </>
  );
}

const ORDER_STATUS: Record<string, string> = { pending: "Received", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
const PAYMENT_STATUS: Record<string, string> = { unpaid: "Awaiting payment", paid: "Paid", refunded: "Refunded", failed: "Payment failed" };

export function StatusPills({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const good = paymentStatus === "paid" && status !== "cancelled" && status !== "refunded";
  return (
    <span className="flex flex-wrap gap-1.5">
      <Pill tone={status === "cancelled" || status === "refunded" ? "dim" : status === "delivered" || status === "shipped" ? "ok" : "neutral"}>{ORDER_STATUS[status] ?? status}</Pill>
      <Pill tone={good ? "ok" : paymentStatus === "unpaid" ? "warn" : "dim"}>{PAYMENT_STATUS[paymentStatus] ?? paymentStatus}</Pill>
    </span>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "dim"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        tone === "ok" && "border-ok/30 bg-ok/10 text-ok",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "dim" && "border-line text-dim",
        tone === "neutral" && "border-line-strong text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-line bg-ink-900/60 p-6 md:p-7", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          {title && <h2 className="font-display text-2xl uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const shortDay = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
