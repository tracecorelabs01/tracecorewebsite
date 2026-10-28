"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

// The three pieces of the TC mark, straight from brand/logo.svg (viewBox 0 0 3850.96 2905.43).
export const MARK_VIEWBOX = "0 0 3850.96 2905.43";
export const MARK_PATHS = {
  wing: "M0,0l428.72,754.6c13,22.88,37.28,37.01,63.59,37.01h874.49c25.75,0,49.6-13.54,62.8-35.64L1814.97,110.64c29.11-48.75-6.01-110.64-62.8-110.64H0",
  stem: "M2056.67,0L757.4,2199.21c-14.46,24.47-13.43,55.09,2.63,78.54l365.13,533.02c30.23,44.13,96.05,41.94,123.29-4.09l1171.06-1979.16c13.16-22.25,37.1-35.9,62.95-35.9h939.33c26.64,0,51.18-14.49,64.05-37.82l355.93-645.33c26.89-48.75-8.38-108.46-64.05-108.46h-1721.05",
  plate: "M1359.08,2905.43l459.7-779.5c13.15-22.3,37.11-35.99,63-35.99h774.1c55.47,0,90.75,59.33,64.26,108.06l-363.68,669.2c-12.8,23.55-37.46,38.22-64.26,38.22h-933.13",
} as const;

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function MarkGradients({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-wing`} x1="198.66" y1="657.84" x2="1811.15" y2="-197.76" gradientUnits="userSpaceOnUse">
        <stop offset=".35" stopColor="#ff0000" />
        <stop offset="1" stopColor="#ff8100" />
      </linearGradient>
      <linearGradient id={`${id}-stem`} x1="18.46" y1="1421.28" x2="3122.18" y2="1421.28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ff0000" />
        <stop offset="1" stopColor="#ff6900" />
      </linearGradient>
      <linearGradient id={`${id}-plate`} x1="1359.08" y1="2497.69" x2="2729.13" y2="2497.69" gradientUnits="userSpaceOnUse">
        <stop offset=".21" stopColor="#bcbec0" />
        <stop offset="1" stopColor="#f1f2f2" />
      </linearGradient>
    </defs>
  );
}

export function LogoMark({ className, mono = false, title = "TraceCoreLab" }: { className?: string; mono?: boolean; title?: string }) {
  const id = useSvgId("tcm");
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("h-8 w-auto", className)} role="img" aria-label={title}>
      {!mono && <MarkGradients id={id} />}
      <path d={MARK_PATHS.wing} fill={mono ? "currentColor" : `url(#${id}-wing)`} />
      <path d={MARK_PATHS.stem} fill={mono ? "currentColor" : `url(#${id}-stem)`} />
      <path d={MARK_PATHS.plate} fill={mono ? "currentColor" : `url(#${id}-plate)`} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display uppercase leading-none tracking-[0.01em]", className)}>
      <span className="text-gradient">TraceCore</span>
      <span className="text-silver">Lab</span>
    </span>
  );
}

export function Logo({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className={cn("group flex items-center gap-2.5", className)} aria-label="TraceCoreLab home">
      <LogoMark className="h-7 transition-transform duration-500 ease-[var(--ease-expo)] group-hover:-rotate-6 group-hover:scale-110" title="" />
      <Wordmark className="text-[25px]" />
    </Link>
  );
}
