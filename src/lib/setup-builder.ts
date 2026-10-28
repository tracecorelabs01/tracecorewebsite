// Setup Builder rules, shared by the /build page and checkout pricing.
// Products are referenced by slug, so renaming one in the admin keeps it in the builder.

/** A cart with a product from each of these categories is a complete setup and earns the setup discount. */
export const SETUP_CATEGORIES = ["dma", "fuser", "input"] as const;

export type Resolution = "1080p" | "1080uw" | "1440p" | "1440uw" | "4k";

/** Budget tiers in plain language: the DMA card and input device each one starts with. */
export const TIERS = [
  { id: "starter", label: "Starter", blurb: "A solid first setup at the lowest price.", card: "tracecore-35t", input: "makcu" },
  { id: "recommended", label: "Recommended", blurb: "The best balance of price and performance. Most people pick this.", card: "tracecore-75t", input: "ferrum", popular: true },
  { id: "pro", label: "Pro", blurb: "Our biggest card and premium input device. Nothing held back.", card: "tracecore-100t-pro", input: "ferrum" },
] as const;
export type TierId = (typeof TIERS)[number]["id"];

export const SETUP_SLUGS = {
  inputs: ["makcu", "ferrum"],
  miniPc: "dma-mini-pc",
  extras: ["usb-c-data-cable", "pcie-riser-kit", "thermal-kit"],
} as const;

/** Monitor sizes as customers know them. Ultrawide uses the 3440 × 1440 limits, the stricter of the two. */
export const SCREENS: { id: Resolution; label: string; detail: string }[] = [
  { id: "1080p", label: "Full HD", detail: "1920 × 1080, the most common" },
  { id: "1440p", label: "2K / QHD", detail: "2560 × 1440" },
  { id: "1440uw", label: "Ultrawide", detail: "3440 × 1440 or 2560 × 1080" },
  { id: "4k", label: "4K / UHD", detail: "3840 × 2160" },
];

export const SPEEDS = [
  { hz: 60, label: "60 Hz", detail: "Standard" },
  { hz: 144, label: "144 Hz", detail: "Gaming" },
  { hz: 240, label: "240 Hz", detail: "Fast" },
  { hz: 360, label: "360 Hz", detail: "Esports" },
  { hz: 500, label: "480 Hz+", detail: "Pro esports" },
] as const;

/** Highest refresh rate (Hz) each fuser supports at each resolution, from its spec sheet. */
export const FUSERS: Record<string, Record<Resolution, number>> = {
  "dichen-fuser": { "1080p": 240, "1080uw": 200, "1440p": 144, "1440uw": 100, "4k": 60 },
  "godlike-4k-fuser": { "1080p": 360, "1080uw": 165, "1440p": 240, "1440uw": 60, "4k": 120 },
  // 2560 × 1080 isn't on the sheet; it has fewer pixels than 2560 × 1440, so that limit is safe.
  "dc1a686-fuser": { "1080p": 639, "1080uw": 364, "1440p": 364, "1440uw": 264, "4k": 164 },
};

/** For customers who don't know their monitor: the fuser that drives the widest range of displays. */
export const UNSURE_FUSER = "dc1a686-fuser";

export const SETUP_PRODUCT_SLUGS = new Set<string>([...TIERS.flatMap((t) => [t.card, t.input]), ...SETUP_SLUGS.inputs, SETUP_SLUGS.miniPc, ...SETUP_SLUGS.extras, ...Object.keys(FUSERS)]);

/** The cheapest of `products` that drives this display, or undefined if none can. */
export function fuserFor<T extends { slug: string; price: number }>(products: T[], resolution: Resolution, hz: number) {
  return products.filter((p) => (FUSERS[p.slug]?.[resolution] ?? 0) >= hz).sort((a, b) => a.price - b.price)[0];
}

/** Highest refresh rate any of these fusers supports at `resolution` (0 if none). */
export function maxHzFor(fuserSlugs: string[], resolution: Resolution) {
  return Math.max(0, ...fuserSlugs.map((s) => FUSERS[s]?.[resolution] ?? 0));
}

export function isCompleteSetup(categories: Iterable<string>) {
  const have = new Set(categories);
  return SETUP_CATEGORIES.every((c) => have.has(c));
}

/** Label stored on the order for the automatic setup discount. */
export const setupDiscountCode = (percent: number) => `SETUP-${percent}`;
