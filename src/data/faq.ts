// Review every answer against your real policies. Answers may link pages with [text](/path) (rendered as links).
// Amounts are tokens ({{freeShippingThreshold}}, {{flatShipping}}, {{supportEmail}}) filled from Settings wherever
// answers are shown (fillTokens in src/lib/tokens.ts): never type a shipping amount here.

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
        a: "Debit and credit cards (Visa, Mastercard) through Razorpay's secure checkout. Card payments are encrypted end to end, and we never see or store your full card number.",
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
        q: "How much is shipping?",
        a: "Shipping is free worldwide on orders over {{freeShippingThreshold}}. Orders below that pay a flat rate of {{flatShipping}}, shown at checkout before you pay.",
      },
      {
        q: "Do you ship internationally?",
        a: "Yes. We ship worldwide by tracked express courier, including the US, Canada, the UK, every EU country and the Gulf states. Shipping is free on orders over {{freeShippingThreshold}}; below that a flat rate applies and is shown at checkout. [Worldwide shipping](/shipping) lists every country, delivery times and what you pay on arrival.",
      },
      {
        q: "How long does delivery take?",
        a: "Most orders leave our lab within one business day. Express delivery typically takes 3 to 7 business days, depending on destination and customs.",
      },
      {
        q: "How do I track my order?",
        a: "As soon as your order ships you'll receive a tracking link by email. With an account, every order and its tracking is in your account. Checked out as a guest? Open the Track your order page, enter the email you ordered with, and we'll email you a code. In our Discord server, /track lists your orders too: the first time, link your Discord with a code we email you.",
      },
    ],
  },
  {
    id: "hardware",
    label: "Hardware & setup",
    items: [
      {
        q: "What does the TraceCoreLab store sell?",
        a: "The TraceCoreLab store sells hardware only: FPGA-based PCIe DMA cards, video fusers, USB input passthrough devices and accessories. No game cheats, cheat software or anti-cheat bypass tools are sold on this website, and our guides cover hardware setup, development, research and production use only.",
      },
      {
        q: "What is a PCIe DMA card?",
        a: "A PCIe DMA card is an FPGA board that plugs into a PCIe slot and reads memory by direct memory access, sending the data over USB to a separate analysis computer. With PCILeech-compatible hardware and tools such as MemProcFS, it is used for memory forensics, incident response, security research and hardware debugging, only on computers you own or are authorized to examine. [What is a PCIe DMA card?](/guides/what-is-a-pcie-dma-card) explains it step by step.",
      },
      {
        q: "What is a video fuser?",
        a: "A video fuser shows two video sources on one display: the main source fills the screen and the overlay source is keyed over it, so only its graphics appear. It is used for stream overlays, presentation graphics, picture-in-picture windows, capture and digital signage, over HDMI or DisplayPort. [What is a video fuser?](/guides/what-is-a-video-fuser) covers how it works.",
      },
      {
        q: "What do I need to use a TraceCore DMA card?",
        a: "A free PCIe slot (x1 or larger) in the computer you are examining, and a separate analysis computer connected to the card's USB-C data link. The TraceCore 75T and 100T Pro ship with full-height and low-profile brackets. Use a DMA card only on computers you own or are authorized to examine. [How to install a PCIe DMA card](/guides/install-a-pcie-dma-card) walks through it.",
      },
      {
        q: "Which DMA card should I choose: 75T or 100T Pro?",
        a: "Both are PCILeech-compatible FPGA DMA cards built on Xilinx Artix-7 chips, with a kill switch on the I/O panel that disables the card without unplugging it. The TraceCore 75T DMA card uses the XC7A75T (75,520 logic cells) and suits memory forensics, PCIe research and FPGA learning. The TraceCore 100T Pro uses the larger XC7A100T (101,440 logic cells) for bigger FPGA designs. [Artix-7 35T vs 75T vs 100T](/guides/artix-7-35t-vs-75t-vs-100t) compares them in detail.",
      },
      {
        q: "Which USB passthrough device should I choose: MAKCU or Ferrum?",
        a: "MAKCU passes a mouse through at up to 1000 Hz and costs less. The Ferrum USB passthrough device runs high-speed USB for up to 8000 Hz (vendor-listed), also takes a keyboard, and according to its maker keeps the mouse maker's software working. [MAKCU vs Ferrum](/guides/makcu-vs-ferrum) compares them side by side.",
      },
      {
        q: "Do you provide setup guides?",
        a: "Yes. Our [guides](/guides) cover installation, drivers, setup and troubleshooting for each product family, and our support team can help on Discord.",
      },
    ],
  },
  {
    id: "warranty",
    label: "Warranty & support",
    items: [
      {
        q: "What warranty do you offer?",
        a: "Every product has a 3-month warranty from the purchase date. Defective or damaged products are replaced, not refunded: warranty claims are replacements only. Damage that happens in transit is a claim with the courier, which we'll help you file.",
      },
      {
        q: "What's your return policy?",
        a: "Returns are handled as warranty claims, up to 3 months after the purchase date. Open a warranty ticket in our Discord or contact us with your order number, and if the item is defective or damaged we'll send you a replacement. We don't give refunds on returns. See the refund policy for full details.",
      },
      {
        q: "How do I contact support?",
        a: "The fastest way is our Discord server. You can also use the contact form on the [support page](/support) or email us at {{supportEmail}}.",
      },
    ],
  },
];

export const quickFaq: FaqItem[] = [
  faqGroups[2].items[0],
  faqGroups[1].items[1],
  faqGroups[0].items[1],
  faqGroups[1].items[2],
  faqGroups[3].items[0],
];
