"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { Badge, Price, StatusDot, Stars } from "@/components/ui/bits";
import { Tilt } from "@/components/ui/motion";
import { useCart } from "@/lib/cart-store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./ProductVisual";

export function ProductCard({ product, eager, className }: { product: Product; eager?: boolean; className?: string }) {
  const add = useCart((s) => s.add);
  const openCart = useUi((s) => s.openCart);
  const pulseCart = useUi((s) => s.pulseCart);
  const [added, setAdded] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const soldOut = product.status === "sold-out";

  function onAdd() {
    if (!add(product, 1, product.option?.values[0])) return;
    pulseCart();
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAdded(false);
      openCart();
    }, 650);
  }

  return (
    <Tilt className={cn("group h-full rounded-2xl", className)} max={5}>
      <article className="border-flow relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-ink-900/80 transition-colors duration-500 hover:border-transparent">
        <div className="relative aspect-video overflow-hidden bg-ink-850">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,rgb(255_61_0/0.16),transparent_62%)]" />
          <div className="absolute inset-0 bg-grid opacity-50 mask-radial" />
          <ProductVisual visual={product.visual} variant="card" eager={eager} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-900/90 to-transparent" />
          <div className="absolute left-4 top-4 z-10 flex gap-2">{product.badge && <Badge>{product.badge}</Badge>}</div>
          <div className="absolute right-4 top-4 z-10 rounded-full bg-ink-950/60 px-2.5 py-1 backdrop-blur">
            <StatusDot status={product.status} />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-2.5 p-5">
          <div className="flex items-center justify-between gap-3 type-kicker !tracking-[0.16em] text-dim">
            <span>{product.categoryLabel}</span>
            {product.reviewCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Stars rating={product.rating} size={11} />
                <span className="tabular-nums">{product.reviewCount}</span>
              </span>
            )}
          </div>
          <h3 className="type-h3 text-fg">
            <Link href={`/product/${product.slug}`} className="outline-none after:absolute after:inset-0 after:z-[5] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-blaze">
              {product.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">{product.tagline}</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <Price price={product.price} compareAt={product.compareAt} />
            <button
              type="button"
              onClick={onAdd}
              disabled={soldOut}
              aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
              className="relative z-10 flex h-11 items-center gap-2 overflow-hidden bg-brand px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter,transform] clip-slant [--slant:10px] hover:brightness-110 active:scale-95 disabled:bg-none disabled:bg-white/10 disabled:text-dim"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {soldOut ? (
                  <span key="sold">Sold out</span>
                ) : added ? (
                  <motion.span key="ok" className="flex items-center gap-2" initial={{ y: 18 }} animate={{ y: 0 }} exit={{ y: -18 }}>
                    <Check className="size-4" strokeWidth={2.6} /> Added
                  </motion.span>
                ) : (
                  <motion.span key="add" className="flex items-center gap-2" initial={{ y: 18 }} animate={{ y: 0 }} exit={{ y: -18 }}>
                    <Plus className="size-4" strokeWidth={2.6} /> Add
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </article>
    </Tilt>
  );
}
