"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, Globe2, ShieldCheck, Truck } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { ProductShowcase } from "./ProductShowcase";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { Stars } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { EASE_EXPO, Magnetic, RevealLines, pauseOffscreen } from "@/components/ui/motion";
import type { ReviewSummary } from "@/lib/catalog/types";
import { useUi } from "@/lib/ui-store";
import { seeded } from "@/lib/utils";
import { WARRANTY_MONTHS } from "@/lib/warranty";

const loadScene = () => import("./LogoScene");
const LogoScene = dynamic(loadScene, { ssr: false, loading: () => null });

function StaticMark() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <LogoMark className="h-auto w-[58%] animate-float drop-shadow-[0_20px_60px_rgb(255_40_0/0.45)]" />
    </div>
  );
}

export function Hero({ rating, ferrumPrice, cardPrice }: { rating: ReviewSummary | null; ferrumPrice?: number; cardPrice?: number }) {
  const play = useUi((s) => s.introDone);
  const { setupDiscountPercent } = useStoreSettings();
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: play ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: { duration: 1, ease: EASE_EXPO, delay },
  });

  return (
    <section ref={pauseOffscreen} className="relative isolate overflow-hidden pt-[106px]">
      <Backdrop />
      <div className="container-x relative grid min-h-[calc(100svh-106px)] items-center gap-6 pb-16 pt-6 lg:grid-cols-12 lg:gap-10 lg:pb-16">
        <div className="relative z-10 lg:col-span-7">
          <motion.div {...fade(0.05)}>
            <Link
              href="/product/tracecore-100t-pro"
              className="group mb-7 inline-flex items-center gap-3 rounded-full border border-line-strong bg-ink-900/60 py-1.5 pl-1.5 pr-4 backdrop-blur transition-colors hover:border-blaze/60"
            >
              <span className="rounded-full bg-brand px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white">New</span>
              <span className="text-sm text-fg/80">TraceCore 100T Pro is here</span>
              <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <RevealLines
            as="h1"
            play={play}
            delay={0.1}
            className="type-hero"
            lines={[
              "Built in",
              "the lab.",
              <span key="a" className="text-gradient">
                Proven in
              </span>,
              <span key="b" className="text-outline">
                the field.
              </span>,
            ]}
          />

          <motion.p {...fade(0.55)} className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            FPGA-powered DMA cards, precision input devices and the accessories that tie them together — quality-checked by hand, shipped worldwide and backed by
            24/7 support.
          </motion.p>

          <motion.div {...fade(0.68)} className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <ButtonLink href="/shop" size="lg">
                Shop hardware
              </ButtonLink>
            </Magnetic>
            <ButtonLink href="/product/ferrum" variant="ghost" size="lg">
              Meet Ferrum
            </ButtonLink>
          </motion.div>

          <motion.div {...fade(0.75)} className="mt-5">
            <Link
              href="/shop#build"
              className="group inline-flex items-center gap-3 rounded-full border border-line-strong bg-ink-900/60 py-1.5 pl-1.5 pr-4 backdrop-blur transition-colors hover:border-blaze/60"
            >
              <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                {setupDiscountPercent > 0 ? "Bundle deal" : "Setup builder"}
              </span>
              <span className="text-sm text-fg/80">
                {setupDiscountPercent > 0 ? `Configure your setup now and save an extra ${setupDiscountPercent}%` : "Configure your setup in four quick questions"}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.ul {...fade(0.82)} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-muted">
            {rating ? (
              <li className="flex items-center gap-2.5">
                <Stars rating={rating.average} />
                <span>
                  <span className="font-semibold text-fg">{rating.average}</span> · {rating.count.toLocaleString("en-US")} review{rating.count === 1 ? "" : "s"}
                </span>
              </li>
            ) : (
              <li className="flex items-center gap-2">
                <Globe2 className="size-4 text-blaze" /> Worldwide shipping
              </li>
            )}
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-blaze" /> Ships within 24h
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-blaze" /> {WARRANTY_MONTHS}-month warranty
            </li>
          </motion.ul>
        </div>

        <motion.div
          className="relative order-first h-[34vh] min-h-[260px] lg:order-none lg:col-span-5 lg:h-[72vh]"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={play ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
          transition={{ duration: 1.4, ease: EASE_EXPO, delay: 0.15 }}
        >
          <Orb play={play} />
          {cardPrice !== undefined && (
            <ProductShowcase
              scene="card"
              play={play}
              href="/product/tracecore-75t"
              name="TraceCore 75T"
              price={cardPrice}
              badge="Best-seller"
              className="-left-[26%] top-[0%] aspect-[3/4] w-[54%] xl:w-[56%]"
              labelClassName="bottom-[4%] left-[18%]"
            />
          )}
          {ferrumPrice !== undefined && (
            <ProductShowcase
              scene="ferrum"
              play={play}
              href="/product/ferrum"
              name="Ferrum"
              price={ferrumPrice}
              badge="New"
              fallback="/products/ferrum-thumb.webp"
              className="-bottom-[5%] -right-[3%] aspect-[16/11] w-[50%] xl:w-[58%]"
              labelClassName="-bottom-[3%] right-[9%]"
            />
          )}
        </motion.div>
      </div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: play ? 1 : 0 }}
        transition={{ delay: 1.4, duration: 1 }}
      >
        <div className="flex flex-col items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
          Scroll
          <span className="relative h-10 w-px overflow-hidden bg-line">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-blaze to-transparent" />
          </span>
        </div>
      </motion.div>
    </section>
  );
}

/* The 3D mark wrapped in rotating HUD rings and floating spec labels. */
function Orb({ play }: { play: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [use3d, setUse3d] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check after mount
    setUse3d(desktop && webgl);
    // Warm the three.js chunk while the preloader runs; mount it once the intro ends.
    if (desktop && webgl) loadScene();

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => {
      io.disconnect();
      setActive(false); // route hidden by Activity: stop the render loop
    };
  }, []);

  const labels = [
    { text: "FPGA · Artix-7", pos: "right-[6%] top-[10%]", delay: 1.0 },
    { text: "Link · USB-C 3.0", pos: "right-[0%] top-[42%]", delay: 1.15 },
    { text: "Bus · PCIe x1", pos: "bottom-[14%] left-[10%]", delay: 1.3 },
  ];

  return (
    <div ref={ref} className="absolute inset-0">
      <div className="absolute left-1/2 top-1/2 aspect-square w-[min(100%,74vh)] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.28),rgb(255_20_8/0.06)_45%,transparent_68%)] blur-xl" />
        {/* Each ring is a static SVG on its own HTML layer that the GPU rotates. Rotating SVG groups instead
            re-lays out and repaints the whole drawing every frame. */}
        <div className="absolute inset-0 animate-spin-slower" aria-hidden>
          <svg viewBox="0 0 400 400" className="h-full w-full">
            <circle cx="200" cy="200" r="194" fill="none" stroke="rgb(255 236 230 / 0.12)" strokeDasharray="1.5 7" />
          </svg>
        </div>
        <div className="absolute inset-0 animate-spin-rev" aria-hidden>
          <svg viewBox="0 0 400 400" className="h-full w-full">
            <defs>
              <linearGradient id="orb-ring" x1="0" x2="1">
                <stop offset="0" stopColor="#ff1408" />
                <stop offset="1" stopColor="#ff7a00" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="172" fill="none" stroke="url(#orb-ring)" strokeWidth="1.2" strokeDasharray="120 960" strokeLinecap="round" />
            {Array.from({ length: 60 }).map((_, i) => (
              <line
                key={i}
                x1="200"
                y1={i % 5 === 0 ? 20 : 24}
                x2="200"
                y2="28"
                stroke={i % 5 === 0 ? "rgb(255 106 0 / 0.7)" : "rgb(255 236 230 / 0.16)"}
                strokeWidth="1"
                transform={`rotate(${i * 6} 200 200)`}
              />
            ))}
          </svg>
        </div>
        <div className="absolute inset-0 animate-spin-slow" aria-hidden>
          <svg viewBox="0 0 400 400" className="h-full w-full">
            <circle cx="200" cy="200" r="138" fill="none" stroke="rgb(255 236 230 / 0.07)" />
          </svg>
          {/* The orbiting dot (circle at 200,62 r=3.5 in the 400 viewBox), pulsing with CSS instead of SVG <animate>. */}
          <span className="absolute left-1/2 top-[15.5%] aspect-square w-[1.75%] -translate-x-1/2 -translate-y-1/2 animate-dot-pulse rounded-full bg-[#ff6a00]" />
        </div>
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M 70 200 H 92 M 308 200 H 330 M 200 70 V 92 M 200 308 V 330" stroke="rgb(255 236 230 / 0.25)" />
        </svg>
        <div className="absolute inset-[12%]">{use3d ? play && <LogoScene play={play} active={active} /> : <StaticMark />}</div>
      </div>

      {labels.map((l) => (
        <motion.div
          key={l.text}
          className={`absolute ${l.pos} hidden items-center gap-2 rounded-full border border-line-strong bg-ink-900/70 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg/80 backdrop-blur sm:flex`}
          initial={{ opacity: 0, y: 10 }}
          animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.8, ease: EASE_EXPO, delay: l.delay }}
        >
          <span className="size-1.5 rounded-full bg-blaze shadow-[0_0_8px_#ff6a00]" />
          {l.text}
        </motion.div>
      ))}
    </div>
  );
}

/* Glows, perspective grid floor, slanted brand shards and rising embers. */
function Backdrop() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const shardX = useTransform(sx, (v) => v * -30);
  const shardY = useTransform(sy, (v) => v * -20);
  const glowX = useTransform(sx, (v) => v * 40);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  const rand = seeded(7);
  const embers = Array.from({ length: 18 }, () => ({
    left: `${rand() * 100}%`,
    size: 2 + rand() * 3,
    duration: 7 + rand() * 9,
    delay: -rand() * 14,
    drift: (rand() - 0.5) * 120,
  }));
  // One keyframe set per ember with its drift written in: keyframes that read var() can't run on the GPU.
  const emberKeyframes = embers
    .map((e, i) => `@keyframes ember-${i}{0%{transform:translate3d(0,0,0) scale(1);opacity:0}10%{opacity:1}100%{transform:translate3d(${e.drift}px,-110vh,0) scale(0.4);opacity:0}}`)
    .join("");

  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <motion.div style={{ x: glowX }} className="absolute -right-[12%] -top-[25%] size-[78vw] max-w-[1200px] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.22),transparent_62%)]" />
      <div className="absolute -left-[20%] top-[35%] size-[50vw] rounded-full bg-[radial-gradient(circle,rgb(255_20_8/0.12),transparent_65%)]" />

      <motion.div style={{ x: shardX, y: shardY }} className="absolute inset-0">
        <div className="absolute right-[6%] top-[14%] h-[46%] w-[26%] skew-x-[-30deg] rounded-[28px] bg-gradient-to-b from-white/[0.035] to-transparent" />
        <div className="absolute right-[-8%] top-[52%] h-[40%] w-[30%] skew-x-[-30deg] rounded-[28px] bg-gradient-to-b from-[#ff3d00]/[0.06] to-transparent" />
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 h-[52%] overflow-hidden [perspective:700px]">
        <div className="absolute inset-x-[-60%] -bottom-[6%] h-[150%] origin-bottom overflow-hidden [mask-image:linear-gradient(to_top,#000_5%,transparent_70%)] [transform:rotateX(66deg)]">
          {/* One 64px cell taller than the floor and moved down a cell per loop: the same flow as animating
              background-position, but the GPU slides it instead of repainting it every frame. */}
          <div className="absolute inset-x-0 -top-[64px] bottom-0 animate-grid-flow bg-[linear-gradient(to_right,rgb(255_77_15/0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_77_15/0.2)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>
      </div>

      <div className="absolute inset-0 bg-dots opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_60%)]" />

      <style>{emberKeyframes}</style>
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-[-10px] rounded-full bg-[#ff6a00] shadow-[0_0_10px_2px_rgb(255_80_10/0.6)]"
          style={{ left: e.left, width: e.size, height: e.size, animation: `ember-${i} ${e.duration}s linear ${e.delay}s infinite` }}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}
