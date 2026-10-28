"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Kicker } from "@/components/ui/bits";
import { EASE_EXPO, RevealLines } from "@/components/ui/motion";
import { useUi } from "@/lib/ui-store";

export function PageHero({
  kicker,
  lines,
  description,
  crumbs = [],
  children,
}: {
  kicker: string;
  lines: ReactNode[];
  description?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  children?: ReactNode;
}) {
  const play = useUi((s) => s.introDone);
  return (
    <section className="relative isolate overflow-hidden pb-14 pt-[150px] md:pb-20 md:pt-[190px]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_70%)]" />
        <div className="absolute -top-1/3 right-0 size-[60vw] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.18),transparent_62%)]" />
        <div className="absolute right-[8%] top-[20%] h-[70%] w-[22%] skew-x-[-30deg] rounded-[28px] bg-gradient-to-b from-white/[0.035] to-transparent" />
        <div className="absolute right-[-6%] top-[40%] h-[70%] w-[22%] skew-x-[-30deg] rounded-[28px] bg-gradient-to-b from-[#ff3d00]/[0.07] to-transparent" />
      </div>
      <div className="container-x relative">
        {crumbs.length > 0 && (
          <motion.nav
            aria-label="Breadcrumb"
            className="mb-8 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: play ? 1 : 0 }}
            transition={{ duration: 0.8 }}
          >
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-blaze">/</span>}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-fg">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-muted">{c.label}</span>
                )}
              </span>
            ))}
          </motion.nav>
        )}
        <Kicker>{kicker}</Kicker>
        <RevealLines as="h1" play={play} className="type-h1 mt-5" lines={lines} />
        {description && (
          <motion.p
            className="mt-6 max-w-xl text-lg text-muted"
            initial={{ opacity: 0, y: 20 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: EASE_EXPO, delay: 0.3 }}
          >
            {description}
          </motion.p>
        )}
        {children}
      </div>
    </section>
  );
}
