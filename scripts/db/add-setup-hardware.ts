// Adds the setup hardware line (video fusers, input controllers, mini PC, Thunderbolt adapter) as
// DRAFTS with zero stock: add photos, set stock and publish each one from /admin/products.
// Safe to re-run: products and categories that already exist (matched by slug) are left alone.
//   npm run db:add-hardware

import { eq, max } from "drizzle-orm";
import { createDb, createPool } from "../../src/db/client";
import { categories, products } from "../../src/db/schema";

type Item = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  price: number;
  summary: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  inTheBox: string[];
};

const NEW_CATEGORIES = [{ slug: "fuser", name: "Video Fusers", blurb: "Combine two video sources onto one display." }];

const ITEMS: Item[] = [
  {
    slug: "tracecore-fuser-hd",
    name: "TraceCore Fuser HD",
    tagline: "HDMI video fuser up to 240 Hz",
    category: "fuser",
    price: 85,
    summary: "Combines the video from two PCs onto a single HDMI display. EDID is handled automatically, so it works the moment it's plugged in.",
    highlights: ["1080p up to 240 Hz, 1440p up to 144 Hz", "4K up to 60 Hz", "Automatic EDID, no setup", "HDMI connection"],
    specs: [
      { label: "Connection", value: "HDMI" },
      { label: "1920 × 1080", value: "Up to 240 Hz" },
      { label: "2560 × 1080", value: "Up to 200 Hz" },
      { label: "2560 × 1440", value: "Up to 144 Hz" },
      { label: "3440 × 1440", value: "Up to 100 Hz" },
      { label: "3840 × 2160", value: "Up to 60 Hz" },
      { label: "EDID", value: "Automatic" },
    ],
    inTheBox: ["TraceCore Fuser HD"],
  },
  {
    slug: "tracecore-fuser-dp-4k",
    name: "TraceCore Fuser DP 4K",
    tagline: "DisplayPort fuser up to 639 Hz",
    category: "fuser",
    price: 275,
    summary: "A DisplayPort fuser for high-refresh displays: up to 1440p at 364 Hz or 4K at 164 Hz, with full 8, 10 and 12-bit colour.",
    highlights: ["1080p up to 639 Hz, 1440p up to 364 Hz", "4K up to 164 Hz", "Native EDID, HDCP, MST and FEC", "RGB and YCbCr, 8 / 10 / 12-bit colour"],
    specs: [
      { label: "Connection", value: "DisplayPort in / out" },
      { label: "1280 × 720", value: "Up to 1000 Hz" },
      { label: "1920 × 1080", value: "Up to 639 Hz" },
      { label: "2560 × 1440", value: "Up to 364 Hz" },
      { label: "3440 × 1440", value: "Up to 264 Hz" },
      { label: "3840 × 2160", value: "Up to 164 Hz" },
      { label: "Protocols", value: "EDID · DDC · HPD · HDCP · MST · FEC" },
      { label: "Colour", value: "RGB / YCbCr, 8 / 10 / 12-bit" },
      { label: "Recommended GPU", value: "NVIDIA RTX 30-series or newer in both PCs" },
    ],
    inTheBox: ["TraceCore Fuser DP 4K"],
  },
  {
    slug: "tracecore-fuser-4k-pro",
    name: "TraceCore Fuser 4K Pro",
    tagline: "4K 120 Hz fuser with remote",
    category: "fuser",
    price: 270,
    summary: "Fuses two video sources at up to 4K 120 Hz or 1080p 360 Hz. Ships with a remote, two DisplayPort cables and its own power adapter.",
    highlights: ["1080p up to 360 Hz", "1440p up to 240 Hz, 4K up to 120 Hz", "Remote control included", "Cables and power adapter in the box"],
    specs: [
      { label: "1920 × 1080", value: "144 / 165 / 240 / 360 Hz" },
      { label: "2560 × 1080", value: "165 Hz" },
      { label: "2560 × 1440", value: "144 / 240 Hz" },
      { label: "3440 × 1440", value: "60 Hz" },
      { label: "3840 × 2160", value: "60 / 120 Hz" },
      { label: "Power", value: "12 V 2 A" },
      { label: "Second-PC GPU", value: "NVIDIA RTX 2060, AMD RX 470 or Radeon 780M and up" },
    ],
    inTheBox: ["TraceCore Fuser 4K Pro", "Remote control", "2 × DisplayPort cable", "12 V 2 A power adapter (US plug)"],
  },
  {
    slug: "tracecore-link",
    name: "TraceCore Link",
    tagline: "Compact USB passthrough controller",
    category: "input",
    price: 17,
    summary: "A small USB controller that passes your mouse through to the PC and takes commands over a UART serial link.",
    highlights: ["Mouse passthrough with UART control", "Works with 1000 Hz mice", "One compact unit"],
    specs: [
      { label: "Control", value: "UART serial" },
      { label: "Polling", value: "1000 Hz mice supported" },
      { label: "Platform", value: "PC" },
    ],
    inTheBox: ["TraceCore Link"],
  },
  {
    slug: "tracecore-link-pro",
    name: "TraceCore Link Pro",
    tagline: "8000 Hz passthrough controller",
    category: "input",
    price: 30,
    summary: "A full-passthrough input controller with a dual-core 144 MHz MCU and 8000 Hz polling. Works with KMBox- and MAKCU-compatible software as is.",
    highlights: ["8000 Hz polling", "Dual-core 144 MHz MCU", "Full passthrough", "KMBox- and MAKCU-compatible"],
    specs: [
      { label: "MCU", value: "Dual-core, 144 MHz" },
      { label: "Polling", value: "8000 Hz" },
      { label: "Mode", value: "Full passthrough" },
      { label: "Software", value: "KMBox / MAKCU compatible" },
      { label: "Platform", value: "PC" },
    ],
    inTheBox: ["TraceCore Link Pro"],
  },
  {
    slug: "tracecore-mini-pc",
    name: "TraceCore Mini PC",
    tagline: "A compact second PC",
    category: "accessory",
    price: 265,
    summary: "A palm-sized second PC with enough headroom for your DMA card's host software and tools, so your main machine stays free.",
    highlights: ["AMD Ryzen 5 3500U", "8 GB RAM, 128 GB M.2 SSD", "Wi-Fi 5", "3 × USB 3.2, 2 × HDMI"],
    specs: [
      { label: "CPU", value: "AMD Ryzen 5 3500U" },
      { label: "Memory", value: "8 GB" },
      { label: "Storage", value: "128 GB M.2 SSD" },
      { label: "Wireless", value: "Wi-Fi 5" },
      { label: "Ports", value: "3 × USB 3.2 · 2 × HDMI" },
    ],
    inTheBox: ["TraceCore Mini PC"],
  },
  {
    slug: "tracecore-tb-pcie-adapter",
    name: "TraceCore TB-PCIe Adapter",
    tagline: "Run a PCIe card from a laptop",
    category: "accessory",
    price: 85,
    summary: "Connects a PCIe card, like a TraceCore DMA board, to a laptop over Thunderbolt or USB4. Add your laptop model in the order notes so we send the right unit.",
    highlights: ["Thunderbolt 5, 4 and 3, plus USB4", "PCIe 4.0 x4 slot", "Made for laptops"],
    specs: [
      { label: "Host", value: "Thunderbolt 5 / 4 / 3 · USB4" },
      { label: "Slot", value: "PCIe 4.0 x4" },
      { label: "Ordering", value: "Add your laptop model in the order notes" },
    ],
    inTheBox: ["TraceCore TB-PCIe Adapter"],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (add it to .env.local).");
  const pool = createPool(url);
  const db = createDb(pool);
  try {
    for (const c of NEW_CATEGORIES) {
      const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, c.slug)).limit(1);
      if (row) continue;
      const [{ last }] = await db.select({ last: max(categories.sortOrder) }).from(categories);
      await db.insert(categories).values({ slug: c.slug, name: c.name, blurb: c.blurb, sortOrder: (last ?? 0) + 1 });
      console.log(`+ category ${c.name}`);
    }
    const categoryIds = new Map((await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((r) => [r.slug, r.id]));

    const [{ last }] = await db.select({ last: max(products.sortOrder) }).from(products);
    let sortOrder = (last ?? 0) + 1;
    for (const p of ITEMS) {
      const [exists] = await db.select({ id: products.id }).from(products).where(eq(products.slug, p.slug)).limit(1);
      if (exists) continue;
      await db.insert(products).values({
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        categoryId: categoryIds.get(p.category) ?? null,
        status: "draft",
        priceCents: Math.round(p.price * 100),
        sortOrder: sortOrder++,
        trackInventory: true,
        stockQty: 0,
        lowStockThreshold: 5,
        allowBackorder: false,
        summary: p.summary,
        highlights: p.highlights,
        specs: p.specs,
        inTheBox: p.inTheBox,
        optionValues: [],
        artKey: "placeholder",
      });
      console.log(`+ product ${p.name} (draft)`);
    }
    console.log("✓ Setup hardware added. Publish each product from /admin/products.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
