// Store-wide settings. Everything marked PLACEHOLDER should be replaced with
// real values before launch.

export const site = {
  name: "TraceCoreLab",
  domain: "tracecorelab.com",
  url: "https://tracecorelab.com",
  tagline: "Built in the lab. Proven in the field.",
  description:
    "FPGA-based PCIe DMA cards, video fusers, USB input passthrough devices and accessories. Every unit is checked in our lab and shipped worldwide.",
  /**
   * The owner-approved scope statement. It covers this website only: use it as written or shortened, never broader.
   * For /about, the FAQ ("What does the TraceCoreLab store sell?"), llms.txt and the Organization JSON-LD.
   */
  scopeStatement:
    "The TraceCoreLab store sells hardware only: FPGA-based PCIe DMA cards, video fusers, USB input passthrough devices and accessories. No game cheats, cheat software or anti-cheat bypass tools are sold on this website, and our guides cover hardware setup, development, research and production use only.",
  /** The statement's one-line form, for the footer area. */
  scopeNote: "Hardware only: no game cheats, cheat software or anti-cheat bypass tools are sold on this website.",
  email: "support@tracecorelab.com", // PLACEHOLDER
  currency: "USD",
  freeShippingThreshold: 250,
  flatShipping: 35,
  // Shows a notice on /checkout until a payment provider is wired up.
  checkoutDemoMode: true,
  links: {
    discord: "https://discord.gg/", // PLACEHOLDER — your invite link
    x: "https://x.com/", // PLACEHOLDER
    youtube: "https://youtube.com/", // PLACEHOLDER
    tiktok: "https://tiktok.com/", // PLACEHOLDER
  },
  // Tokens like {{freeShippingThreshold}} are filled from Settings (src/lib/tokens.ts); never type an amount here.
  announcements: [
    "Free worldwide shipping on orders over {{freeShippingThreshold}}",
    "Every unit is tested in our lab before dispatch",
    "24/7 support on Discord",
    "Secure card checkout through Razorpay",
  ],
  // PLACEHOLDER — replace with your real numbers.
  stats: [
    { value: 12000, suffix: "+", label: "Orders shipped" },
    { value: 45, suffix: "+", label: "Countries served" },
    { value: 4.9, suffix: "/5", label: "Average rating", decimals: 1 },
    { value: 24, suffix: "h", label: "Typical dispatch" },
  ],
  nav: [
    // Shop opens the mega menu (categories, Setup Builder, Ferrum) in the header.
    { label: "Shop", href: "/shop" },
    { label: "Partners", href: "/partners" },
    { label: "FAQ", href: "/faq" },
    { label: "Support", href: "/support" },
  ],
} as const;

export type Site = typeof site;
