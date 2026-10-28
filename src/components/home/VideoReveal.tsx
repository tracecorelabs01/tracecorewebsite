"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionTemplate, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/bits";

const LINE = "Engineered for zero compromise.";

/**
 * Pinned cinematic section: the tinted operator video starts as an inset card
 * and expands to full-bleed as you scroll, while the headline lights up word
 * by word.
 */
export function VideoReveal() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const insetY = useTransform(scrollYProgress, [0, 0.42], [16, 0]);
  const insetX = useTransform(scrollYProgress, [0, 0.42], [10, 0]);
  const radius = useTransform(scrollYProgress, [0, 0.42], [36, 0]);
  const clipPath = useMotionTemplate`inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;
  const scale = useTransform(scrollYProgress, [0, 0.6], [1.22, 1]);
  const ctaOpacity = useTransform(scrollYProgress, [0.68, 0.8], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.68, 0.8], [24, 0]);
  const hudOpacity = useTransform(scrollYProgress, [0.3, 0.45], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (timecodeRef.current) {
      const f = Math.floor(v * 2400);
      timecodeRef.current.textContent = `00:${String(Math.floor(f / 240)).padStart(2, "0")}:${String(f % 240).padStart(3, "0")}`;
    }
  });

  // Only play while on screen; pause when hidden by route Activity.
  useEffect(() => {
    const video = videoRef.current;
    const section = ref.current;
    if (!video || !section) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.05 });
    io.observe(section);
    return () => {
      io.disconnect();
      video.pause();
    };
  }, []);

  const words = LINE.split(" ");

  return (
    <section ref={ref} className="relative h-[260vh]" aria-label="Engineered for zero compromise">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0 bg-ink-900" style={{ clipPath }}>
          <motion.video
            ref={videoRef}
            style={{ scale }}
            className="h-full w-full object-cover [filter:grayscale(1)_contrast(1.25)_brightness(0.8)]"
            src="/media/operators.mp4"
            poster="/media/operators-poster.webp"
            muted
            loop
            playsInline
            preload="metadata"
          />
          {/* colourise the greyscale footage with the brand gradient */}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,#ff1408_0%,#ff3d00_55%,#ff7a00_100%)] mix-blend-color" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(6_3_4/0.85)_85%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/40" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.22)_0px,rgb(0_0_0/0.22)_1px,transparent_1px,transparent_3px)] opacity-40" />
        </motion.div>

        {/* HUD frame */}
        <motion.div className="pointer-events-none absolute inset-6 hidden md:block" style={{ opacity: hudOpacity }} aria-hidden>
          {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((c) => (
            <span key={c} className={`absolute size-8 border-blaze/70 ${c}`} />
          ))}
          <div className="absolute left-12 top-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg/80">
            <span className="size-2 animate-pulse rounded-full bg-ember shadow-[0_0_10px_#ff1408]" /> Rec
          </div>
          <span ref={timecodeRef} className="absolute right-12 top-1 font-mono text-[11px] tracking-[0.2em] text-fg/70">
            00:00:000
          </span>
          <span className="absolute bottom-1 left-12 font-mono text-[11px] uppercase tracking-[0.2em] text-fg/50">TCL-CAM 01</span>
          <span className="absolute bottom-1 right-12 font-mono text-[11px] uppercase tracking-[0.2em] text-fg/50">4K · 60FPS</span>
        </motion.div>

        <div className="container-x relative z-10 flex flex-col items-center text-center">
          <Kicker index="01" className="text-fg/70">
            The TraceCore standard
          </Kicker>
          <h2 className="type-h1 mt-6 max-w-6xl">
            {words.map((w, i) => (
              <Word key={i} progress={scrollYProgress} range={[0.18 + (i / words.length) * 0.42, 0.18 + ((i + 1) / words.length) * 0.42]} accent={i >= 2}>
                {w}
              </Word>
            ))}
          </h2>
          <motion.div style={{ opacity: ctaOpacity, y: ctaY }} className="mt-8 flex max-w-xl flex-col items-center gap-8">
            <p className="text-lg text-fg/75">
              Every board is flashed, checked and burn-in tested in our lab before it ships. If it doesn&apos;t pass, it doesn&apos;t leave.
            </p>
            <ButtonLink href="/shop" size="lg">
              Explore the lineup
            </ButtonLink>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Word({ children, progress, range, accent }: { children: string; progress: MotionValue<number>; range: [number, number]; accent?: boolean }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const y = useTransform(progress, range, [12, 0]);
  return (
    <motion.span style={{ opacity, y }} className={`mr-[0.22em] inline-block ${accent ? "text-gradient" : ""}`}>
      {children}
    </motion.span>
  );
}
