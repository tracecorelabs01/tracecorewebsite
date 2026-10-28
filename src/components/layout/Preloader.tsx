"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MARK_PATHS, MARK_VIEWBOX, MarkGradients } from "@/components/brand/Logo";
import { EASE_EXPO } from "@/components/ui/motion";
import { useUi } from "@/lib/ui-store";

const MIN_DURATION = 1700;
const MAX_DURATION = 2600;
// Taller than the viewport so the slanted bottom edge stays off-screen until the curtain lifts.
const CURTAIN = "polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - 10vw))";

/**
 * First-visit intro: the TC mark assembles from its three pieces while assets
 * load, then a two-layer slanted curtain lifts away. Skipped for the rest of
 * the session (and for reduced-motion users) via an inline <head> script that
 * sets html[data-intro="done"] before first paint.
 */
export function Preloader() {
  const finishIntro = useUi((s) => s.finishIntro);
  const [phase, setPhase] = useState<"loading" | "exit" | "gone">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro === "done") {
      finishIntro();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time skip
      setPhase("gone");
      return;
    }

    // Brand moment, not a real loading gate: wait for the display font, never longer than MAX_DURATION.
    let ready = !document.fonts;
    document.fonts?.ready.then(() => {
      ready = true;
    });

    const start = performance.now();
    let raf = 0;
    const timers: number[] = [];
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

    // Time-based (not per-frame) so a busy main thread can't stall the counter.
    const tick = (now: number) => {
      const t = now - start;
      const eased = easeOut(Math.min(1, t / MIN_DURATION));
      const shown = ready || t > MAX_DURATION ? (t >= MIN_DURATION ? 1 : eased) : Math.min(eased, 0.86);
      setProgress(shown);

      if (shown >= 1) {
        try {
          sessionStorage.setItem("tc-intro", "1");
        } catch {}
        setPhase("exit");
        timers.push(window.setTimeout(finishIntro, 280));
        timers.push(
          window.setTimeout(() => {
            html.dataset.intro = "done";
            setPhase("gone");
          }, 1500),
        );
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [finishIntro]);

  if (phase === "gone") return null;
  const exiting = phase === "exit";
  const pct = Math.round(progress * 100);

  return (
    <div
      className={`tc-preloader fixed inset-0 z-[100] overflow-hidden ${exiting ? "pointer-events-none" : "pointer-events-auto"}`}
      aria-hidden={exiting}
      role="status"
      aria-label="Loading"
    >
      {/* trailing brand layer */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[calc(100%+10vw)] bg-brand-diag"
        style={{ clipPath: CURTAIN }}
        initial={{ y: "0%" }}
        animate={{ y: exiting ? "-105%" : "0%" }}
        transition={{ duration: 1.05, ease: EASE_EXPO, delay: exiting ? 0.16 : 0 }}
      />
      {/* main ink layer */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[calc(100%+10vw)] overflow-hidden bg-ink-950"
        style={{ clipPath: CURTAIN }}
        initial={{ y: "0%" }}
        animate={{ y: exiting ? "-105%" : "0%" }}
        transition={{ duration: 1.05, ease: EASE_EXPO }}
      >
        <div className="absolute inset-x-0 top-0 h-dvh bg-grid opacity-60 mask-radial" />
        <div className="absolute left-1/2 top-[50dvh] size-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.22),transparent_65%)]" />

        <div className="relative flex h-dvh flex-col items-center justify-center gap-10">
          <svg viewBox={MARK_VIEWBOX} className="h-24 w-auto overflow-visible md:h-28" aria-hidden>
            <MarkGradients id="pre" />
            <motion.path
              d={MARK_PATHS.wing}
              fill="url(#pre-wing)"
              initial={{ x: -900, y: -500, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: EASE_EXPO, delay: 0.1 }}
            />
            <motion.path
              d={MARK_PATHS.stem}
              fill="url(#pre-stem)"
              initial={{ x: 900, y: -700, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: 1.1, ease: EASE_EXPO, delay: 0.22 }}
            />
            <motion.path
              d={MARK_PATHS.plate}
              fill="url(#pre-plate)"
              initial={{ x: 500, y: 900, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: 1.1, ease: EASE_EXPO, delay: 0.38 }}
            />
          </svg>

          <div className="overflow-hidden">
            <motion.div
              className="font-display text-4xl uppercase tracking-[0.04em] md:text-5xl"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 1, ease: EASE_EXPO, delay: 0.55 }}
            >
              <span className="text-gradient">TraceCore</span>
              <span className="text-silver">Lab</span>
            </motion.div>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[calc(100dvh-9rem)] md:top-[calc(100dvh-11rem)]">
          <div className="container-x flex items-end justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
            <span>Initialising lab</span>
            <span className="font-display text-6xl tracking-normal text-fg tabular-nums md:text-8xl">
              {String(pct).padStart(3, "0")}
              <span className="text-gradient">%</span>
            </span>
          </div>
          <div className="container-x mt-4">
            <div className="h-px w-full bg-line">
              <div className="h-px bg-brand shadow-[0_0_12px_#ff3d00]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
