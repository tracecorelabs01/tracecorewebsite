"use client";

import Image from "next/image";
import { useId, type CSSProperties } from "react";
import type { ArtKey } from "@/lib/catalog/types";
import { MARK_PATHS, MARK_VIEWBOX } from "@/components/brand/Logo";
import { cn, seeded } from "@/lib/utils";

/**
 * Stylised, animated product renders drawn in SVG. They stand in until real
 * product photography is added (set `visual: { kind: "image", ... }` in data).
 * Glowing pulses run along the copper traces — the "trace" in TraceCore.
 */
export function ProductArt({ art, className, animated = true, eager }: { art: ArtKey; className?: string; animated?: boolean; eager?: boolean }) {
  switch (art) {
    case "dma-35t":
      return <DmaCard className={className} animated={animated} model="35T" fpga="XC7A35T" width={330} chip={92} />;
    case "dma-75t":
      return <DmaCard className={className} animated={animated} model="75T" fpga="XC7A75T" width={392} chip={108} />;
    case "dma-100t":
      return <DmaCard className={className} animated={animated} model="100T" fpga="XC7A100T" width={430} chip={116} heatsink />;
    case "cable":
      return <CableArt className={className} animated={animated} />;
    case "riser":
      return <RiserArt className={className} animated={animated} />;
    case "thermal":
      return <ThermalArt className={className} />;
    case "bundle":
      return <BundleArt className={className} animated={animated} eager={eager} />;
    case "placeholder":
      return <PlaceholderArt className={className} />;
  }
}

function useUid(p: string) {
  return `${p}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function SharedDefs({ id }: { id: string }) {
  return (
    <>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ff4a12" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#ff2a0a" stopOpacity="0.16" />
        <stop offset="1" stopColor="#ff1408" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-brand`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#ff1010" />
        <stop offset="0.5" stopColor="#ff3a00" />
        <stop offset="1" stopColor="#ff7a00" />
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#7d7f83" />
        <stop offset="0.35" stopColor="#e9eaec" />
        <stop offset="0.7" stopColor="#a5a7ab" />
        <stop offset="1" stopColor="#6f7175" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffd98a" />
        <stop offset="0.5" stopColor="#d9a441" />
        <stop offset="1" stopColor="#8a6420" />
      </linearGradient>
      <linearGradient id={`${id}-pcb`} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#24181a" />
        <stop offset="0.55" stopColor="#140d0f" />
        <stop offset="1" stopColor="#0c0708" />
      </linearGradient>
      <linearGradient id={`${id}-chip`} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#2a2324" />
        <stop offset="1" stopColor="#0f0b0c" />
      </linearGradient>
      <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.7" fill="#ffffff" fillOpacity="0.06" />
      </pattern>
      <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <filter id={`${id}-neon`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </>
  );
}

function Trace({ d, id, animated, delay = 0, duration = 3.4 }: { d: string; id: string; animated: boolean; delay?: number; duration?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke="#ff5a2a" strokeOpacity="0.16" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {animated && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${id}-brand)`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="16 384"
          filter={`url(#${id}-neon)`}
          className="animate-trace"
          style={{ animationDelay: `${delay}s`, ["--trace-duration" as string]: `${duration}s` } as CSSProperties}
        />
      )}
    </>
  );
}

function DmaCard({
  className,
  animated,
  model,
  fpga,
  width: W,
  chip: C,
  heatsink = false,
}: {
  className?: string;
  animated: boolean;
  model: string;
  fpga: string;
  width: number;
  chip: number;
  heatsink?: boolean;
}) {
  const id = useUid("dma");
  const H = 200;
  const tx = (640 - W) / 2 + 14;
  const cx = W * 0.6;
  const cy = H / 2 - 4;
  const chipX = cx - C / 2;
  const chipY = cy - C / 2;
  const tabX = W * 0.26;
  const tabW = W * 0.5;
  const fingers = Math.floor((tabW - 12) / 7.2);
  const rand = seeded(W);
  const caps = Array.from({ length: 16 }, () => ({
    x: 18 + rand() * (W - 40),
    y: 150 + rand() * 34,
    r: rand() > 0.5,
  })).filter((c) => c.x < chipX - 12 || c.x > chipX + C + 12);

  const fingerX = (i: number) => tabX + 7 + i * 7.2;
  const traces = [
    `M ${chipX + C * 0.2} ${chipY + C} V ${H - 22} L ${fingerX(3)} ${H + 2}`,
    `M ${chipX + C * 0.4} ${chipY + C} V ${H - 30} L ${fingerX(9) + 2} ${H - 12} V ${H + 2}`,
    `M ${chipX + C * 0.62} ${chipY + C} V ${H - 26} L ${fingerX(14)} ${H - 10} V ${H + 2}`,
    `M ${chipX + C * 0.84} ${chipY + C} V ${H - 34} L ${fingerX(Math.min(fingers - 3, 20))} ${H - 14} V ${H + 2}`,
    `M ${chipX} ${chipY + C * 0.3} H ${104} L ${92} ${60}`,
    `M ${chipX} ${chipY + C * 0.5} H ${116} L ${100} ${74} H ${92}`,
    `M ${chipX} ${chipY + C * 0.72} H ${84} L ${72} ${128}`,
    `M ${28} ${58} H ${-6} L ${-14} ${86}`,
    `M ${chipX + C} ${chipY + C * 0.35} H ${W - 46} L ${W - 30} ${32}`,
    `M ${chipX + C * 0.5} ${chipY} V ${22} H ${W - 92}`,
  ];

  return (
    <svg viewBox="0 0 640 440" className={cn("h-full w-full overflow-visible", className)} aria-hidden>
      <defs>
        <SharedDefs id={id} />
        <linearGradient id={`${id}-fin`} x1="0" x2="1">
          <stop offset="0" stopColor="#3b3537" />
          <stop offset="0.5" stopColor="#8d8a8c" />
          <stop offset="1" stopColor="#2e292b" />
        </linearGradient>
      </defs>

      <ellipse cx="320" cy="214" rx="300" ry="190" fill={`url(#${id}-glow)`} />
      <ellipse cx={tx + W / 2} cy={352} rx={W * 0.56} ry="18" fill="#000" opacity="0.7" filter={`url(#${id}-blur)`} />

      <g transform={`translate(${tx} 104)`}>
        {/* bracket */}
        <rect x="-44" y="-50" width="50" height="13" rx="2.5" fill={`url(#${id}-silver)`} />
        <rect x="-34" y="-40" width="22" height="292" rx="3" fill={`url(#${id}-silver)`} />
        <rect x="-29" y="64" width="12" height="32" rx="6" fill="#050304" stroke="#3a3436" />
        <rect x="-26.5" y="72" width="7" height="16" rx="2" fill="#ff5a1f" opacity="0.85" />
        <circle cx="-23" cy="118" r="3.2" fill="#ff5a1f" className={animated ? "animate-blink" : undefined} />
        <circle cx="-23" cy="132" r="3.2" fill="#ff1408" />
        <rect x="-31" y="160" width="16" height="48" rx="2" fill="#000" opacity="0.35" />

        {/* board + pcie tab */}
        <rect x={tabX} y={H - 8} width={tabW} height="38" rx="3" fill={`url(#${id}-pcb)`} />
        <rect x="0" y="0" width={W} height={H} rx="12" fill={`url(#${id}-pcb)`} stroke="#ffffff" strokeOpacity="0.09" />
        <rect x="0" y="0" width={W} height={H} rx="12" fill={`url(#${id}-dots)`} />
        <rect x="1" y="1" width={W - 2} height="40" rx="11" fill="#ffffff" opacity="0.025" />

        {Array.from({ length: fingers }).map((_, i) =>
          i === 5 ? null : <rect key={i} x={fingerX(i)} y={H + 4} width="4.6" height="22" rx="1" fill={`url(#${id}-gold)`} />,
        )}

        {traces.map((d, i) => (
          <Trace key={i} d={d} id={id} animated={animated} delay={i * 0.37} duration={2.8 + (i % 3) * 0.6} />
        ))}

        {/* components */}
        <rect x="28" y="40" width="62" height="44" rx="4" fill={`url(#${id}-chip)`} stroke="#fff" strokeOpacity="0.08" />
        <text x="59" y="66" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="9" fill="#fff" fillOpacity="0.45">FT601</text>
        <rect x="28" y="112" width="44" height="30" rx="3" fill={`url(#${id}-chip)`} stroke="#fff" strokeOpacity="0.07" />
        <text x="50" y="131" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="8" fill="#fff" fillOpacity="0.4">SPI</text>
        <rect x="96" y="124" width="20" height="12" rx="2" fill={`url(#${id}-silver)`} opacity="0.85" />
        {caps.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y})${c.r ? " rotate(90)" : ""}`}>
            <rect width="8" height="4" rx="0.8" fill="#3a2a24" />
            <rect width="2" height="4" fill="#c9a25a" opacity="0.8" />
            <rect x="6" width="2" height="4" fill="#c9a25a" opacity="0.8" />
          </g>
        ))}

        {/* fpga */}
        <rect x={chipX - 18} y={chipY - 18} width={C + 36} height={C + 36} rx="18" fill={`url(#${id}-glow)`} opacity="0.9" />
        <rect x={chipX} y={chipY} width={C} height={C} rx="9" fill={`url(#${id}-chip)`} stroke="#fff" strokeOpacity="0.13" />
        <rect x={chipX + 12} y={chipY + 12} width={C - 24} height={C - 24} rx="5" fill="#0b0809" stroke="#ff5a1f" strokeOpacity="0.25" />
        <svg x={chipX + C / 2 - 17} y={chipY + C / 2 - 26} width="34" height="26" viewBox={MARK_VIEWBOX}>
          <path d={MARK_PATHS.wing} fill={`url(#${id}-brand)`} />
          <path d={MARK_PATHS.stem} fill={`url(#${id}-brand)`} />
          <path d={MARK_PATHS.plate} fill="#d9dadc" />
        </svg>
        <text x={cx} y={chipY + C / 2 + 16} textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="8.5" letterSpacing="1" fill="#fff" fillOpacity="0.55">{fpga}</text>
        <text x={cx} y={chipY + C / 2 + 27} textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="6.5" letterSpacing="1.4" fill="#fff" fillOpacity="0.28">TRACECORE</text>

        {heatsink && (
          <g>
            <rect x={chipX - 12} y={chipY - 12} width={C + 24} height={C + 24} rx="8" fill="#1b1617" stroke="#fff" strokeOpacity="0.12" />
            {Array.from({ length: 11 }).map((_, i) => (
              <rect key={i} x={chipX - 6 + i * ((C + 12) / 10.6)} y={chipY - 8} width="5" height={C + 16} rx="1.5" fill={`url(#${id}-fin)`} />
            ))}
            <rect x={cx - 26} y={chipY + C / 2 - 10} width="52" height="20" rx="3" fill="#0b0809" stroke="#ff5a1f" strokeOpacity="0.5" />
            <text x={cx} y={chipY + C / 2 + 4} textAnchor="middle" fontFamily="var(--font-anton), Impact, sans-serif" fontSize="13" letterSpacing="1.5" fill={`url(#${id}-brand)`}>PRO</text>
          </g>
        )}

        {/* silkscreen */}
        <text x="16" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="9" letterSpacing="1.6" fill="#fff" fillOpacity="0.32">TRACECORE LAB</text>
        <text x={W - 16} y={H - 14} textAnchor="end" fontFamily="var(--font-anton), Impact, sans-serif" fontSize="44" fill={`url(#${id}-brand)`}>{model}</text>
        <text x={W - 18} y={H - 62} textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="7" letterSpacing="1.2" fill="#fff" fillOpacity="0.28">REV 2.1</text>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={W - 70 + i * 11}
            y="14"
            width="6"
            height="4"
            rx="1"
            fill={i === 2 ? "#ff1408" : "#ff6a00"}
            className={animated ? "animate-blink" : undefined}
            style={{ animationDelay: `${i * 0.45}s` }}
            filter={`url(#${id}-neon)`}
          />
        ))}
        {[
          [14, H - 14],
          [W - 14, 34],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="#070405" stroke={`url(#${id}-silver)`} strokeWidth="1.6" />
        ))}
      </g>
    </svg>
  );
}

function Connector({ id, x, y, rotate }: { id: string; x: number; y: number; rotate: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-12" y="-11" width="22" height="22" rx="5" fill="#1a1314" />
      <rect x="8" y="-13" width="50" height="26" rx="7" fill={`url(#${id}-silver)`} />
      <rect x="56" y="-7" width="22" height="14" rx="6" fill="#d7d8da" />
      <rect x="60" y="-3" width="15" height="6" rx="2" fill="#0a0708" />
      <rect x="62" y="-1.5" width="10" height="3" rx="1" fill="#ff6a00" />
    </g>
  );
}

function CableArt({ className, animated }: { className?: string; animated: boolean }) {
  const id = useUid("cbl");
  const d = "M 128 300 C 60 210, 150 96, 290 112 S 540 220, 486 300 S 300 372, 262 270 S 380 150, 470 176 S 560 140, 548 100";
  return (
    <svg viewBox="0 0 640 440" className={cn("h-full w-full overflow-visible", className)} aria-hidden>
      <defs>
        <SharedDefs id={id} />
      </defs>
      <ellipse cx="320" cy="220" rx="290" ry="180" fill={`url(#${id}-glow)`} />
      <ellipse cx="320" cy="372" rx="230" ry="16" fill="#000" opacity="0.6" filter={`url(#${id}-blur)`} />
      <path d={d} fill="none" stroke="#120c0d" strokeWidth="17" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#2c2122" strokeWidth="13" strokeLinecap="round" strokeDasharray="2.5 3.5" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="3" strokeLinecap="round" transform="translate(-2 -3)" />
      {animated && (
        <path d={d} fill="none" stroke={`url(#${id}-brand)`} strokeWidth="4" strokeLinecap="round" strokeDasharray="30 370" filter={`url(#${id}-neon)`} className="animate-trace" />
      )}
      <Connector id={id} x={128} y={300} rotate={124} />
      <Connector id={id} x={548} y={100} rotate={-78} />
    </svg>
  );
}

function RiserArt({ className, animated }: { className?: string; animated: boolean }) {
  const id = useUid("rsr");
  const ribbon = "M 196 250 C 250 250, 260 150, 340 150 S 430 250, 470 250";
  return (
    <svg viewBox="0 0 640 440" className={cn("h-full w-full overflow-visible", className)} aria-hidden>
      <defs>
        <SharedDefs id={id} />
        <linearGradient id={`${id}-flex`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a2416" />
          <stop offset="1" stopColor="#1c110b" />
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="220" rx="290" ry="180" fill={`url(#${id}-glow)`} />
      <ellipse cx="320" cy="350" rx="250" ry="16" fill="#000" opacity="0.6" filter={`url(#${id}-blur)`} />
      {/* ribbon */}
      <path d={ribbon} fill="none" stroke={`url(#${id}-flex)`} strokeWidth="46" />
      {[-16, -8, 0, 8, 16].map((o) => (
        <path key={o} d={ribbon} fill="none" stroke="#c9a25a" strokeOpacity="0.28" strokeWidth="1.2" transform={`translate(0 ${o})`} />
      ))}
      {animated && <path d={ribbon} fill="none" stroke={`url(#${id}-brand)`} strokeWidth="3" strokeDasharray="24 376" filter={`url(#${id}-neon)`} className="animate-trace" />}
      {/* riser board with slot */}
      <g transform="translate(76 206)">
        <rect width="132" height="96" rx="8" fill={`url(#${id}-pcb)`} stroke="#fff" strokeOpacity="0.09" />
        <rect width="132" height="96" rx="8" fill={`url(#${id}-dots)`} />
        <rect x="16" y="22" width="100" height="22" rx="3" fill="#060404" stroke="#fff" strokeOpacity="0.12" />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={22 + i * 7.6} y="29" width="3.4" height="8" rx="0.6" fill={`url(#${id}-gold)`} />
        ))}
        <text x="16" y="74" fontFamily="var(--font-geist-mono), monospace" fontSize="8" letterSpacing="1.4" fill="#fff" fillOpacity="0.35">PCIe x1 · TC-R1</text>
        <circle cx="116" cy="74" r="3.5" fill="#ff5a1f" className={animated ? "animate-blink" : undefined} />
      </g>
      {/* male connector */}
      <g transform="translate(456 214)">
        <rect width="110" height="72" rx="7" fill={`url(#${id}-pcb)`} stroke="#fff" strokeOpacity="0.09" />
        <rect x="22" y="68" width="66" height="22" rx="2" fill={`url(#${id}-pcb)`} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={27 + i * 7.4} y="72" width="4.4" height="16" rx="0.8" fill={`url(#${id}-gold)`} />
        ))}
        <text x="14" y="26" fontFamily="var(--font-anton), Impact, sans-serif" fontSize="18" fill={`url(#${id}-brand)`}>x1</text>
      </g>
    </svg>
  );
}

function ThermalArt({ className }: { className?: string }) {
  const id = useUid("thm");
  return (
    <svg viewBox="0 0 640 440" className={cn("h-full w-full overflow-visible", className)} aria-hidden>
      <defs>
        <SharedDefs id={id} />
        <linearGradient id={`${id}-alu`} x1="0" x2="1">
          <stop offset="0" stopColor="#2b2527" />
          <stop offset="0.45" stopColor="#9b979a" />
          <stop offset="0.6" stopColor="#5d585b" />
          <stop offset="1" stopColor="#272123" />
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="220" rx="290" ry="180" fill={`url(#${id}-glow)`} />
      <ellipse cx="320" cy="350" rx="220" ry="16" fill="#000" opacity="0.6" filter={`url(#${id}-blur)`} />
      {/* thermal pads */}
      <rect x="148" y="250" width="120" height="78" rx="8" fill="#ff5a1f" opacity="0.32" transform="rotate(-10 208 289)" />
      <rect x="166" y="242" width="120" height="78" rx="8" fill="#ff7a2a" opacity="0.45" stroke="#ffb27a" strokeOpacity="0.5" transform="rotate(-4 226 281)" />
      {/* heatsink */}
      <g transform="translate(276 120)">
        <rect y="150" width="240" height="40" rx="6" fill={`url(#${id}-alu)`} />
        {Array.from({ length: 13 }).map((_, i) => (
          <rect key={i} x={6 + i * 18} y={12 + (i % 2) * 6} width="10" height={142 - (i % 2) * 6} rx="2.5" fill={`url(#${id}-alu)`} />
        ))}
        <rect y="150" width="240" height="4" fill="#fff" opacity="0.18" />
        <rect x="-14" y="166" width="268" height="8" rx="4" fill={`url(#${id}-brand)`} opacity="0.9" />
      </g>
    </svg>
  );
}

function BundleArt({ className, animated, eager }: { className?: string; animated: boolean; eager?: boolean }) {
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden>
      <div className="absolute inset-x-[6%] top-[4%] h-[78%] -rotate-3">
        <ProductArt art="dma-75t" animated={animated} />
      </div>
      <div className="absolute bottom-[8%] right-[6%] w-[38%] rotate-[8deg] overflow-hidden rounded-xl border border-white/10 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]">
        <div className="relative aspect-square">
          <Image src="/products/ferrum-thumb.webp" alt="" fill sizes="240px" loading={eager ? "eager" : undefined} className="object-cover" />
        </div>
      </div>
      <div className="absolute bottom-[4%] left-[2%] w-[42%] opacity-90">
        <div className="aspect-[640/440]">
          <ProductArt art="cable" animated={animated} />
        </div>
      </div>
    </div>
  );
}

/** Shown for products that have no photo and no render assigned yet. */
function PlaceholderArt({ className }: { className?: string }) {
  const id = useUid("ph");
  return (
    <svg viewBox="0 0 640 440" className={cn("h-full w-full overflow-visible", className)} aria-hidden>
      <defs>
        <SharedDefs id={id} />
      </defs>
      <ellipse cx="320" cy="220" rx="260" ry="170" fill={`url(#${id}-glow)`} />
      <rect x="200" y="110" width="240" height="200" rx="28" fill={`url(#${id}-pcb)`} stroke="#fff" strokeOpacity="0.1" />
      <svg x="270" y="150" width="100" height="76" viewBox={MARK_VIEWBOX}>
        <path d={MARK_PATHS.wing} fill={`url(#${id}-brand)`} />
        <path d={MARK_PATHS.stem} fill={`url(#${id}-brand)`} />
        <path d={MARK_PATHS.plate} fill="#d9dadc" />
      </svg>
      <text x="320" y="272" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="11" letterSpacing="3" fill="#fff" fillOpacity="0.4">
        IMAGE SOON
      </text>
    </svg>
  );
}
