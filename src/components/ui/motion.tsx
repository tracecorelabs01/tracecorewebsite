"use client";

import { useRef, type ReactNode, type ElementType, type PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

export const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

let offscreen: IntersectionObserver | undefined;

/** Ref callback: pauses the CSS animations inside an element while it is off screen (rule in globals.css). */
export function pauseOffscreen(el: Element | null) {
  if (!el) return;
  offscreen ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
    },
    { rootMargin: "100px 0px" },
  );
  offscreen.observe(el);
  return () => offscreen?.unobserve(el);
}

/** Fade/slide content in when it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  x = 0,
  amount = 0.25,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
  amount?: number;
  as?: "div" | "li" | "section" | "article" | "p" | "span";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  // A whole `transform` (not x/y) lets Motion hand the slide to the compositor instead of restyling every frame.
  // It animates to an explicit identity (Motion can't tween to "none") and lands on "none", as x/y did.
  // Reduced motion only skips x/y on its own, so the slide is made instant here, as it was.
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, transform: `translate(${x}px, ${y}px)` }}
      whileInView={{ opacity: 1, transform: "translate(0px, 0px)", transitionEnd: { transform: "none" } }}
      viewport={{ once: true, amount }}
      transition={{ duration: 1, ease: EASE_EXPO, delay, ...(reduce && { transform: { type: false } }) }}
    >
      {children}
    </Comp>
  );
}

// One transform string, not y/rotate, so the compositor runs it (see Reveal).
const lineVariants: Variants = {
  hidden: { transform: "translateY(125%) rotate(3deg)" },
  shown: ({ delay, reduce }: { delay: number; reduce: boolean }) => ({
    transform: "translateY(0%) rotate(0deg)",
    transitionEnd: { transform: "none" },
    transition: reduce ? { type: false } : { duration: 1.15, ease: EASE_EXPO, delay },
  }),
};

/**
 * Masked line-by-line headline reveal. Each line slides up out of its own
 * overflow mask; the padding/negative-margin trick keeps tall display glyphs
 * from being clipped despite a tight line-height.
 *
 * The viewport trigger sits on an untransformed wrapper: the lines themselves
 * start fully clipped by their masks, so IntersectionObserver would never
 * report them as visible.
 */
export function RevealLines({
  lines,
  as = "h2",
  className,
  lineClassName,
  delay = 0,
  stagger = 0.09,
  play,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
  /** When provided, animation is driven by this flag instead of viewport entry. */
  play?: boolean;
}) {
  const Tag = as;
  const controlled = play !== undefined;
  const reduce = useReducedMotion() ?? false;
  return (
    <Tag className={className}>
      <motion.span
        className="block"
        initial="hidden"
        {...(controlled ? { animate: play ? "shown" : "hidden" } : { whileInView: "shown", viewport: { once: true, amount: 0.35 } })}
      >
        {lines.map((line, i) => (
          <span key={i} className="-my-[0.14em] block overflow-hidden py-[0.14em]">
            <motion.span className={cn("block origin-bottom-left will-change-transform", lineClassName)} variants={lineVariants} custom={{ delay: delay + i * stagger, reduce }}>
              {line}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Pulls its child toward the cursor; springs back on leave. Mouse only. */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 200, damping: 16, mass: 0.5 });
  const y = useSpring(0, { stiffness: 200, damping: 16, mass: 0.5 });

  function onMove(e: PointerEvent) {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x, y }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}

/** 3D pointer tilt with a moving glare highlight. */
export function Tilt({
  children,
  className,
  max = 7,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 160, damping: 18 });
  const ry = useSpring(0, { stiffness: 160, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glareBg = useMotionTemplate`radial-gradient(520px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.09), transparent 45%)`;

  function onMove(e: PointerEvent) {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
    gx.set(px * 100);
    gy.set(py * 100);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className={cn("relative", className)}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  );
}

/** Updates --mx/--my so the `.spotlight` CSS class can follow the pointer. */
export function spotlightHandler(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}
