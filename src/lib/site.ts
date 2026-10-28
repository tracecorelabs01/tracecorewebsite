// Store-wide settings. Everything marked PLACEHOLDER should be replaced with
// real values before launch.

export const site = {
  name: "TraceCoreLab",
  domain: "tracecorelab.com",
  url: "https://tracecorelab.com",
  tagline: "Built in the lab. Proven in the field.",
  description:
    "TraceCoreLab — FPGA-powered DMA hardware, precision input devices and accessories. Quality-checked in our lab and shipped worldwide.",
  email: "support@tracecorelab.com", // PLACEHOLDER
  currency: "USD",
  freeShippingThreshold: 250,
  flatShipping: 15,
  // Shows a notice on /checkout until a payment provider is wired up.
  checkoutDemoMode: true,
  links: {
    discord: "https://discord.gg/", // PLACEHOLDER — your invite link
    x: "https://x.com/", // PLACEHOLDER
    youtube: "https://youtube.com/", // PLACEHOLDER
    tiktok: "https://tiktok.com/", // PLACEHOLDER
  },
  announcements: [
    "Free worldwide shipping on orders over $250",
    "Every unit is tested in our lab before dispatch",
    "24/7 support on Discord",
    "Secure checkout · Card · PayPal · Crypto",
  ],
  // PLACEHOLDER — replace with your real numbers.
  stats: [
    { value: 12000, suffix: "+", label: "Orders shipped" },
    { value: 45, suffix: "+", label: "Countries served" },
    { value: 4.9, suffix: "/5", label: "Average rating", decimals: 1 },
    { value: 24, suffix: "h", label: "Typical dispatch" },
  ],
  nav: [
    { label: "Shop", href: "/shop" },
    { label: "Setup Builder", href: "/build" },
    { label: "DMA Cards", href: "/shop?category=dma" },
    { label: "Ferrum", href: "/product/ferrum" },
    { label: "FAQ", href: "/faq" },
    { label: "Support", href: "/support" },
  ],
  payments: ["Visa", "Mastercard", "Amex", "PayPal", "Apple Pay", "Crypto"],
} as const;

export type Site = typeof site;
