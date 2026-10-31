"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ChevronDown, ShoppingBag, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ScrambleText } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon } from "@/components/ui/icons";
import { CssMarquee } from "@/components/ui/Marquee";
import { EASE_EXPO } from "@/components/ui/motion";
import { selectCount, useCart } from "@/lib/cart-store";
import type { ShopMenu } from "@/lib/catalog/types";
import { site } from "@/lib/site";
import { ShopMegaMenu } from "./ShopMegaMenu";
import { useStoreSettings } from "./StoreSettings";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

/** The Shop mega menu's open state. Leaving closes it after a beat, so the pointer can cross the gap to the panel. */
function useShopMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return {
    open,
    show: () => {
      window.clearTimeout(timer.current);
      setOpen(true);
    },
    hideSoon: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOpen(false), 150);
    },
    hide: () => {
      window.clearTimeout(timer.current);
      setOpen(false);
    },
  };
}
type ShopMenuState = ReturnType<typeof useShopMenu>;

export function Header({ menu }: { menu: ShopMenu }) {
  const shop = useShopMenu();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const hidden = useUi((s) => s.headerHidden);
  const setHidden = useUi((s) => s.setHeaderHidden);
  const menuOpen = useUi((s) => s.menuOpen);
  const setMenu = useUi((s) => s.setMenu);
  const settings = useStoreSettings();
  const hasBar = settings.announcements.length > 0;
  const barOpen = hasBar && !scrolled && !menuOpen;
  // A marquee in the folded bar still ticks on the main thread every frame, so it holds still until the bar opens again.
  const [barFolded, setBarFolded] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    setHidden(y > prev && y > 480);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      animate={{ y: hidden && !menuOpen ? "-100%" : "0%" }}
      transition={{ duration: 0.55, ease: EASE_EXPO }}
    >
      <motion.div
        className="overflow-hidden bg-brand text-white"
        initial={false}
        animate={{ height: barOpen ? 34 : 0 }}
        transition={{ duration: 0.45, ease: EASE_EXPO }}
        onAnimationComplete={(def) => setBarFolded((def as { height?: number }).height === 0)}
        data-offscreen={!barOpen && barFolded ? "" : undefined}
      >
        {hasBar && (
          <CssMarquee className="h-[34px] items-center [mask-image:none]">
            {[...settings.announcements, ...settings.announcements].map((msg, i) => (
              <span key={i} className="flex items-center gap-6 pr-6 font-mono text-[11px] font-medium uppercase tracking-[0.18em]">
                {msg}
                <span aria-hidden className="text-white/60">✦</span>
              </span>
            ))}
          </CssMarquee>
        )}
      </motion.div>

      <div
        className={cn(
          "border-b transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled || menuOpen || shop.open ? "border-line bg-ink-950/75 backdrop-blur-xl" : "border-transparent bg-transparent",
        )}
      >
        <nav className="container-x flex h-[72px] items-center justify-between gap-6" aria-label="Main">
          <Logo onNavigate={() => setMenu(false)} />
          <Suspense fallback={<NavLinksStatic />}>
            <NavLinks menu={menu} shop={shop} hidden={hidden} />
          </Suspense>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href={settings.links.discord}
              target="_blank"
              rel="noreferrer"
              aria-label="Join our Discord"
              className="hidden size-11 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-fg sm:grid"
            >
              <DiscordIcon className="size-5" />
            </a>
            <Link
              href="/account"
              aria-label="Your account"
              onClick={() => setMenu(false)}
              className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              <UserRound className="size-5" strokeWidth={1.8} />
            </Link>
            <CartButton />
            <ButtonLink href="/shop" size="sm" className="ml-2 hidden md:inline-flex">
              Shop now
            </ButtonLink>
            <MenuButton open={menuOpen} onToggle={() => setMenu(!menuOpen)} />
          </div>
        </nav>
      </div>
    </motion.header>
  );
}

function NavLinks({ menu, shop, hidden }: { menu: ShopMenu; shop: ShopMenuState; hidden: boolean }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <ul className="hidden items-center lg:flex" onPointerLeave={() => setHovered(null)}>
      {site.nav.map((item, i) => {
        const active = !item.href.includes("?") && (pathname === item.href || pathname.startsWith(item.href + "/"));
        const isShop = item.href === "/shop";
        // The Shop item holds the mega menu, so it isn't `relative`: the panel spans the header instead.
        return (
          <li
            key={item.href}
            onPointerEnter={() => {
              setHovered(i);
              if (isShop) shop.show();
            }}
            onPointerLeave={isShop ? shop.hideSoon : undefined}
            onBlur={isShop ? (e) => !e.currentTarget.contains(e.relatedTarget) && shop.hide() : undefined}
            onKeyDown={
              isShop
                ? (e) => {
                    if (e.key !== "Escape") return;
                    // Focus first: focusing Shop opens the menu, so closing has to come after.
                    e.currentTarget.querySelector("a")?.focus();
                    shop.hide();
                  }
                : undefined
            }
          >
            <div className="relative">
              <Link
                href={item.href}
                onFocus={isShop ? shop.show : undefined}
                onClick={isShop ? shop.hide : undefined}
                aria-expanded={isShop ? shop.open : undefined}
                aria-controls={isShop ? "shop-menu" : undefined}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.14em] transition-colors",
                  active || (isShop && shop.open) ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                <ScrambleText text={item.label} />
                {isShop && <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-300", shop.open && "rotate-180")} />}
              </Link>
              {hovered === i && (
                <motion.span layoutId="nav-hover" className="absolute inset-0 rounded-full bg-white/[0.06]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              {active && <motion.span layoutId="nav-active" className="absolute inset-x-4 -bottom-0.5 h-[2px] bg-brand" />}
            </div>
            {isShop && <ShopMegaMenu open={shop.open && !hidden} menu={menu} onNavigate={shop.hide} />}
          </li>
        );
      })}
    </ul>
  );
}

function NavLinksStatic() {
  return (
    <ul className="hidden items-center lg:flex">
      {site.nav.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="block px-4 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CartButton() {
  const count = useCart(selectCount);
  const hydrated = useUi((s) => s.hydrated);
  const pulse = useUi((s) => s.cartPulse);
  const openCart = useUi((s) => s.openCart);
  const shown = hydrated ? count : 0;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart, ${shown} item${shown === 1 ? "" : "s"}`}
      className="relative grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-white/5"
    >
      <motion.span key={pulse} initial={{ scale: pulse ? 0.7 : 1, rotate: pulse ? -14 : 0 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
        <ShoppingBag className="size-5" strokeWidth={1.8} />
      </motion.span>
      <AnimatePresence>
        {shown > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-white shadow-[0_0_12px_rgb(255_61_0/0.6)]"
          >
            {shown}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="relative grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-white/5 lg:hidden"
    >
      <motion.span className="absolute h-[2px] w-5 rounded bg-current" animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -4 }} transition={{ duration: 0.4, ease: EASE_EXPO }} />
      <motion.span className="absolute h-[2px] rounded bg-current" animate={open ? { rotate: -45, y: 0, width: 20 } : { rotate: 0, y: 4, width: 14 }} transition={{ duration: 0.4, ease: EASE_EXPO }} />
    </button>
  );
}
