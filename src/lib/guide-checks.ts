// Content checks for a guide, shared by the admin save action (field errors that stop the save) and the admin
// guides list (warnings for guides that arrived some other way, e.g. a content patch). No server-only import: the
// editor uses productFamily too.

import { findBlocked, findLiteralPrices } from "@/lib/content-guard";
import { GUIDE_SECTION_LABELS, type GuideSection } from "@/lib/guide-labels";
import { findPlaceholders } from "@/lib/markdown";
import { unknownTokens, type TokenContext } from "@/lib/tokens";

/** A product's family: DMA cards and their accessories are one family; every other category is its own. */
export const productFamily = (category: string) => (category === "accessory" ? "dma" : category);

export interface GuideFields {
  title: string;
  seoTitle: string | null;
  description: string;
  body: string;
  coverUrl: string | null;
  coverAlt: string;
  section: GuideSection;
  relatedProducts: string[];
}

const TEXT_FIELDS = ["title", "seoTitle", "description", "body", "coverAlt"] as const;

/**
 * What's wrong with a guide, by form field; empty when it can be published. `products` are the products on sale
 * (getCatalog), `tokens` fills {{price:...}} and the settings tokens (getTokenContext).
 */
export function guideProblems(g: GuideFields, { products, tokens }: { products: readonly { slug: string; category: string }[]; tokens: TokenContext }): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const field of TEXT_FIELDS) {
    const text = g[field] ?? "";
    const blocked = findBlocked(text);
    const prices = findLiteralPrices(text);
    const placeholders = findPlaceholders(text);
    const unknown = unknownTokens(text, tokens);
    const issue = blocked.length
      ? `Remove ${blocked.map((t) => `"${t}"`).join(", ")}: the store never publishes these terms.`
      : prices.length
        ? `Replace ${prices.join(", ")} with {{price:<product-slug>}} (or {{freeShippingThreshold}} / {{flatShipping}} for shipping), so it always matches the store.`
        : placeholders.length
          ? `Replace the placeholder text: ${placeholders.join(", ")}.`
          : unknown.length
            ? `These tokens can't be filled (misspelt, or the product isn't on sale): ${unknown.join(", ")}.`
            : undefined;
    if (issue) problems[field] = issue;
  }
  if (!problems.body && /!\[\s*\]\(/.test(g.body)) problems.body = "Every image needs alt text: describe it between the brackets, ![like this](/media/...).";
  if (g.coverUrl && !g.coverAlt.trim()) problems.coverAlt = "Describe the cover image.";

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const missing = g.relatedProducts.filter((s) => !bySlug.has(s));
  if (g.section === "reference") {
    if (g.relatedProducts.length) problems.relatedProducts = "Reference guides don't list products.";
  } else if (missing.length) {
    problems.relatedProducts = `Not on sale: ${missing.join(", ")}. Remove them or put them back on sale first.`;
  } else if (g.relatedProducts.some((s) => productFamily(bySlug.get(s)!.category) !== g.section)) {
    problems.relatedProducts = `Pick ${GUIDE_SECTION_LABELS[g.section]} only: a guide covers one product family.`;
  }
  return problems;
}
