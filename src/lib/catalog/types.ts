// Storefront-facing shapes. The database layer and the static demo catalogue both produce these.

export const ART_KEYS = ["dma-35t", "dma-75t", "dma-100t", "cable", "riser", "thermal", "bundle", "placeholder"] as const;
export type ArtKey = (typeof ART_KEYS)[number];

export type ProductVisual = { kind: "art"; art: ArtKey } | { kind: "image"; src: string; alt: string };

export type StockStatus = "in-stock" | "low-stock" | "preorder" | "sold-out";

export interface CategoryInfo {
  id: string; // slug
  label: string;
  blurb: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  categoryLabel: string;
  price: number;
  compareAt?: number;
  badge?: string;
  status: StockStatus;
  /** Units that can be bought right now; undefined = no limit. */
  maxQty?: number;
  rating: number;
  reviewCount: number;
  visual: ProductVisual;
  gallery?: ProductVisual[];
  summary: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  inTheBox: string[];
  option?: { name: string; values: string[] };
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PublicReview {
  name: string;
  handle: string;
  rating: number;
  text: string;
  product: string;
  date: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
}

export function relatedProducts(all: Product[], product: Product, count = 4) {
  const others = all.filter((p) => p.slug !== product.slug);
  return [...others.filter((p) => p.category === product.category), ...others.filter((p) => p.category !== product.category)].slice(0, count);
}
