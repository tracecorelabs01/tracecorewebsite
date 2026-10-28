"use client";

import { useRef, type ReactNode } from "react";
import { motion, useAnimationFrame, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from "motion/react";
import { cn, wrap } from "@/lib/utils";

/**
 * Infinite marquee whose speed (and direction) reacts to scroll velocity.
 * Children are repeated `repeat` times; make one copy at least viewport-wide.
 */
export function VelocityMarquee({
  children,
  baseVelocity = -3,
  repeat = 4,
  className,
  trackClassName,
}: {
  children: ReactNode;
  baseVelocity?: number;
  repeat?: number;
  className?: string;
  trackClassName?: string;
}) {
  const reduce = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(baseX, (v) => `${wrap(-100 / repeat, 0, v)}%`);
  const direction = useRef(1);
  // The loop writes a transform every frame, so only run it while the band can be seen.
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { margin: "100px 0px" });

  useAnimationFrame((_, delta) => {
    if (reduce || !visible) return;
    let moveBy = direction.current * baseVelocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) direction.current = -1;
    else if (f > 0) direction.current = 1;
    moveBy += direction.current * moveBy * f;
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div ref={root} className={cn("flex overflow-hidden whitespace-nowrap", className)}>
      <motion.div className={cn("flex shrink-0 whitespace-nowrap will-change-transform", trackClassName)} style={{ x }}>
        {Array.from({ length: repeat }).map((_, i) => (
          <div key={i} aria-hidden={i > 0 || undefined} className="flex shrink-0">
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/** Pure-CSS marquee (cheap, pauses on hover). */
export function CssMarquee({
  children,
  duration = 45,
  reverse = false,
  className,
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("group flex overflow-hidden mask-fade-x", className)}>
      <div
        className="flex w-max shrink-0 animate-marquee group-hover:[animation-play-state:paused]"
        style={{ ["--marquee-duration" as string]: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
