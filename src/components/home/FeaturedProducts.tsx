"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { CategoryInfo, Product } from "@/lib/catalog/types";
import { ProductCard } from "@/components/product/ProductCard";
import { Kicker } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { EASE_EXPO, Reveal, RevealLines } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export function FeaturedProducts({ products, categories }: { products: Product[]; categories: CategoryInfo[] }) {
  const [tab, setTab] = useState("featured");
  const tabs = [{ id: "featured", label: "Featured" }, ...categories.filter((c) => products.some((p) => p.category === c.id)).map((c) => ({ id: c.id, label: c.label }))];
  const featured = products.filter((p) => p.featured);
  const list = (tab === "featured" ? (featured.length ? featured : products) : products.filter((p) => p.category === tab)).slice(0, 4);

  return (
    <section className="relative pb-28 pt-16 md:pb-36 md:pt-20" aria-labelledby="featured-heading">
      <div className="pointer-events-none absolute left-1/2 top-24 h-[480px] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(255_61_0/0.08),transparent_70%)]" />
      <div className="container-x relative">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Kicker index="02">The lineup</Kicker>
            <RevealLines
              as="h2"
              className="type-h2 mt-5"
              lines={[
                <span key="a" id="featured-heading">
                  Featured
                </span>,
                <span key="b" className="text-gradient">
                  hardware
                </span>,
              ]}
            />
          </div>
          <Reveal className="flex flex-col gap-6 lg:items-end" delay={0.15}>
            <p className="max-w-md text-muted lg:text-right">Cards, devices and kits — each one checked in our lab, packed by hand and shipped within a day.</p>
            <LayoutGroup id="featured-tabs">
              <div role="tablist" aria-label="Filter products" className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-ink-900/70 p-1 backdrop-blur">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative shrink-0 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                      tab === t.id ? "text-white" : "text-muted hover:text-fg",
                    )}
                  >
                    {tab === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
          </Reveal>
        </div>

        <Reveal className="mt-14" y={50}>
          <motion.ul layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((p, i) => (
                <motion.li
                  key={p.slug}
                  layout
                  initial={{ opacity: 0, y: 40, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.7, ease: EASE_EXPO, delay: i * 0.06 }}
                >
                  <ProductCard product={p} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </Reveal>

        <div className="mt-14 flex justify-center">
          <ButtonLink href="/shop" variant="ghost">
            View all products
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
