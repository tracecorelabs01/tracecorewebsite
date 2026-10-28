"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, Headphones, RotateCcw, ShieldCheck, ShoppingBag, Truck, Zap } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { Accordion, Badge, Kicker, Price, QuantityStepper, StatusDot, Stars } from "@/components/ui/bits";
import { EASE_EXPO, Reveal, RevealLines, Tilt } from "@/components/ui/motion";
import { useCart } from "@/lib/cart-store";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { useUi } from "@/lib/ui-store";
import { cn, formatPrice } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { ProductVisual } from "./ProductVisual";

export function ProductView({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const openCart = useUi((s) => s.openCart);
  const pulseCart = useUi((s) => s.pulseCart);
  const play = useUi((s) => s.introDone);
  const settings = useStoreSettings();
  const soldOut = product.status === "sold-out";
  const maxQty = product.maxQty ?? 99;

  const gallery = product.gallery ?? [product.visual];
  const [view, setView] = useState(0);
  const [option, setOption] = useState(product.option?.values[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  // Reset transient UI if this route is hidden and later restored (Activity).
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      setAdded(false);
    };
  }, []);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function addToCart(open = true) {
    if (!add(product, qty, option)) return;
    pulseCart();
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAdded(false);
      if (open) openCart();
    }, 700);
  }

  const warranty = product.specs.find((s) => s.label === "Warranty")?.value ?? "12 months";
  const perks = [
    { Icon: Truck, title: `Free shipping over ${formatPrice(settings.freeShippingThreshold)}`, text: "Dispatched within one business day" },
    { Icon: ShieldCheck, title: `${warranty} warranty`, text: "Repair or replace, no fuss" },
    { Icon: RotateCcw, title: "14-day returns", text: "On unopened items" },
    { Icon: Headphones, title: "Discord support", text: "Real people, 7 days a week" },
  ];

  return (
    <>
      <section className="relative isolate pt-[130px] md:pt-[150px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[90vh]" aria-hidden>
          <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_65%)]" />
          <div className="absolute -left-1/4 top-0 size-[70vw] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.14),transparent_62%)]" />
        </div>

        <div className="container-x">
          <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            <Link href="/" className="hover:text-fg">
              Home
            </Link>
            <span className="text-blaze">/</span>
            <Link href="/shop" className="hover:text-fg">
              Shop
            </Link>
            <span className="text-blaze">/</span>
            <Link href={`/shop?category=${product.category}`} className="hover:text-fg">
              {product.categoryLabel}
            </Link>
            <span className="text-blaze">/</span>
            <span className="text-muted">{product.name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            {/* Gallery */}
            <div className="lg:col-span-7">
              <div className="lg:sticky lg:top-28">
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={play ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 1.1, ease: EASE_EXPO }}>
                  <Tilt className="group rounded-[32px]" max={4}>
                    <div className="relative aspect-square overflow-hidden rounded-[32px] border border-line bg-ink-900 md:aspect-[5/4]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgb(255_61_0/0.2),transparent_60%)]" />
                      <div className="absolute inset-0 bg-grid opacity-60 mask-radial" />
                      <div className="absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 animate-spin-slower rounded-full border border-dashed border-white/[0.07]" />
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={view}
                          className="absolute inset-0"
                          initial={{ opacity: 0, scale: 1.04 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.5, ease: EASE_EXPO }}
                        >
                          <ProductVisual visual={gallery[view]} variant="stage" eager />
                        </motion.div>
                      </AnimatePresence>
                      {["left-5 top-5 border-l border-t", "right-5 top-5 border-r border-t", "bottom-5 left-5 border-b border-l", "bottom-5 right-5 border-b border-r"].map((c) => (
                        <span key={c} className={`pointer-events-none absolute size-6 border-blaze/60 ${c}`} />
                      ))}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.24em] text-dim">
                        {product.name} · TCL
                      </div>
                    </div>
                  </Tilt>
                </motion.div>

                {gallery.length > 1 && (
                  <div className="mt-4 flex gap-3">
                    {gallery.map((g, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setView(i)}
                        aria-label={`View image ${i + 1}`}
                        aria-pressed={view === i}
                        className={cn(
                          "relative size-20 overflow-hidden rounded-2xl border bg-ink-900 transition-colors",
                          view === i ? "border-blaze" : "border-line hover:border-line-strong",
                        )}
                      >
                        <ProductVisual visual={g} variant="thumb" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {product.specs.slice(0, 3).map((s, i) => (
                    <Reveal key={s.label} delay={0.1 + i * 0.06} className="rounded-2xl border border-line bg-ink-900/70 p-4">
                      <div className="type-kicker !tracking-[0.14em] text-dim">{s.label}</div>
                      <div className="mt-1.5 text-sm font-medium leading-snug">{s.value}</div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>

            {/* Buy box */}
            <div className="lg:col-span-5">
              <div className="flex flex-wrap items-center gap-3">
                {product.badge && <Badge>{product.badge}</Badge>}
                <StatusDot status={product.status} />
              </div>
              <RevealLines as="h1" play={play} className="type-h1 mt-5" lines={[product.name]} />
              <p className="mt-3 text-lg text-muted">{product.tagline}</p>
              {product.reviewCount > 0 && (
                <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                  <Stars rating={product.rating} />
                  <span>
                    <span className="font-medium text-fg">{product.rating.toFixed(1)}</span> · {product.reviewCount} review{product.reviewCount === 1 ? "" : "s"}
                  </span>
                </div>
              )}

              <div className="mt-8 border-t border-line pt-8">
                <Price price={product.price} compareAt={product.compareAt} large />
                <p className="mt-6 leading-relaxed text-fg/80">{product.summary}</p>
              </div>

              {product.option && (
                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <span className="type-kicker text-dim">{product.option.name}</span>
                    <span className="text-sm text-muted">{option}</span>
                  </div>
                  <LayoutGroup id="opt">
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {product.option.values.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setOption(v)}
                          aria-pressed={option === v}
                          className={cn(
                            "relative h-12 rounded-xl border text-sm font-medium transition-colors",
                            option === v ? "border-transparent text-white" : "border-line-strong text-muted hover:text-fg",
                          )}
                        >
                          {option === v && <motion.span layoutId="opt-pill" className="absolute inset-0 rounded-xl border border-blaze bg-[#ff3d00]/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                          <span className="relative">{v}</span>
                        </button>
                      ))}
                    </div>
                  </LayoutGroup>
                </div>
              )}

              <div ref={buyRef} className="mt-8 flex flex-wrap gap-3">
                <QuantityStepper value={Math.min(qty, Math.max(1, maxQty))} onChange={setQty} max={Math.max(1, maxQty)} />
                <button
                  type="button"
                  onClick={() => addToCart(true)}
                  disabled={soldOut}
                  className="group relative flex h-12 flex-1 items-center justify-center gap-2.5 overflow-hidden bg-brand px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:13px] hover:brightness-110 disabled:bg-none disabled:bg-white/10 disabled:text-dim"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {soldOut ? (
                      <span key="sold">Sold out</span>
                    ) : added ? (
                      <motion.span key="ok" className="flex items-center gap-2.5" initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: -24 }}>
                        <Check className="size-4" strokeWidth={2.6} /> Added to cart
                      </motion.span>
                    ) : (
                      <motion.span key="add" className="flex items-center gap-2.5" initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: -24 }}>
                        <ShoppingBag className="size-4" /> Add to cart · {formatPrice(product.price * qty)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    if (!add(product, qty, option)) return;
                    pulseCart();
                    router.push("/checkout");
                  }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[12px] font-semibold uppercase tracking-[0.16em] text-fg transition-colors hover:border-blaze hover:bg-white/[0.03] disabled:pointer-events-none disabled:opacity-40"
                >
                  <Zap className="size-4 text-blaze" /> Buy it now
                </button>
              </div>

              <ul className="mt-8 grid grid-cols-2 gap-3">
                {perks.map(({ Icon, title, text }) => (
                  <li key={title} className="rounded-2xl border border-line bg-ink-900/60 p-4">
                    <Icon className="size-5 text-blaze" />
                    <div className="mt-3 text-sm font-medium">{title}</div>
                    <div className="mt-0.5 text-xs text-dim">{text}</div>
                  </li>
                ))}
              </ul>

              <Accordion
                className="mt-10"
                defaultOpen={0}
                items={[
                  {
                    q: "Highlights",
                    a: (
                      <ul className="space-y-2.5">
                        {product.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-3">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blaze" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    q: "Tech specs",
                    a: (
                      <dl className="divide-y divide-line rounded-2xl border border-line">
                        {product.specs.map((s) => (
                          <div key={s.label} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm">
                            <dt className="col-span-2 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{s.label}</dt>
                            <dd className="col-span-3 text-fg/90">{s.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ),
                  },
                  {
                    q: "In the box",
                    a: (
                      <ul className="space-y-2.5">
                        {product.inTheBox.map((h) => (
                          <li key={h} className="flex items-start gap-3">
                            <Check className="mt-0.5 size-4 shrink-0 text-blaze" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    q: "Shipping & returns",
                    a: `Orders placed on business days usually leave our lab within 24 hours. Shipping is free over ${formatPrice(settings.freeShippingThreshold)}; below that a flat ${formatPrice(settings.flatShipping)} applies. Unopened items can be returned within 14 days.`,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="py-28 md:py-36">
        <div className="container-x">
          <Kicker>Complete your setup</Kicker>
          <RevealLines as="h2" className="type-h2 mt-5" lines={["You might", <span key="b" className="text-gradient">also need</span>]} />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((p, i) => (
              <Reveal as="li" key={p.slug} delay={i * 0.07} y={40}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Sticky buy bar */}
      <AnimatePresence>
        {showBar && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 p-3 md:p-4"
            initial={{ y: "120%" }}
            animate={{ y: "0%" }}
            exit={{ y: "120%" }}
            transition={{ duration: 0.55, ease: EASE_EXPO }}
          >
            <div className="glass mx-auto flex max-w-3xl items-center gap-4 rounded-full py-2 pl-2 pr-2 shadow-[0_20px_60px_-10px_rgb(0_0_0/0.8)]">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-line bg-ink-850">
                <ProductVisual visual={product.visual} variant="thumb" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-xl uppercase leading-tight">{product.name}</div>
                <div className="truncate text-xs text-muted">
                  {formatPrice(product.price)}
                  {option ? ` · ${option}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => addToCart(true)}
                disabled={soldOut}
                className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-6 disabled:opacity-40 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] hover:brightness-110"
              >
                {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                <span className="hidden sm:inline">{added ? "Added" : "Add to cart"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
