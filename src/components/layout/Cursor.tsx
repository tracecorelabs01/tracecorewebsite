"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/**
 * A trailing ring that follows the native cursor (which stays visible).
 * It swells over interactive elements. Desktop + fine pointers only.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const [visible, setVisible] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 520, damping: 40, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 520, damping: 40, mass: 0.6 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const t = e.target as Element | null;
      setHover(!!t?.closest?.("a, button, [role='button'], input, select, textarea, label, [data-cursor]"));
    };
    const leave = () => setVisible(false);
    const press = () => setDown(true);
    const release = () => setDown(false);
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] -ml-5 -mt-5 size-10 rounded-full border border-blaze/70 mix-blend-screen"
      style={{ x: sx, y: sy }}
      animate={{
        scale: down ? 0.7 : hover ? 1.7 : 1,
        opacity: visible ? 1 : 0,
        backgroundColor: hover ? "rgba(255, 77, 15, 0.14)" : "rgba(255, 77, 15, 0)",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    />
  );
}
