// Display labels for guide sections and kinds, shared by the guides pages and the admin (safe in client components).

import type { GUIDE_KINDS, GUIDE_SECTIONS } from "@/db/schema";

export type GuideSection = (typeof GUIDE_SECTIONS)[number];
export type GuideKind = (typeof GUIDE_KINDS)[number];

/** In the order the /guides hub lists them. Each section is one product family; "reference" holds the glossary. */
export const GUIDE_SECTION_LABELS: Record<GuideSection, string> = {
  dma: "DMA cards",
  fuser: "Video fusers",
  input: "USB passthrough devices",
  reference: "Reference",
};

export const GUIDE_KIND_LABELS: Record<GuideKind, string> = {
  guide: "Guide",
  comparison: "Comparison",
  glossary: "Glossary",
};
