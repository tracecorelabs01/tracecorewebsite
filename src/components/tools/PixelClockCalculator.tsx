"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Pixel clock and data rate for a video mode, using VESA CVT reduced blanking v2 timings (what most high refresh
// monitors use), and which links carry it without compression. Real monitors publish their own timings in EDID,
// so the results are close estimates. Self-check: npx tsx scripts/self-check-pixel-clock.ts

/** CVT-RBv2: a fixed 80-pixel horizontal blank, and a vertical blank of at least 460 microseconds and 15 lines. */
const H_BLANK_PX = 80;
const MIN_V_BLANK_S = 460e-6;
const MIN_V_BLANK_LINES = 15;

/** Pixel clock in Hz for an active width x height at `refresh` Hz. */
export function pixelClockHz(width: number, height: number, refresh: number): number {
  const lineTime = (1 / refresh - MIN_V_BLANK_S) / height;
  const vBlankLines = Math.max(Math.ceil(MIN_V_BLANK_S / lineTime), MIN_V_BLANK_LINES);
  return (width + H_BLANK_PX) * (height + vBlankLines) * refresh;
}

/** Uncompressed RGB (4:4:4) data rate in bit/s. */
export const dataRateBps = (pixelClock: number, bitsPerColour: 8 | 10) => pixelClock * bitsPerColour * 3;

/** Video data each link carries after line coding, in Gbit/s. */
export const LINKS = [
  { name: "HDMI 2.0", signal: "18 Gbit/s TMDS", data: 14.4 },
  { name: "DisplayPort 1.4 (HBR3)", signal: "32.4 Gbit/s", data: 25.92 },
  { name: "HDMI 2.1 (FRL 48G)", signal: "48 Gbit/s FRL", data: 42.67 },
] as const;

const PRESETS = [
  { label: "1080p 240 Hz", width: 1920, height: 1080, refresh: 240 },
  { label: "1080p 360 Hz", width: 1920, height: 1080, refresh: 360 },
  { label: "1440p 240 Hz", width: 2560, height: 1440, refresh: 240 },
  { label: "4K 120 Hz", width: 3840, height: 2160, refresh: 120 },
  { label: "4K 144 Hz", width: 3840, height: 2160, refresh: 144 },
];

const LIMITS = { width: [320, 10240], height: [200, 4320], refresh: [24, 1000] } as const;
type Dimension = keyof typeof LIMITS;

const fieldClass =
  "h-12 w-full rounded-xl border border-line-strong bg-ink-950/80 px-4 font-mono text-base text-fg outline-none transition-colors focus:border-blaze aria-[invalid=true]:border-ember";

export function PixelClockCalculator() {
  const [mode, setMode] = useState<Record<Dimension, string>>({ width: "3840", height: "2160", refresh: "120" });
  const [bits, setBits] = useState<8 | 10>(8);

  const values = Object.fromEntries((Object.keys(LIMITS) as Dimension[]).map((k) => [k, Number(mode[k])])) as Record<Dimension, number>;
  const invalid = (k: Dimension) => !Number.isInteger(values[k]) || values[k] < LIMITS[k][0] || values[k] > LIMITS[k][1];
  const valid = !(Object.keys(LIMITS) as Dimension[]).some(invalid);
  const clock = valid ? pixelClockHz(values.width, values.height, values.refresh) : 0;
  const gbps = dataRateBps(clock, bits) / 1e9;

  const field = (k: Dimension, label: string, unit: string) => (
    <label className="block">
      <span className="type-kicker text-dim">{label}</span>
      <span className="relative mt-2 block">
        <input
          type="number"
          inputMode="numeric"
          min={LIMITS[k][0]}
          max={LIMITS[k][1]}
          step={1}
          value={mode[k]}
          onChange={(e) => setMode((m) => ({ ...m, [k]: e.target.value }))}
          aria-invalid={invalid(k)}
          className={cn(fieldClass, "pr-14")}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-dim">{unit}</span>
      </span>
      {invalid(k) && (
        <span className="mt-1 block text-xs text-[#ff6b5e]">
          {LIMITS[k][0]} to {LIMITS[k][1]}
        </span>
      )}
    </label>
  );

  return (
    <div className="rounded-3xl border border-line bg-ink-900/70 p-6 md:p-10">
      <div className="flex flex-wrap gap-2" aria-label="Common modes">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMode({ width: String(p.width), height: String(p.height), refresh: String(p.refresh) })}
            className="rounded-full border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-fg"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {field("width", "Width", "px")}
        {field("height", "Height", "px")}
        {field("refresh", "Refresh rate", "Hz")}
        <label className="block">
          <span className="type-kicker text-dim">Colour depth</span>
          <select value={bits} onChange={(e) => setBits(Number(e.target.value) === 10 ? 10 : 8)} className={cn(fieldClass, "mt-2")}>
            <option value={8}>8-bit RGB (24 bpp)</option>
            <option value={10}>10-bit RGB (30 bpp)</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-ink-950/70 p-6">
          <p className="type-kicker text-dim">Pixel clock (CVT-RBv2)</p>
          <p className="mt-3 font-display text-5xl tabular-nums">{valid ? `${(clock / 1e6).toFixed(1)} MHz` : "-"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-ink-950/70 p-6">
          <p className="type-kicker text-dim">Uncompressed data rate</p>
          <p className="mt-3 font-display text-5xl tabular-nums">{valid ? `${gbps.toFixed(2)} Gbit/s` : "-"}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <caption className="sr-only">Links that carry this mode without compression</caption>
          <thead>
            <tr>
              {["Link", "Signal rate", "Video data", "Uncompressed"].map((h) => (
                <th key={h} scope="col" className="border-b border-line bg-ink-900 px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINKS.map((l) => {
              const fits = valid && gbps <= l.data;
              return (
                <tr key={l.name} className="[&:last-child>td]:border-b-0">
                  <th scope="row" className="border-b border-line px-4 py-3 font-medium text-fg">
                    {l.name}
                  </th>
                  <td className="border-b border-line px-4 py-3 text-muted">{l.signal}</td>
                  <td className="border-b border-line px-4 py-3 text-muted">about {l.data} Gbit/s</td>
                  <td className="border-b border-line px-4 py-3">
                    {!valid ? (
                      "-"
                    ) : fits ? (
                      <span className="inline-flex items-center gap-1.5 text-ok">
                        <Check className="size-4" /> Fits ({Math.round((gbps / l.data) * 100)}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-warn">
                        <X className="size-4" /> Needs DSC or 4:2:x
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-dim">
        Estimates from CVT reduced blanking v2 timings. Your monitor&apos;s own timings (in its EDID) can be a little higher or lower, so a mode close to a limit may
        need tighter timings or compression. Modes listed by video fuser makers are vendor-listed, not tested by TraceCoreLab.
      </p>
    </div>
  );
}
