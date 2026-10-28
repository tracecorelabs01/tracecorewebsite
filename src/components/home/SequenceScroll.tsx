"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { Kicker } from "@/components/ui/bits";

const FRAMES = 80;
// Frames kept decoded on each side of the current one (a 1280x720 frame is ~3.7 MB decoded).
const NEAR = 10;
const src = (i: number) => `/sequence/${String(i + 1).padStart(3, "0")}.webp`;

const steps = [
  { n: "01", title: "Choose your setup", text: "Pick a card, add Ferrum and the accessories you need — or grab a bundle and save." },
  { n: "02", title: "Plug in & go", text: "Every order ships with a quick-start card, and step-by-step guides live on our Discord." },
  { n: "03", title: "Backed by the lab", text: "A 12-month warranty and 24/7 support." },
];

/** Scroll-scrubbed image sequence (the operator reveal) drawn to a canvas. */
export function SequenceScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameLabel = useRef<HTMLSpanElement>(null);
  const loadLabel = useRef<HTMLSpanElement>(null);
  // Every frame is downloaded up front, but only the ones near the current frame are decoded, off the main
  // thread, into bitmaps. Drawing an <img> instead makes Chrome decode it on the main thread mid-scroll.
  const files = useRef<Blob[]>([]);
  const bitmaps = useRef(new Map<number, ImageBitmap>());
  const decoding = useRef(new Set<number>());
  const current = useRef(0);
  const shown = useRef(-1);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const frame = useTransform(scrollYProgress, [0, 0.9], [0, FRAMES - 1], { clamp: true });
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const headingOpacity = useTransform(scrollYProgress, [0, 0.08, 0.86, 0.98], [0, 1, 1, 0]);

  const draw = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Opaque: every draw fills the whole canvas, so the compositor can skip blending it.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    // fall back to the nearest decoded frame while the rest stream in
    let at = -1;
    for (let d = 0; d < FRAMES && at < 0; d++) {
      if (bitmaps.current.has(index - d)) at = index - d;
      else if (bitmaps.current.has(index + d)) at = index + d;
    }
    shown.current = at;
    const img = bitmaps.current.get(at);
    const { width: cw, height: ch } = canvas;
    if (!img) {
      // Nothing decoded yet: match the page background the transparent canvas used to show.
      ctx.fillStyle = "#060304";
      ctx.fillRect(0, 0, cw, ch);
      return;
    }
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.fillStyle = "#050203";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }, []);

  // Decode the frames around the current one, nearest first and a few at a time; drop the ones left behind.
  const decodeNear = useCallback(
    function decodeNear() {
      if (!canvasRef.current) return; // unmounted
      const at = current.current;
      for (const [i, bmp] of bitmaps.current) {
        if (Math.abs(i - at) <= NEAR) continue;
        bmp.close();
        bitmaps.current.delete(i);
      }
      for (let d = 0; d <= NEAR; d++) {
        for (const i of [at + d, at - d]) {
          if (decoding.current.size >= 4) return;
          const file = files.current[i];
          if (!file || bitmaps.current.has(i) || decoding.current.has(i)) continue;
          decoding.current.add(i);
          createImageBitmap(file).then(
            (bmp) => {
              decoding.current.delete(i);
              const want = current.current;
              if (Math.abs(i - want) > NEAR) bmp.close();
              else {
                bitmaps.current.set(i, bmp);
                if (shown.current < 0 || Math.abs(i - want) < Math.abs(shown.current - want)) draw(want);
              }
              decodeNear();
            },
            () => decoding.current.delete(i),
          );
        }
      }
    },
    [draw],
  );

  // Size the canvas to its box (DPR-aware).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      draw(current.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // Start downloading frames when the section is within a screen of the viewport.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const live = bitmaps.current;
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        let loaded = 0;
        for (let i = 0; i < FRAMES; i++) {
          fetch(src(i))
            .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
            .then((file) => {
              files.current[i] = file;
              loaded += 1;
              if (loadLabel.current) loadLabel.current.textContent = loaded < FRAMES ? `Loading ${Math.round((loaded / FRAMES) * 100)}%` : "Scroll";
              decodeNear();
            })
            .catch(() => {});
        }
      },
      { rootMargin: "120% 0px" },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      for (const bmp of live.values()) bmp.close();
      live.clear();
    };
  }, [decodeNear]);

  useMotionValueEvent(frame, "change", (v) => {
    const i = Math.round(v);
    if (i === current.current) return;
    current.current = i;
    if (frameLabel.current) frameLabel.current.textContent = String(i + 1).padStart(3, "0");
    decodeNear();
    requestAnimationFrame(() => draw(i));
  });

  return (
    <section ref={sectionRef} className="relative h-[340vh]" aria-label="How it works">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(6_3_4/0.75)_90%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-ink-950 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink-950 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/20 to-transparent md:via-transparent" />

        <div className="container-x relative flex h-full flex-col justify-between pb-10 pt-32 md:pb-14">
          <motion.div style={{ opacity: headingOpacity }}>
            <Kicker index="04">How it works</Kicker>
            <h2 className="type-h1 mt-5">
              Suit
              <br />
              <span className="text-gradient">up.</span>
            </h2>
          </motion.div>

          <div className="relative min-h-[190px] md:ml-auto md:w-[420px]">
            {steps.map((s, i) => (
              <Step key={s.n} progress={scrollYProgress} index={i} {...s} />
            ))}
          </div>

          <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
            <span>
              FRM <span ref={frameLabel}>001</span>/{FRAMES}
            </span>
            <div className="h-px flex-1 bg-line">
              <motion.div className="h-px origin-left bg-brand shadow-[0_0_10px_#ff3d00]" style={{ scaleX: bar }} />
            </div>
            <span ref={loadLabel}>Loading 0%</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ progress, index, n, title, text }: { progress: MotionValue<number>; index: number; n: string; title: string; text: string }) {
  const start = 0.14 + index * 0.25;
  const end = start + 0.22;
  const opacity = useTransform(progress, [start, start + 0.05, end - 0.05, end], [0, 1, 1, index === steps.length - 1 ? 1 : 0]);
  const y = useTransform(progress, [start, start + 0.06, end - 0.05, end], [40, 0, 0, index === steps.length - 1 ? 0 : -30]);
  return (
    <motion.div style={{ opacity, y }} className="glass absolute inset-x-0 bottom-0 rounded-3xl p-7">
      <div className="flex items-center justify-between">
        <span className="font-display text-6xl text-gradient">{n}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Step {index + 1} of 3</span>
      </div>
      <h3 className="type-h3 mt-4">{title}</h3>
      <p className="mt-2 text-muted">{text}</p>
    </motion.div>
  );
}
