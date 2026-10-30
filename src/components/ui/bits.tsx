"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { STOCK_LABEL, type StockStatus } from "@/lib/catalog/types";
import { cn, formatPrice } from "@/lib/utils";
import { EASE_EXPO } from "./motion";

/* ── Kicker: slanted brand bar + mono label ── */
export function Kicker({ children, index, className }: { children: ReactNode; index?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 type-kicker text-muted", className)}>
      <span aria-hidden className="h-[3px] w-7 bg-brand clip-slant [--slant:3px]" />
      {index && <span className="text-blaze">{index}</span>}
      <span>{children}</span>
    </div>
  );
}

/* ── Hover text-scramble (mono fonts keep width stable) ── */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/";
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [out, setOut] = useState(text);
  const raf = useRef(0);

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const dur = 380;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const solved = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        s += i < solved || text[i] === " " ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [text]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <span className={className} onPointerEnter={run} onFocus={run}>
      <span aria-hidden>{out}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/* ── Count-up number, starts when scrolled into view ── */
export function Counter({ value, decimals = 0, suffix = "", prefix = "", duration = 2.2, className }: { value: number; decimals?: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const fmt = useCallback(
    (v: number) => prefix + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix,
    [decimals, prefix, suffix],
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!inView) {
      node.textContent = fmt(0);
      return;
    }
    // Write only when the digits change: the ease-out settles early but keeps calling onUpdate until the end.
    const controls = animate(0, value, {
      duration,
      ease: EASE_EXPO,
      onUpdate: (v) => {
        const text = fmt(v);
        if (node.textContent !== text) node.textContent = text;
      },
    });
    return () => controls.stop();
  }, [inView, value, duration, fmt]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {fmt(value)}
    </span>
  );
}

/* ── Rating stars with fractional fill ── */
export function Stars({ rating, className, size = 14 }: { rating: number; className?: string; size?: number }) {
  const id = `st${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="#ff2a10" />
            <stop offset="1" stopColor="#ff8a1f" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-white/15">
              <path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 24 24" width={size} height={size}>
                <path fill={`url(#${id})`} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ── Price with optional compare-at ── */
export function Price({ price, compareAt, className, large }: { price: number; compareAt?: number; className?: string; large?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2.5", className)}>
      <span className={cn("font-display tracking-wide text-fg", large ? "text-5xl" : "text-[1.7rem]")}>{formatPrice(price)}</span>
      {compareAt && compareAt > price && (
        <>
          <span className={cn("text-dim line-through", large ? "text-xl" : "text-sm")}>{formatPrice(compareAt)}</span>
          {large && (
            <span className="clip-slant bg-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white [--slant:6px]">
              Save {Math.round((1 - price / compareAt) * 100)}%
            </span>
          )}
        </>
      )}
    </div>
  );
}

/* ── Stock status pill ── */
const STATUS_DOT: Record<StockStatus, string> = {
  "in-stock": "bg-ok text-ok",
  "low-stock": "bg-warn text-warn",
  preorder: "bg-silver text-silver",
  "sold-out": "bg-dim text-dim",
};

export function StatusDot({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 type-kicker !tracking-[0.16em] text-muted", className)}>
      <span className={cn("pulse-dot size-1.5 rounded-full", STATUS_DOT[status])} />
      {STOCK_LABEL[status]}
    </span>
  );
}

/* ── Slanted badge ── */
export function Badge({ children, className, tone = "brand" }: { children: ReactNode; className?: string; tone?: "brand" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center clip-slant px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] [--slant:6px]",
        tone === "brand" ? "bg-brand text-white" : "bg-white/10 text-fg backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Quantity stepper ── */
export function QuantityStepper({ value, onChange, className, size = "md", max = 99 }: { value: number; onChange: (v: number) => void; className?: string; size?: "sm" | "md"; max?: number }) {
  const h = size === "sm" ? "h-9" : "h-12";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-line-strong bg-ink-900", h, className)}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(1, value - 1))} className="grid h-full w-10 place-items-center text-muted transition-colors hover:text-fg disabled:opacity-30" disabled={value <= 1}>
        <Minus className="size-3.5" />
      </button>
      <span className="relative w-7 overflow-hidden text-center font-mono text-sm tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="block" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.25, ease: EASE_EXPO }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid h-full w-10 place-items-center text-muted transition-colors hover:text-fg disabled:opacity-30">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Accordion (single open) ── */
export function Accordion({ items, defaultOpen = 0, className }: { items: { q: string; a: ReactNode }[]; defaultOpen?: number | null; className?: string }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <h3>
              <button
                type="button"
                id={`${base}-b${i}`}
                aria-expanded={isOpen}
                aria-controls={`${base}-p${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left"
              >
                <span className={cn("text-[17px] font-medium transition-colors md:text-lg", isOpen ? "text-fg" : "text-fg/85 group-hover:text-fg")}>{it.q}</span>
                <span
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                    isOpen ? "border-transparent bg-brand text-white" : "border-line-strong text-muted group-hover:border-blaze/60 group-hover:text-fg",
                  )}
                >
                  <span className="absolute h-[1.5px] w-3.5 rounded bg-current" />
                  <motion.span className="absolute h-[1.5px] w-3.5 rounded bg-current" animate={{ rotate: isOpen ? 0 : 90 }} transition={{ duration: 0.35, ease: EASE_EXPO }} />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`${base}-p${i}`}
                  role="region"
                  aria-labelledby={`${base}-b${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE_EXPO }}
                  className="overflow-hidden"
                >
                  <div className="pb-6 pr-12 leading-relaxed text-muted">{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
