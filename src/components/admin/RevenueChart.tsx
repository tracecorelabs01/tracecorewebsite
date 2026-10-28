"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Single-series column chart: daily paid revenue. Bar colour #f25018 is the
// brand flame step validated for the dark surface (dataviz validator: PASS).
const BAR = "#f25018";
const BAR_HOVER = "#ff7a3d";
const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

const compact = (cents: number) => {
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K`;
  return `$${Math.round(v)}`;
};
const full = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/** Round the max up to a clean 1/2/2.5/5 × 10^n step so ticks read cleanly. */
function niceMax(max: number) {
  if (max <= 0) return 10000;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

export function RevenueChart({ data }: { data: { date: string; cents: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...data.map((d) => d.cents)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(24, band - 2);
  const y = (cents: number) => PAD.top + plotH - (cents / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const empty = data.every((d) => d.cents === 0);
  const active = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setTable((t) => !t)} className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-fg" aria-pressed={table}>
          {table ? "Show chart" : "Show table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900">
              <tr>
                <th className="px-3 py-2 text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.14em] text-dim">Date</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] font-normal uppercase tracking-[0.14em] text-dim">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line/70">
                  <td className="px-3 py-1.5 text-muted">{day(d.date, { month: "short", day: "numeric" })}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{full(d.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily paid revenue, last 30 days" onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(255 236 230 / 0.07)" strokeWidth="1" />
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-dim font-mono text-[10px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              const top = y(d.cents);
              const h = PAD.top + plotH - top;
              const r = Math.min(4, h / 2, barW / 2);
              return (
                <g key={d.date}>
                  {h > 0.5 && (
                    <path
                      d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                      fill={hover === i ? BAR_HOVER : BAR}
                    />
                  )}
                  {/* hit target: the whole column band, not just the painted bar */}
                  <rect
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={i === data.length - 1 ? 0 : -1}
                    aria-label={`${day(d.date, { month: "short", day: "numeric" })}: ${full(d.cents)}`}
                  />
                  {(i % 7 === 0 && i <= data.length - 5) || i === data.length - 1 ? (
                    <text x={PAD.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-dim font-mono text-[10px]">
                      {day(d.date, { month: "short", day: "numeric" })}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="rgb(255 236 230 / 0.16)" strokeWidth="1" />
          </svg>

          {active && hover != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-ink-950/95 px-3 py-2 shadow-xl"
              style={{ left: `${((PAD.left + hover * band + band / 2) / W) * 100}%` }}
            >
              <div className="text-sm font-semibold tabular-nums text-fg">{full(active.cents)}</div>
              <div className="text-[11px] text-muted">{day(active.date, { weekday: "short", month: "short", day: "numeric" })}</div>
            </div>
          )}

          {empty && <p className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted")}>No paid orders in the last 30 days yet.</p>}
        </div>
      )}
    </div>
  );
}
