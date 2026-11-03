// Checks the pixel clock calculator (src/components/tools/PixelClockCalculator.tsx) against the reference values
// in the SEO guides reference (table 7.8, CVT reduced blanking v2). Run: npx tsx scripts/self-check-pixel-clock.ts

import assert from "node:assert/strict";
import { dataRateBps, LINKS, pixelClockHz } from "../src/components/tools/PixelClockCalculator";

const within1pct = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) / expected <= 0.01, `${what}: got ${actual.toFixed(2)}, expected ${expected} (within 1%)`);

const fits = (gbps: number) => LINKS.filter((l) => gbps <= l.data).map((l) => l.name);

// [width, height, refresh, pixel clock MHz, 8-bit Gbit/s, links that carry it uncompressed]
const CASES: [number, number, number, number, number, string[]][] = [
  [3840, 2160, 120, 1075.8, 25.82, ["DisplayPort 1.4 (HBR3)", "HDMI 2.1 (FRL 48G)"]],
  [3840, 2160, 144, 1306.2, 31.35, ["HDMI 2.1 (FRL 48G)"]],
  [1920, 1080, 240, 583.2, 14.0, ["HDMI 2.0", "DisplayPort 1.4 (HBR3)", "HDMI 2.1 (FRL 48G)"]],
  [2560, 1440, 240, 1025.8, 24.62, ["DisplayPort 1.4 (HBR3)", "HDMI 2.1 (FRL 48G)"]],
];

for (const [w, h, hz, mhz, gbps, links] of CASES) {
  const clock = pixelClockHz(w, h, hz);
  const rate = dataRateBps(clock, 8) / 1e9;
  within1pct(clock / 1e6, mhz, `${w}x${h}@${hz} pixel clock MHz`);
  within1pct(rate, gbps, `${w}x${h}@${hz} 8-bit Gbit/s`);
  assert.deepEqual(fits(rate), links, `${w}x${h}@${hz} links`);
}

// 10-bit colour is 1.25 times the 8-bit data rate.
const c = pixelClockHz(3840, 2160, 120);
within1pct(dataRateBps(c, 10), dataRateBps(c, 8) * 1.25, "10-bit data rate");

console.log(`pixel clock self-check passed (${CASES.length} modes)`);
