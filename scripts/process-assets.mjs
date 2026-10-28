// One-off asset pipeline: copies brand files into /public and recolors the
// legacy (purple/cyan) Godlike media into the TraceCoreLab red→orange palette
// using a luminance gradient map. Re-run with `npm run assets`.
//
//   LEGACY_DIR  path to the old "godlike dma" project (default: ../godlike dma)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = path.join(ROOT, "brand");
const LEGACY = process.env.LEGACY_DIR ?? path.resolve(ROOT, "..", "godlike dma");
const PUBLIC = path.join(ROOT, "public");
const APP = path.join(ROOT, "src", "app");

// Brand gradient map: shadows → deep ember, mids → brand red, highlights → orange → warm white.
const STOPS = [
  [0.0, "#050203"],
  [0.1, "#120405"],
  [0.26, "#3d0706"],
  [0.44, "#a3120a"],
  [0.6, "#f2200b"],
  [0.74, "#ff4d0f"],
  [0.86, "#ff8424"],
  [0.95, "#ffc48a"],
  [1.0, "#fff6ee"],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const LUT = (() => {
  const lut = new Uint8Array(256 * 3);
  const stops = STOPS.map(([t, c]) => [t, hex(c)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const s = f * f * (3 - 2 * f); // smoothstep between stops
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = Math.round(c0[ch] + (c1[ch] - c0[ch]) * s);
  }
  return lut;
})();

async function gradientMap(input, output, { width, height, quality = 74, gamma = 0.92, fit = "cover", position = "centre" } = {}) {
  let img = sharp(input).removeAlpha();
  if (width || height) img = img.resize({ width, height, fit, position });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    // Rec.709 luma with a gentle gamma lift so neon edges glow without crushing shadows.
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const idx = Math.round(Math.pow(l, gamma) * 255) * 3;
    data[i] = LUT[idx];
    data[i + 1] = LUT[idx + 1];
    data[i + 2] = LUT[idx + 2];
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality, effort: 5 })
    .toFile(output);
}

async function ensure(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function brandAssets() {
  const out = path.join(PUBLIC, "brand");
  await ensure(out);
  await fs.copyFile(path.join(BRAND, "logo.svg"), path.join(out, "logo-mark.svg"));
  await sharp(path.join(BRAND, "logo.png")).resize({ width: 640 }).webp({ quality: 90 }).toFile(path.join(out, "logo-mark.webp"));
  await sharp(path.join(BRAND, "banner2.png")).resize({ width: 1600 }).webp({ quality: 82 }).toFile(path.join(out, "banner-gradient.webp"));
  await sharp(path.join(BRAND, "pfpbanner.png")).resize({ width: 1600 }).webp({ quality: 82 }).toFile(path.join(out, "banner-dark.webp"));

  // App icons + social card (picked up automatically by the App Router file conventions).
  await sharp(path.join(BRAND, "pfp2.png")).resize(512, 512).png().toFile(path.join(APP, "icon.png"));
  await sharp(path.join(BRAND, "pfp2.png")).resize(180, 180).png().toFile(path.join(APP, "apple-icon.png"));
  await sharp(path.join(BRAND, "banner.png")).resize(1200, 630, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(path.join(APP, "opengraph-image.png"));
  console.log("✓ brand assets");
}

async function productAssets() {
  const out = path.join(PUBLIC, "products");
  await ensure(out);
  const ferrum = path.join(BRAND, "ferrum.png");
  await sharp(ferrum).resize({ width: 1120 }).webp({ quality: 84 }).toFile(path.join(out, "ferrum-banner.webp"));
  // Square crop of the device itself (the wordmark sits on the right half of the banner).
  await sharp(ferrum).extract({ left: 0, top: 45, width: 540, height: 540 }).resize(900, 900).webp({ quality: 84 }).toFile(path.join(out, "ferrum.webp"));
  // Small copy used inside the bundle render.
  await sharp(ferrum).extract({ left: 0, top: 45, width: 540, height: 540 }).resize(480, 480).webp({ quality: 80 }).toFile(path.join(out, "ferrum-thumb.webp"));
  console.log("✓ product assets");
}

async function legacyMedia() {
  if (!(await exists(LEGACY))) {
    console.warn(`! legacy project not found at ${LEGACY} — skipping video/sequence`);
    return;
  }
  const media = path.join(PUBLIC, "media");
  await ensure(media);

  const render = path.join(LEGACY, "public/images/dma_card_render.png");
  if (await exists(render)) {
    await gradientMap(render, path.join(media, "lab-render.webp"), { width: 1080, height: 1080, quality: 80 });
  }

  const video = path.join(LEGACY, "public/videos/herovideo.mp4");
  if (await exists(video)) {
    await fs.copyFile(video, path.join(media, "operators.mp4"));
    // Poster frame via macOS Quick Look (no ffmpeg needed), then brand-mapped.
    const tmp = path.join(ROOT, ".asset-tmp");
    await ensure(tmp);
    try {
      execFileSync("qlmanage", ["-t", "-s", "1600", "-o", tmp, video], { stdio: "ignore" });
      const thumb = path.join(tmp, "herovideo.mp4.png");
      if (await exists(thumb)) {
        await gradientMap(thumb, path.join(media, "operators-poster.webp"), { width: 1600, quality: 72 });
      }
    } catch {
      console.warn("! could not create a video poster (qlmanage unavailable)");
    }
    await fs.rm(tmp, { recursive: true, force: true });
  }

  // Scroll-scrubbed "operator" reveal: every 2nd frame of the 160-frame sequence.
  const seqIn = path.join(LEGACY, "public/images/img-seq");
  if (await exists(seqIn)) {
    const seqOut = path.join(PUBLIC, "sequence");
    await fs.rm(seqOut, { recursive: true, force: true });
    await ensure(seqOut);
    const frames = (await fs.readdir(seqIn)).filter((f) => f.endsWith(".jpg")).sort();
    const picked = frames.filter((_, i) => i % 2 === 0);
    let n = 0;
    for (const f of picked) {
      n++;
      await gradientMap(path.join(seqIn, f), path.join(seqOut, `${String(n).padStart(3, "0")}.webp`), {
        width: 1280,
        height: 720,
        quality: 68,
      });
    }
    console.log(`✓ sequence (${n} frames)`);
  }
  console.log("✓ legacy media");
}

await brandAssets();
await productAssets();
await legacyMedia();
