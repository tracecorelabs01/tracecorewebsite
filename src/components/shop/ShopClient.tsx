"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, Search, X } from "lucide-react";
import type { CategoryInfo, Product } from "@/lib/catalog/types";
import { ProductCard } from "@/components/product/ProductCard";
import { EASE_EXPO } from "@/components/ui/motion";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const sorts = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
} as const;
type Sort = keyof typeof sorts;

export function ShopClient({ products, categories }: { products: Product[]; categories: CategoryInfo[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const headerHidden = useUi((s) => s.headerHidden);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");

  const raw = params.get("category");
  const active: string = raw && categories.some((c) => c.id === raw) ? raw : "all";

  function setCategory(c: string) {
    const next = new URLSearchParams(params.toString());
    if (c === "all") next.delete("category");
    else next.set("category", c);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        (active === "all" || p.category === active) &&
        (!q || [p.name, p.tagline, p.categoryLabel, ...p.highlights].some((s) => s.toLowerCase().includes(q))),
    );
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    if (sort === "featured") sorted.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return sorted;
  }, [active, query, sort, products]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: products.length };
    for (const p of products) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [products]);

  const activeMeta = categories.find((c) => c.id === active);

  return (
    <section className="container-x pb-32">
      <div
        className="sticky z-30 -mx-2 mb-10 rounded-[28px] border border-line bg-ink-950/80 p-2 backdrop-blur-xl transition-[top] duration-500 ease-[var(--ease-expo)]"
        style={{ top: headerHidden ? 12 : 84 }}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <LayoutGroup id="shop-cats">
            <div role="tablist" aria-label="Categories" className="no-scrollbar flex gap-1 overflow-x-auto">
              {[{ id: "all", label: "All" }, ...categories].map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={active === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                    active === c.id ? "text-white" : "text-muted hover:text-fg",
                  )}
                >
                  {active === c.id && <motion.span layoutId="shop-pill" className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{c.label}</span>
                  <span className={cn("relative tabular-nums", active === c.id ? "text-white/70" : "text-dim")}>{counts[c.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>

          <div className="flex gap-2">
            <label className="flex h-11 flex-1 items-center gap-2.5 rounded-full border border-line bg-ink-900 px-4 transition-colors focus-within:border-blaze lg:w-64 lg:flex-none">
              <Search className="size-4 text-dim" />
              <span className="sr-only">Search products</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim" />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-dim hover:text-fg">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <label className="relative flex h-11 items-center rounded-full border border-line bg-ink-900 pl-4 pr-9 transition-colors focus-within:border-blaze">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="cursor-pointer appearance-none bg-transparent font-mono text-[11px] uppercase tracking-[0.12em] text-fg outline-none">
                {Object.entries(sorts).map(([k, v]) => (
                  <option key={k} value={k} className="bg-ink-900">
                    {v}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-4 text-dim" />
            </label>
          </div>
        </div>
      </div>

      <div className="mb-8 flex items-end justify-between gap-6">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: EASE_EXPO }}>
            <h2 className="font-display text-4xl uppercase">{activeMeta?.label ?? "Everything"}</h2>
            <p className="mt-1 text-sm text-muted">{activeMeta?.blurb ?? "The full TraceCoreLab catalogue."}</p>
          </motion.div>
        </AnimatePresence>
        <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-dim" aria-live="polite">
          {list.length} product{list.length === 1 ? "" : "s"}
        </p>
      </div>

      <motion.ul layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((p, i) => (
            <motion.li
              key={p.slug}
              layout
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
              transition={{ duration: 0.7, ease: EASE_EXPO, delay: Math.min(i, 8) * 0.05 }}
            >
              <ProductCard product={p} eager={i < 3} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {list.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-dashed border-line-strong py-24 text-center">
          <p className="font-display text-4xl uppercase">No matches</p>
          <p className="mt-2 text-muted">Try a different search or category.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-blaze hover:text-fg"
          >
            Reset filters
          </button>
        </motion.div>
      )}
    </section>
  );
}

export function ShopSkeleton() {
  return (
    <section className="container-x pb-32">
      <div className="mb-10 h-[60px] rounded-[28px] border border-line bg-ink-900/60" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-line bg-ink-900/60" />
        ))}
      </div>
    </section>
  );
}
