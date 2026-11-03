// Homepage "Shop by category" tiles: one per product family, each linking only its own category and guide.
export interface CategoryTile {
  category: string;
  title: string;
  text: string;
  links: { label: string; href: string }[];
}

export const categoryTiles: CategoryTile[] = [
  {
    category: "dma",
    title: "PCIe DMA Cards",
    text: "FPGA DMA cards built on Xilinx Artix-7 chips, including the TraceCore 75T and 100T Pro. They are PCILeech-compatible and fit a PCIe x1 or larger slot, for FPGA development, memory forensics with MemProcFS, incident response and security research on computers you own or are authorized to examine.",
    links: [
      {
        label: "What is a PCIe DMA card?",
        href: "/guides/what-is-a-pcie-dma-card",
      },
      { label: "Shop DMA cards", href: "/shop/dma" },
    ],
  },
  {
    category: "fuser",
    title: "Video Fusers",
    text: "HDMI and DisplayPort video fusers show two video sources on one display: the main picture fills the screen and the overlay source's graphics are keyed over it. Use them for stream overlays, presentation graphics, picture-in-picture windows, capture and digital signage, with models from HDMI 2.0 to HDMI 2.1 and DisplayPort 1.4.",
    links: [
      {
        label: "What is a video fuser?",
        href: "/guides/what-is-a-video-fuser",
      },
      { label: "Shop video fusers", href: "/shop/fuser" },
    ],
  },
  {
    category: "input",
    title: "USB Input Passthrough Devices",
    text: "USB passthrough devices sit inline between a USB mouse or keyboard and a computer and pass the input through, with plug-and-play passthrough. MAKCU runs at up to 1000 Hz on full-speed USB; the Ferrum USB passthrough device reaches up to 8000 Hz (vendor-listed) over high-speed USB.",
    links: [
      {
        label: "USB polling rate explained",
        href: "/guides/usb-polling-rate-1000hz-vs-8000hz",
      },
      { label: "Shop input devices", href: "/shop/input" },
    ],
  },
  {
    category: "accessory",
    title: "Accessories",
    text: "Accessories for TraceCore DMA cards: a braided USB-C 3.2 data cable in 2 m or 3 m lengths, a Thermal Kit with a clip-on heatsink and thermal pads for the TraceCore 75T, and the DMA Mini PC, a compact analysis workstation for PCILeech and MemProcFS.",
    links: [{ label: "Shop accessories", href: "/shop/accessory" }],
  },
  {
    category: "bundle",
    title: "Bundles",
    text: "Bundles group products that are also sold individually and price them together in one order. Each item in a bundle works on its own, has its own setup guide where one is needed and carries the 3-month warranty. Every bundle page lists exactly what is in the box.",
    links: [{ label: "Shop bundles", href: "/shop/bundle" }],
  },
];
