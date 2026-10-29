// Setup Builder: the questions the configurator asks and the products it recommends. Edited in
// /admin/setup-builder; these defaults apply until it's saved there (and always in demo mode).
// Shared by the shop page, the admin editor and checkout pricing, so it stays free of zod and server code.
// Products and categories are referenced by slug, so renaming one in the admin keeps it in the builder.

export interface StepCopy {
  /** Short name in the progress bar and the summary recap. */
  label: string;
  title: string;
  hint: string;
}

/** A heading whose ending is set in the brand gradient. */
export interface Heading {
  text: string;
  highlight: string;
  /** Start the highlighted part on a new line. */
  newLine: boolean;
}

export interface BuilderTier {
  id: string;
  name: string;
  description: string;
  /** Small label on the option, e.g. "Most popular". Empty for none. */
  badge: string;
  /** The DMA card this budget starts with. */
  card: string;
  /** Input device suggested with it; empty for none. */
  input: string;
}

export interface BuilderScreen {
  id: string;
  label: string;
  detail: string;
}

export interface BuilderSpeed {
  hz: number;
  label: string;
  detail: string;
}

export interface BuilderFuser {
  product: string;
  /** Highest refresh rate (Hz) it drives at each screen size, by screen id. 0 or missing: it can't. */
  maxHz: Record<string, number>;
}

export interface BuilderOption {
  product: string;
  title: string;
  description: string;
}

export interface BuilderAddon {
  product: string;
  /** Empty: the product's tagline. */
  description: string;
}

export interface SetupBuilderConfig {
  intro: {
    kicker: string;
    heading: Heading;
    /** Used while the setup discount is on. */
    headingDiscount: Heading;
    text: string;
    /** Added after the intro text while the setup discount is on. */
    discountText: string;
  };
  /** A cart with a product from each of these categories earns the setup discount. */
  discountCategories: string[];
  budget: StepCopy & {
    tiers: BuilderTier[];
    role: string;
    whatItDoes: string;
    fromPrice: string;
    comingSoon: string;
  };
  monitor: StepCopy & {
    enabled: boolean;
    screens: BuilderScreen[];
    speeds: BuilderSpeed[];
    /** Speed selected when the step opens. */
    defaultHz: number;
    fusers: BuilderFuser[];
    /** Fuser for customers who don't know their monitor. */
    unsureFuser: string;
    role: string;
    whatItDoes: string;
    screenHeading: string;
    speedHeading: string;
    unsureTitle: string;
    unsureText: string;
    previewHeading: string;
    matchCaption: string;
    unsureCaption: string;
    noMatch: string;
    recapUnsure: string;
  };
  pc: StepCopy & {
    enabled: boolean;
    product: string;
    role: string;
    whatItDoes: string;
    haveTitle: string;
    haveText: string;
    needTitle: string;
    needText: string;
    unavailable: string;
    recapHave: string;
    recapNeed: string;
  };
  input: StepCopy & {
    enabled: boolean;
    options: BuilderOption[];
    role: string;
    whatItDoes: string;
    suggestedBadge: string;
    noneEnabled: boolean;
    noneTitle: string;
    noneText: string;
    recapNone: string;
  };
  summary: StepCopy & {
    addons: BuilderAddon[];
    addonRole: string;
    addonsHeading: string;
    discountHint: string;
    seeButton: string;
    addButton: string;
    addedButton: string;
    note: string;
    startOver: string;
  };
}

export const defaultSetupBuilder: SetupBuilderConfig = {
  intro: {
    kicker: "Setup builder",
    heading: { text: "Build your", highlight: "setup.", newLine: false },
    headingDiscount: { text: "Configure your bundle,", highlight: "save an extra {percent}%.", newLine: true },
    text: "Answer {questions} quick questions and we'll put together a complete setup for you.",
    discountText: "Take the whole bundle and the extra {percent}% comes off automatically.",
  },
  discountCategories: ["dma", "fuser", "input"],
  budget: {
    label: "Budget",
    title: "What's your budget?",
    hint: "Pick a starting point. You can change anything before you buy.",
    tiers: [
      { id: "starter", name: "Starter", description: "A solid first setup at the lowest price.", badge: "", card: "tracecore-35t", input: "makcu" },
      { id: "recommended", name: "Recommended", description: "The best balance of price and performance. Most people pick this.", badge: "Most popular", card: "tracecore-75t", input: "ferrum" },
      { id: "pro", name: "Pro", description: "Our biggest card and premium input device. Nothing held back.", badge: "", card: "tracecore-100t-pro", input: "ferrum" },
    ],
    role: "DMA card",
    whatItDoes: "Goes into a free PCIe slot inside your main PC.",
    fromPrice: "Setups from {price}",
    comingSoon: "Coming soon",
  },
  monitor: {
    label: "Monitor",
    title: "What monitor do you use?",
    hint: "We'll include the fuser that suits it, so the picture just works.",
    enabled: true,
    // Ultrawide uses the 3440 × 1440 limits, the stricter of the two sizes it covers.
    screens: [
      { id: "1080p", label: "Full HD", detail: "1920 × 1080, the most common" },
      { id: "1440p", label: "2K / QHD", detail: "2560 × 1440" },
      { id: "1440uw", label: "Ultrawide", detail: "3440 × 1440 or 2560 × 1080" },
      { id: "4k", label: "4K / UHD", detail: "3840 × 2160" },
    ],
    speeds: [
      { hz: 60, label: "60 Hz", detail: "Standard" },
      { hz: 144, label: "144 Hz", detail: "Gaming" },
      { hz: 240, label: "240 Hz", detail: "Fast" },
      { hz: 360, label: "360 Hz", detail: "Esports" },
      { hz: 500, label: "480 Hz+", detail: "Pro esports" },
    ],
    defaultHz: 144,
    // From each fuser's spec sheet.
    fusers: [
      { product: "dichen-fuser", maxHz: { "1080p": 240, "1440p": 144, "1440uw": 100, "4k": 60 } },
      { product: "godlike-4k-fuser", maxHz: { "1080p": 360, "1440p": 240, "1440uw": 60, "4k": 120 } },
      { product: "dc1a686-fuser", maxHz: { "1080p": 639, "1440p": 364, "1440uw": 264, "4k": 164 } },
    ],
    unsureFuser: "dc1a686-fuser",
    role: "Video fuser",
    whatItDoes: "Shows the picture from both computers on your one monitor.",
    screenHeading: "Screen size",
    speedHeading: "Speed (refresh rate)",
    unsureTitle: "I'm not sure",
    unsureText: "It is usually in the monitor's name, or in Windows under Settings › System › Display.",
    previewHeading: "Your fuser",
    matchCaption: "Works with your {screen} {speed} monitor",
    unsureCaption: "Works with almost every monitor",
    noMatch: "None of our fusers drives that combination. Try a lower speed, or choose I'm not sure.",
    recapUnsure: "Not sure",
  },
  pc: {
    label: "Second PC",
    title: "Do you have a second computer?",
    hint: "Your DMA card connects to a second computer that runs its software. Any modern PC or laptop will do.",
    enabled: true,
    product: "dma-mini-pc",
    role: "Second PC",
    whatItDoes: "A small second computer that runs the card's software.",
    haveTitle: "Yes, I have one",
    haveText: "A spare PC or laptop.",
    needTitle: "No, add one for me",
    needText: "We'll include the {product}.",
    unavailable: "Our mini PC is coming soon.",
    recapHave: "Your own",
    recapNeed: "Included",
  },
  input: {
    label: "Input",
    title: "Do you need an input device?",
    hint: "It plugs in between your mouse and your main PC.",
    enabled: true,
    options: [
      { product: "makcu", title: "Compact", description: "Small and affordable." },
      { product: "ferrum", title: "Premium", description: "Machined aluminium, plug-and-play." },
    ],
    role: "Input device",
    whatItDoes: "Plugs in between your mouse and your main PC.",
    suggestedBadge: "Suggested",
    noneEnabled: true,
    noneTitle: "No thanks",
    noneText: "I already have one.",
    recapNone: "None",
  },
  summary: {
    label: "Your setup",
    title: "Here's your setup",
    hint: "Everything you need, matched to your answers. Add extras if you like, then add it all to your cart.",
    addons: [
      { product: "usb-c-data-cable", description: "A longer braided cable, so the card reaches your second computer." },
      { product: "pcie-riser-kit", description: "Lets you mount the card where there's more room or airflow." },
      { product: "thermal-kit", description: "Keeps the card cool in a cramped case." },
    ],
    addonRole: "Add-on",
    addonsHeading: "Popular add-ons",
    discountHint: "Get the card, fuser and input device together for {percent}% off",
    seeButton: "See my setup",
    addButton: "Add everything to cart",
    addedButton: "Added to cart",
    note: "Shipping and the setup discount are confirmed at checkout.",
    startOver: "Start over",
  },
};

export type StepKey = "budget" | "monitor" | "pc" | "input" | "summary";
export const STEP_ORDER: readonly StepKey[] = ["budget", "monitor", "pc", "input", "summary"];

/** Every product the builder can put in a setup. */
export function builderProductSlugs(c: SetupBuilderConfig) {
  return new Set(
    [
      ...c.budget.tiers.flatMap((t) => [t.card, t.input]),
      ...c.monitor.fusers.map((f) => f.product),
      c.pc.product,
      ...c.input.options.map((o) => o.product),
      ...c.summary.addons.map((a) => a.product),
    ].filter(Boolean),
  );
}

const maxHzOf = (fusers: BuilderFuser[], slug: string, screen: string) => fusers.find((f) => f.product === slug)?.maxHz[screen] ?? 0;

/** The cheapest of `products` that drives this display, or undefined if none can. */
export function fuserFor<T extends { slug: string; price: number }>(products: T[], fusers: BuilderFuser[], screen: string, hz: number) {
  return products.filter((p) => maxHzOf(fusers, p.slug, screen) >= hz).sort((a, b) => a.price - b.price)[0];
}

/** Highest refresh rate any of these fusers supports at `screen` (0 if none). */
export function maxHzFor(fusers: BuilderFuser[], slugs: string[], screen: string) {
  return Math.max(0, ...slugs.map((s) => maxHzOf(fusers, s, screen)));
}

/** The fuser that drives the most displays, for when the chosen "not sure" fuser isn't available. */
export function widestFuser<T extends { slug: string }>(products: T[], fusers: BuilderFuser[]) {
  const reach = (slug: string) => Object.values(fusers.find((f) => f.product === slug)?.maxHz ?? {}).reduce((n, hz) => n + hz, 0);
  return [...products].sort((a, b) => reach(b.slug) - reach(a.slug))[0];
}

export function isCompleteSetup(categories: Iterable<string>, required: string[]) {
  const have = new Set(categories);
  return required.length > 0 && required.every((c) => have.has(c));
}

/** Label stored on the order for the automatic setup discount. */
export const setupDiscountCode = (percent: number) => `SETUP-${percent}`;

/** Swap {name} placeholders for values; unknown ones stay as typed. */
export function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const numberWord = (n: number) => WORDS[n] ?? String(n);

/** Tidy a config before saving: speeds in order, fuser specs keyed by exactly the current screens. */
export function normalizeSetupBuilder(c: SetupBuilderConfig): SetupBuilderConfig {
  const screens = c.monitor.screens.map((s) => s.id);
  return {
    ...c,
    discountCategories: [...new Set(c.discountCategories)],
    monitor: {
      ...c.monitor,
      speeds: [...c.monitor.speeds].sort((a, b) => a.hz - b.hz),
      fusers: c.monitor.fusers.map((f) => ({ ...f, maxHz: Object.fromEntries(screens.map((id) => [id, f.maxHz[id] ?? 0])) })),
    },
  };
}
