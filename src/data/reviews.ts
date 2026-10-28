// SAMPLE CONTENT for layout only — replace with real customer reviews
// (e.g. exported from Trustpilot or your Discord) before launch. Publishing
// invented reviews is illegal in many places (e.g. the US FTC rule, 16 CFR 465).

export interface Review {
  name: string;
  handle: string;
  rating: number;
  text: string;
  product: string;
  date: string;
}

export const reviews: Review[] = [
  { name: "Sample Reviewer", handle: "@sample.one", rating: 5, text: "Arrived in four days, packed like it was going to space. The card was flashed and labelled, setup took ten minutes.", product: "TraceCore 75T", date: "Oct 2026" },
  { name: "Sample Reviewer", handle: "@sample.two", rating: 5, text: "Build quality on the Ferrum is unreal. Feels like a piece of jewellery, not a gadget.", product: "Ferrum", date: "Oct 2026" },
  { name: "Sample Reviewer", handle: "@sample.three", rating: 5, text: "Support answered on Discord at 2am and walked me through everything. That alone is worth it.", product: "Lab Bundle", date: "Sep 2026" },
  { name: "Sample Reviewer", handle: "@sample.four", rating: 4, text: "Shipping to Europe was quick and tracking updated the whole way. Low-profile bracket fit my SFF case perfectly.", product: "TraceCore 35T", date: "Sep 2026" },
  { name: "Sample Reviewer", handle: "@sample.five", rating: 5, text: "Second order from these guys. Consistent quality, honest communication, no surprises.", product: "TraceCore 100T Pro", date: "Sep 2026" },
  { name: "Sample Reviewer", handle: "@sample.six", rating: 5, text: "The bundle saved me a bunch and the cable is actually long enough. Clean packaging too.", product: "Lab Bundle", date: "Aug 2026" },
  { name: "Sample Reviewer", handle: "@sample.seven", rating: 5, text: "Heatsink on the 100T Pro keeps it cool during long sessions. You can tell it was tested.", product: "TraceCore 100T Pro", date: "Aug 2026" },
  { name: "Sample Reviewer", handle: "@sample.eight", rating: 5, text: "Ordered Sunday night, shipped Monday morning. The quick-start card made setup painless.", product: "TraceCore 75T", date: "Aug 2026" },
  { name: "Sample Reviewer", handle: "@sample.nine", rating: 4, text: "Riser kit works great, wish it came in a longer length but no complaints otherwise.", product: "PCIe x1 Riser Kit", date: "Jul 2026" },
  { name: "Sample Reviewer", handle: "@sample.ten", rating: 5, text: "Exactly as described, exactly when promised. That's all I want from a store.", product: "USB-C 3.2 Data Cable", date: "Jul 2026" },
];

export const ratingSummary = { average: 4.9, count: 1840 }; // PLACEHOLDER
