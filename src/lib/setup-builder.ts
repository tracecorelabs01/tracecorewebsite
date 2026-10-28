// Setup Builder rules, shared by the /build page and checkout pricing.
// Products are referenced by slug, so renaming one in the admin keeps it in the builder.

/** A cart with a product from each of these categories is a complete setup and earns the setup discount. */
export const SETUP_CATEGORIES = ["dma", "fuser", "input"] as const;

export const SETUP_SLUGS = {
  cards: ["tracecore-35t", "tracecore-75t", "tracecore-100t-pro"],
  inputs: ["tracecore-link", "tracecore-link-pro", "ferrum"],
  miniPc: "tracecore-mini-pc",
  adapter: "tracecore-tb-pcie-adapter",
} as const;

export const RESOLUTIONS = [
  { id: "1080p", label: "1920 × 1080" },
  { id: "1080uw", label: "2560 × 1080" },
  { id: "1440p", label: "2560 × 1440" },
  { id: "1440uw", label: "3440 × 1440" },
  { id: "4k", label: "3840 × 2160" },
] as const;
export type Resolution = (typeof RESOLUTIONS)[number]["id"];

export const REFRESH_RATES = [60, 100, 120, 144, 165, 240, 360, 500] as const;

/** Highest refresh rate (Hz) each fuser supports at each resolution, from its spec sheet. */
export const FUSERS: Record<string, Record<Resolution, number>> = {
  "tracecore-fuser-hd": { "1080p": 240, "1080uw": 200, "1440p": 144, "1440uw": 100, "4k": 60 },
  "tracecore-fuser-4k-pro": { "1080p": 360, "1080uw": 165, "1440p": 240, "1440uw": 60, "4k": 120 },
  // 2560 × 1080 isn't on the sheet; it has fewer pixels than 2560 × 1440, so that limit is safe.
  "tracecore-fuser-dp-4k": { "1080p": 639, "1080uw": 364, "1440p": 364, "1440uw": 264, "4k": 164 },
};

export const SETUP_PRODUCT_SLUGS = new Set<string>([...SETUP_SLUGS.cards, ...SETUP_SLUGS.inputs, SETUP_SLUGS.miniPc, SETUP_SLUGS.adapter, ...Object.keys(FUSERS)]);

/** The cheapest of `products` that drives this display, or undefined if none can. */
export function fuserFor<T extends { slug: string; price: number }>(products: T[], resolution: Resolution, hz: number) {
  return products.filter((p) => (FUSERS[p.slug]?.[resolution] ?? 0) >= hz).sort((a, b) => a.price - b.price)[0];
}

export function isCompleteSetup(categories: Iterable<string>) {
  const have = new Set(categories);
  return SETUP_CATEGORIES.every((c) => have.has(c));
}

/** Label stored on the order for the automatic setup discount. */
export const setupDiscountCode = (percent: number) => `SETUP-${percent}`;
