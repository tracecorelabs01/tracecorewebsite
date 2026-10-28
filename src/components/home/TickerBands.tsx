"use client";

import { LogoMark } from "@/components/brand/Logo";
import { VelocityMarquee } from "@/components/ui/Marquee";

const words = ["DMA Hardware", "Input Devices", "Lab Tested", "Worldwide Shipping", "24/7 Discord Support", "Secure Checkout"];

/** Two marquee bands crossing in an X; speed follows scroll velocity. */
export function TickerBands() {
  return (
    <section aria-label="Highlights" className="relative z-10 overflow-hidden py-20 md:py-24">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[2.6deg] scale-x-110 border-y border-line bg-ink-850 py-4">
        <VelocityMarquee baseVelocity={2.4}>
          {words.map((w) => (
            <span key={w} className="flex items-center gap-8 pr-8 font-display text-4xl uppercase text-outline md:text-5xl">
              {w}
              <span aria-hidden className="text-2xl text-white/20">✦</span>
            </span>
          ))}
        </VelocityMarquee>
      </div>
      <div className="relative -rotate-[2.6deg] scale-x-110 bg-brand py-4 shadow-[0_24px_80px_-20px_rgb(255_40_0/0.65)]">
        <VelocityMarquee baseVelocity={-2.4}>
          {words.map((w) => (
            <span key={w} className="flex items-center gap-8 pr-8 font-display text-4xl uppercase text-ink-950 md:text-5xl">
              {w}
              <LogoMark mono className="h-7 text-ink-950/85" title="" />
            </span>
          ))}
        </VelocityMarquee>
      </div>
    </section>
  );
}
