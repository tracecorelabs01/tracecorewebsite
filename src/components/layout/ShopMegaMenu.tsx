"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Price } from "@/components/ui/bits";
import { EASE_EXPO } from "@/components/ui/motion";
import type { ShopMenu } from "@/lib/catalog/types";
import { usePrice } from "@/lib/partner-pricing";

/** The header's Shop panel: every category, the Setup Builder and Ferrum. Full width, under the header. */
export function ShopMegaMenu({ open, menu, onNavigate }: { open: boolean; menu: ShopMenu; onNavigate: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shop-menu"
          id="shop-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: EASE_EXPO }}
          className="absolute inset-x-0 top-full border-b border-line bg-ink-950 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]"
        >
          <div className="container-x grid gap-4 py-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="type-kicker px-4 text-dim">Shop by category</p>
              <ul className="mt-3 grid gap-1">
                {menu.categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/shop?category=${c.id}`} onClick={onNavigate} className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0">
                        <span className="block font-display text-xl uppercase transition-colors group-hover:text-blaze">{c.label}</span>
                        <span className="block truncate text-sm text-muted">{c.blurb}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-dim">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/shop" onClick={onNavigate} className="mt-3 inline-flex items-center gap-2 px-4 text-sm text-muted transition-colors hover:text-fg">
                All products
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <Link
              href="/shop#build"
              onClick={onNavigate}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-ink-900/60 p-6 transition-colors hover:border-blaze/50 lg:col-span-3"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(255_61_0/0.16),transparent_60%)]" />
              <span className="relative grid size-12 place-items-center rounded-2xl bg-brand text-white">
                <SlidersHorizontal className="size-5" />
              </span>
              <span className="relative mt-auto pt-10">
                <span className="type-kicker text-dim">Setup Builder</span>
                <span className="mt-2 block font-display text-3xl uppercase">Build your setup</span>
                <span className="mt-2 block text-sm text-muted">Answer a few quick questions and we&apos;ll put together a complete setup for you.</span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-fg">
                  Start building
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>

            {menu.featured && <Featured product={menu.featured} onNavigate={onNavigate} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Featured({ product, onNavigate }: { product: NonNullable<ShopMenu["featured"]>; onNavigate: () => void }) {
  const { price, compareAt } = usePrice(product);
  return (
    <Link
      href={`/product/${product.slug}`}
      onClick={onNavigate}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-ink-900/60 transition-colors hover:border-blaze/50 lg:col-span-4"
    >
      {/* Product banners are 16:9; a squarer frame crops their text. */}
      <span className="relative block aspect-video overflow-hidden">
        <ProductVisual visual={product.visual} variant="card" sizes="(min-width: 1024px) 33vw, 100vw" />
      </span>
      <span className="flex items-end justify-between gap-4 p-6">
        <span className="min-w-0">
          <span className="type-kicker text-dim">Featured</span>
          <span className="mt-1 block font-display text-3xl uppercase">{product.name}</span>
          <span className="block truncate text-sm text-muted">{product.tagline}</span>
        </span>
        <Price price={price} compareAt={compareAt} />
      </span>
    </Link>
  );
}
