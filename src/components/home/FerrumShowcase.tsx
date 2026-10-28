"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { EASE_EXPO } from "@/components/ui/motion";
import { formatPrice } from "@/lib/utils";

const loadScene = () => import("./FerrumScene");
const FerrumScene = dynamic(loadScene, { ssr: false, loading: () => null });

/** 3D Ferrum floating at the bottom-right of the hero, linking to its product page. Desktop only. */
export function FerrumShowcase({ play, price }: { play: boolean; price: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const hover = useRef(false);
  const [use3d, setUse3d] = useState<boolean | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    const capable = webgl && window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check after mount
    setUse3d(capable);
    if (capable) loadScene();

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => {
      io.disconnect();
      setActive(false); // route hidden by Activity: stop the render loop
    };
  }, []);

  return (
    <Link
      ref={ref}
      href="/product/ferrum"
      aria-label={`Ferrum precision input device, ${formatPrice(price)}`}
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
      className="group absolute -bottom-[5%] -right-[3%] z-20 hidden aspect-[16/11] w-[50%] lg:block xl:w-[58%]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.24),transparent_70%)] opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] left-1/2 h-[9%] w-[56%] -translate-x-1/2 rounded-[50%] bg-black/80 blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: play ? 1 : 0 }}
        transition={{ duration: 1, delay: 0.9 }}
      />

      {use3d && play && <FerrumScene play={play} active={active} hover={hover} />}
      {use3d === false && (
        <span className="absolute inset-[12%] rotate-[-8deg] overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]">
          <Image src="/products/ferrum-thumb.webp" alt="" fill sizes="280px" className="object-cover" />
        </span>
      )}

      <motion.span
        className="absolute -bottom-[3%] right-[9%] flex items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-ink-900/70 py-1 pl-1 pr-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg/85 backdrop-blur transition-colors duration-300 group-hover:border-blaze/60"
        initial={{ opacity: 0, y: 10 }}
        animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.8, ease: EASE_EXPO, delay: 1.35 }}
      >
        <span className="rounded-full bg-brand px-2 py-0.5 text-[9.5px] font-semibold text-white">New</span>
        Ferrum · {formatPrice(price)}
        <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </motion.span>
    </Link>
  );
}
