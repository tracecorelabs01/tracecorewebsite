// PLACEHOLDER COPY — review every answer against your real policies before launch.

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  id: string;
  label: string;
  items: FaqItem[];
}

export const faqGroups: FaqGroup[] = [
  {
    id: "orders",
    label: "Orders & payment",
    items: [
      {
        q: "How do I place an order?",
        a: "Add products to your cart, open the cart and press Checkout. Enter your shipping details, choose a payment method and confirm. You'll get an order confirmation by email straight away.",
      },
      {
        q: "Which payment methods do you accept?",
        a: "Major credit and debit cards, PayPal, Apple Pay and popular cryptocurrencies. All payments are processed over an encrypted connection — we never see or store your full card number.",
      },
      {
        q: "Can I change or cancel my order?",
        a: "Yes, as long as it hasn't shipped. Message us on Discord or email with your order number and we'll sort it out.",
      },
    ],
  },
  {
    id: "shipping",
    label: "Shipping",
    items: [
      {
        q: "Do you ship internationally?",
        a: "We ship to most countries worldwide. Shipping is free on orders over $250; below that a flat rate applies and is shown at checkout.",
      },
      {
        q: "How long does delivery take?",
        a: "Most orders leave our lab within one business day. Express delivery typically takes 3–7 business days depending on destination and customs.",
      },
      {
        q: "How do I track my order?",
        a: "As soon as your order ships you'll receive a tracking link by email. You can also ask for an update in our Discord support channel at any time.",
      },
    ],
  },
  {
    id: "hardware",
    label: "Hardware & setup",
    items: [
      {
        q: "What do I need to use a TraceCore card?",
        a: "A free PCIe slot (x1 or larger) in the target machine and a second computer to connect over USB-C. Every card ships with both full-height and low-profile brackets.",
      },
      {
        q: "35T, 75T or 100T Pro — which should I choose?",
        a: "The 35T is a compact, affordable starting point. The 75T is our best-seller and the right choice for most people. The 100T Pro adds the largest FPGA in the range and a heatsink for long sessions.",
      },
      {
        q: "Do you provide setup guides?",
        a: "Yes. Every order includes a quick-start card, and our Discord has step-by-step guides plus a support team that can help over chat.",
      },
    ],
  },
  {
    id: "warranty",
    label: "Warranty & support",
    items: [
      {
        q: "What warranty do you offer?",
        a: "All hardware is covered by a 12-month warranty against manufacturing defects (24 months on the 100T Pro). If something isn't right, we'll repair or replace it.",
      },
      {
        q: "What's your return policy?",
        a: "Unopened items can be returned within 14 days of delivery. Opened items are covered by the warranty. See the refund policy for full details.",
      },
      {
        q: "How do I contact support?",
        a: "The fastest way is our Discord, with 24/7 support. You can also use the contact form on the support page or email us directly.",
      },
    ],
  },
];

export const quickFaq: FaqItem[] = [
  faqGroups[2].items[0],
  faqGroups[1].items[0],
  faqGroups[0].items[1],
  faqGroups[1].items[1],
  faqGroups[3].items[0],
];
