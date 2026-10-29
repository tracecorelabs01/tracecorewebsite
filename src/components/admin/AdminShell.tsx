"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  ExternalLink,
  FolderTree,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TicketPercent,
  UserCircle2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/actions/admin/auth";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "staff";
export type NavCounts = { orders: number; messages: number; reviews: number; lowStock: number };

const RANK: Record<Role, number> = { staff: 1, admin: 2, owner: 3 };

const NAV: { group: string; items: { href: string; label: string; icon: typeof Package; min?: Role; badge?: keyof NavCounts }[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Receipt, badge: "orders" },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/discounts", label: "Discounts", icon: TicketPercent, min: "admin" },
    ],
  },
  { group: "Finance", items: [{ href: "/admin/expenses", label: "Expenses", icon: Wallet, min: "admin" }] },
  {
    group: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, min: "admin" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, min: "admin" },
      { href: "/admin/setup-builder", label: "Setup builder", icon: SlidersHorizontal, min: "admin" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, badge: "lowStock" },
    ],
  },
  {
    group: "Community",
    items: [
      { href: "/admin/reviews", label: "Reviews", icon: Star, badge: "reviews" },
      { href: "/admin/messages", label: "Messages", icon: Inbox, badge: "messages" },
      { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
    ],
  },
  {
    group: "Store",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, min: "admin" },
      { href: "/admin/staff", label: "Staff", icon: ShieldCheck, min: "owner" },
      { href: "/admin/activity", label: "Activity", icon: History, min: "admin" },
    ],
  },
];

export function AdminShell({ user, counts, children }: { user: { name: string; email: string; role: Role }; counts: NavCounts; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change side effect
    setOpen(false);
  }, [pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-5" aria-label="Admin">
      {NAV.map((group) => {
        const items = group.items.filter((i) => RANK[user.role] >= RANK[i.min ?? "staff"]);
        if (!items.length) return null;
        return (
          <div key={group.group}>
            <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{group.group}</p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badge }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                const n = badge ? counts[badge] : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                        active ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />}
                      <Icon className={cn("size-4", active ? "text-blaze" : "text-dim group-hover:text-muted")} />
                      <span className="flex-1">{label}</span>
                      {n > 0 && (
                        <span className={cn("rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums", badge === "lowStock" ? "bg-warn/15 text-warn" : "bg-blaze/15 text-amber")}>{n}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-ink-950 lg:pl-64">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-ink-900 transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark className="h-6" title="" />
            <span className="leading-none">
              <span className="block font-display text-lg uppercase tracking-wide">
                <span className="text-gradient">TraceCore</span>
                <span className="text-silver">Lab</span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-dim">Lab console</span>
            </span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 lg:hidden" aria-label="Close menu">
            <X className="size-4" />
          </button>
        </div>
        {nav}
        <div className="border-t border-line p-3">
          <Link href="/admin/account" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
            <span className="grid size-8 place-items-center rounded-full bg-brand font-display text-sm text-white">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm">{user.name}</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-dim">{user.role}</span>
            </span>
            <UserCircle2 className="size-4 text-dim" />
          </Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-ink-950/80 px-4 backdrop-blur-xl md:px-8">
        <button type="button" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg border border-line-strong text-muted lg:hidden" aria-label="Open menu">
          <Menu className="size-4" />
        </button>
        <div className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-dim lg:block">{user.email}</div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg">
            View store <ExternalLink className="size-3.5" />
          </a>
          <form action={logout}>
            <button type="submit" className="flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm text-muted transition-colors hover:border-white/25 hover:text-fg">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
