"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { Counter, Kicker } from "@/components/ui/bits";
import { EASE_EXPO, Reveal, RevealLines, pauseOffscreen, spotlightHandler } from "@/components/ui/motion";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { cn } from "@/lib/utils";

export function WhyUs() {
  const { stats } = useStoreSettings();
  return (
    <section ref={pauseOffscreen} className="relative py-28 md:py-36" aria-labelledby="why-heading">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Kicker index="03">Why TraceCoreLab</Kicker>
            <RevealLines as="h2" className="type-h2 mt-5" lines={[<span key="a" id="why-heading">More than</span>, <span key="b" className="text-gradient">a store.</span>]} />
          </div>
          <Reveal delay={0.15}>
            <p className="max-w-md text-muted lg:text-right">We test what we sell, ship it fast, and stay on the other end of the chat until you&apos;re up and running.</p>
          </Reveal>
        </div>

        <div className="mt-14 grid auto-rows-[minmax(240px,auto)] gap-4 md:grid-cols-6">
          <Cell className="md:col-span-6 lg:col-span-3 lg:row-span-2" delay={0}>
            <LabCell />
          </Cell>
          <Cell className="md:col-span-3" delay={0.08}>
            <ShippingCell />
          </Cell>
          <Cell className="md:col-span-3 lg:col-span-3" delay={0.16}>
            <ChatCell />
          </Cell>
          <Cell className="md:col-span-3 lg:col-span-2" delay={0.1}>
            <SecureCell />
          </Cell>
          <Cell className="md:col-span-3 lg:col-span-4" delay={0.18}>
            <TerminalCell />
          </Cell>
        </div>

        <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-3xl border border-line bg-ink-900/60 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06} className={cn("relative p-6 md:p-8", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line lg:border-t-0", i === 2 && "lg:border-l")}>
              <dt className="type-kicker text-dim">{s.label}</dt>
              <dd className="mt-3 font-display text-5xl md:text-6xl">
                <Counter value={s.value} decimals={s.decimals ?? 0} />
                <span className="text-gradient">{s.suffix}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Cell({ children, className, delay }: { children: ReactNode; className?: string; delay: number }) {
  return (
    <Reveal className={cn("h-full", className)} delay={delay} y={40}>
      <div onPointerMove={spotlightHandler} className="spotlight border-flow group relative h-full overflow-hidden rounded-3xl border border-line bg-ink-900 transition-colors hover:border-transparent">
        {children}
      </div>
    </Reveal>
  );
}

function CellText({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative z-10", className)}>
      <h3 className="type-h3">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function LabCell() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const steps = ["Flash & verify", "Link test", "Burn-in", "Visual QC", "Packed by hand"];
  return (
    <div ref={ref} className="relative flex h-full min-h-[520px] flex-col justify-end p-7 md:p-9">
      <Image src="/media/lab-render.webp" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover opacity-70 transition-transform duration-[1.6s] ease-[var(--ease-expo)] group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/10" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-[#ff4d0f]/15 to-transparent" />
      </div>
      <ul className="relative z-10 mb-8 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <motion.li
            key={s}
            className="flex items-center gap-2 rounded-full border border-line-strong bg-ink-950/70 py-1.5 pl-1.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.12em] backdrop-blur"
            initial={{ opacity: 0, transform: "translateY(14px)" }}
            animate={inView ? { opacity: 1, transform: "translateY(0px)", transitionEnd: { transform: "none" } } : {}}
            transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.3 + i * 0.18, ...(reduce && { transform: { type: false } }) }}
          >
            <motion.span
              className="grid size-5 place-items-center rounded-full bg-brand"
              initial={{ transform: "scale(0)" }}
              animate={inView ? { transform: "scale(1)", transitionEnd: { transform: "none" } } : {}}
              transition={reduce ? { type: false } : { type: "spring", stiffness: 500, damping: 18, delay: 0.5 + i * 0.18 }}
            >
              <Check className="size-3 text-white" strokeWidth={3} />
            </motion.span>
            {s}
          </motion.li>
        ))}
      </ul>
      <CellText title="Tested in our lab. Every unit.">
        Nothing ships until it passes our checks — flashing, link stability, burn-in and a final visual inspection.
      </CellText>
    </div>
  );
}

function ShippingCell() {
  const route = "M 60 120 C 140 20, 300 20, 380 96";
  const motionRef = useRef<SVGSVGElement>(null);

  // SMIL runs on the main thread even off screen; only run it while the cell can be seen.
  useEffect(() => {
    const svg = motionRef.current;
    if (!svg) return;
    svg.pauseAnimations();
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()));
    io.observe(svg);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative flex h-full flex-col justify-between gap-6 p-7 md:p-8">
      <div className="relative">
        <svg viewBox="0 0 440 150" className="h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id="ship-g" x1="0" x2="1">
              <stop offset="0" stopColor="#ff1408" />
              <stop offset="1" stopColor="#ff7a00" />
            </linearGradient>
          </defs>
          {Array.from({ length: 9 }).map((_, r) =>
            Array.from({ length: 22 }).map((__, c) => (
              <circle key={`${r}-${c}`} cx={10 + c * 20} cy={10 + r * 16} r="1.1" fill="#fff" opacity={((r * 7 + c * 3) % 5 === 0 ? 0.22 : 0.07).toString()} />
            )),
          )}
          <path d={route} fill="none" stroke="url(#ship-g)" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.8" />
          <circle cx="60" cy="120" r="5" fill="#ff1408" />
          <circle cx="380" cy="96" r="5" fill="#ff7a00" />
          <text x="44" y="146" fontFamily="var(--font-geist-mono), monospace" fontSize="10" letterSpacing="2" fill="#fff" opacity="0.5">LAB</text>
          <text x="364" y="122" fontFamily="var(--font-geist-mono), monospace" fontSize="10" letterSpacing="2" fill="#fff" opacity="0.5">YOU</text>
        </svg>
        {/* The moving parts get their own SVG on top, so each frame redraws two shapes instead of the 200-dot map.
            Neither overlaps anything it is now drawn above. */}
        <svg ref={motionRef} viewBox="0 0 440 150" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="60" cy="120" r="12" fill="none" stroke="#ff1408" opacity="0.5">
            <animate attributeName="r" values="5;16;5" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r="4.5" fill="#fff">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={route} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </circle>
        </svg>
      </div>
      <CellText title="Shipped fast, worldwide">Most orders leave the lab within one business day, with tracking from door to door.</CellText>
    </div>
  );
}

function ChatCell() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const msgs = [
    { me: true, text: "Card just arrived 🔥 where do I start?" },
    { me: false, text: "Welcome! Grab the quick-start in #setup — I'll stay here with you." },
    { me: true, text: "Done. All green on first boot 👌" },
  ];
  return (
    <div ref={ref} className="relative flex h-full flex-col justify-between gap-6 p-7 md:p-8">
      <div className="flex flex-col gap-2.5">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
              m.me ? "self-end rounded-br-md bg-brand text-white" : "self-start rounded-bl-md border border-line-strong bg-ink-800 text-fg/90",
            )}
            initial={{ opacity: 0, transform: "translateY(16px) scale(0.96)" }}
            animate={inView ? { opacity: 1, transform: "translateY(0px) scale(1)", transitionEnd: { transform: "none" } } : {}}
            transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.2 + i * 0.7, ...(reduce && { transform: { type: false } }) }}
          >
            {m.text}
          </motion.div>
        ))}
      </div>
      <CellText title="24/7 support">Setup help, order updates or just a second opinion, any time of day or night on Discord.</CellText>
    </div>
  );
}

function SecureCell() {
  return (
    <div className="relative flex h-full flex-col justify-between gap-6 p-7 md:p-8">
      <div className="relative grid h-28 place-items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute size-16 rounded-full border border-blaze/40"
            style={{ animation: `ping-ring 2.8s ${i * 0.9}s cubic-bezier(0.16,1,0.3,1) infinite` }}
          />
        ))}
        <span className="relative grid size-16 place-items-center rounded-2xl bg-brand shadow-[0_10px_40px_-6px_rgb(255_61_0/0.7)]">
          <Lock className="size-7 text-white" />
        </span>
      </div>
      <CellText title="Secure checkout">Card, PayPal, Apple Pay or crypto — encrypted end to end.</CellText>
    </div>
  );
}

function TerminalCell() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const lines = [
    { t: "$ tracecore status", c: "text-fg" },
    { t: "› device ........ detected", c: "text-muted" },
    { t: "› link .......... usb-c 3.0 · 5 Gbps", c: "text-muted" },
    { t: "› temperature ... 41°C", c: "text-muted" },
    { t: "› self-test ..... passed ✓", c: "text-amber" },
  ];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= lines.length) window.clearInterval(id);
    }, 520);
    return () => window.clearInterval(id);
  }, [inView, lines.length]);

  return (
    <div ref={ref} className="relative grid h-full gap-6 p-7 md:grid-cols-2 md:p-8">
      <div className="rounded-2xl border border-line bg-ink-950/80 p-4 font-mono text-[12.5px] leading-7">
        <div className="mb-2 flex gap-1.5">
          <span className="size-2.5 rounded-full bg-ember/80" />
          <span className="size-2.5 rounded-full bg-blaze/70" />
          <span className="size-2.5 rounded-full bg-white/20" />
        </div>
        {lines.map((l, i) => (
          <div key={i} className={cn(l.c, "transition-opacity duration-300", i < shown ? "opacity-100" : "opacity-0")}>
            {l.t}
          </div>
        ))}
        <span className="inline-block h-4 w-2 translate-y-0.5 animate-caret bg-blaze" />
      </div>
      <CellText title="Guides & updates" className="self-end">
        Step-by-step setup guides, a quick-start card in every box and free updates for the life of your hardware.
      </CellText>
    </div>
  );
}
