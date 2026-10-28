"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { ProductVisual } from "@/components/product/ProductVisual";
import { QuantityStepper } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { EASE_EXPO } from "@/components/ui/motion";
import { selectCount, selectSubtotal, useCart } from "@/lib/cart-store";
import { useStoreSettings } from "./StoreSettings";
import { useUi } from "@/lib/ui-store";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const open = useUi((s) => s.cartOpen);
  const close = useUi((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const { freeShippingThreshold } = useStoreSettings();
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = freeShippingThreshold > 0 ? Math.min(1, subtotal / freeShippingThreshold) : 1;

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus?.();
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" key="cart">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={close}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line bg-ink-900 outline-none"
            initial={{ x: "100%" }}
            animate={{ x: "0%" }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.65, ease: EASE_EXPO }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgb(255_61_0/0.12),transparent_45%)]" />

            <header className="relative flex items-center justify-between border-b border-line px-6 py-5">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-3xl uppercase">Your cart</h2>
                <span className="font-mono text-xs text-dim">
                  {count} item{count === 1 ? "" : "s"}
                </span>
              </div>
              <button type="button" onClick={close} aria-label="Close cart" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-blaze hover:text-fg">
                <X className="size-4" />
              </button>
            </header>

            {lines.length > 0 && (
              <div className="relative border-b border-line px-6 py-4">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Truck className="size-4 text-blaze" />
                  {remaining > 0 ? (
                    <>
                      You&apos;re <span className="font-semibold text-fg">{formatPrice(remaining)}</span> away from free shipping
                    </>
                  ) : (
                    <span className="font-medium text-fg">Free worldwide shipping unlocked</span>
                  )}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.8, ease: EASE_EXPO }} />
                </div>
              </div>
            )}

            <div className="relative flex-1 overflow-y-auto overscroll-contain px-6" data-lenis-prevent>
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 py-16 text-center">
                  <motion.div
                    className="grid size-20 place-items-center rounded-full border border-line-strong bg-ink-800"
                    initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: EASE_EXPO, delay: 0.2 }}
                  >
                    <ShoppingBag className="size-8 text-blaze" strokeWidth={1.5} />
                  </motion.div>
                  <div>
                    <p className="font-display text-3xl uppercase">Nothing here yet</p>
                    <p className="mt-2 text-sm text-muted">Your cart is empty — let&apos;s fix that.</p>
                  </div>
                  <ButtonLink href="/shop" onClick={close} size="sm">
                    Browse hardware
                  </ButtonLink>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => {
                      return (
                        <motion.li
                          key={line.key}
                          layout
                          initial={{ opacity: 0, x: 40 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 60, height: 0, paddingTop: 0, paddingBottom: 0 }}
                          transition={{ duration: 0.45, ease: EASE_EXPO }}
                          className="flex gap-4 overflow-hidden py-5"
                        >
                          <Link href={`/product/${line.slug}`} onClick={close} className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-850">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgb(255_61_0/0.18),transparent_65%)]" />
                            <ProductVisual visual={line.visual} variant="thumb" />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Link href={`/product/${line.slug}`} onClick={close} className="block truncate font-display text-xl uppercase hover:text-blaze">
                                  {line.name}
                                </Link>
                                {line.option && <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{line.option}</p>}
                              </div>
                              <span className="font-display text-xl">{formatPrice(line.price * line.qty)}</span>
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-3">
                              <QuantityStepper size="sm" value={line.qty} onChange={(v) => setQty(line.key, v)} max={line.maxQty ?? 99} />
                              <button type="button" onClick={() => remove(line.key)} className="flex items-center gap-1.5 text-xs text-dim transition-colors hover:text-ember" aria-label={`Remove ${line.name}`}>
                                <Trash2 className="size-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <footer className="relative border-t border-line bg-ink-950/60 px-6 pb-6 pt-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Subtotal</span>
                  <span className="font-display text-3xl">{formatPrice(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-dim">Shipping and taxes calculated at checkout.</p>
                <ButtonLink href="/checkout" onClick={close} size="lg" className="mt-5 w-full">
                  Checkout
                </ButtonLink>
                <button type="button" onClick={close} className="mt-3 w-full py-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-dim transition-colors hover:text-fg">
                  Continue shopping
                </button>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
