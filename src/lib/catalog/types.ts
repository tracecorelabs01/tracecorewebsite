// Storefront-facing shapes. The database layer and the static demo catalogue both produce these.

export const ART_KEYS = ["dma-35t", "dma-75t", "dma-100t", "cable", "riser", "thermal", "bundle", "placeholder"] as const;
export type ArtKey = (typeof ART_KEYS)[number];

export type ProductVisual = { kind: "art"; art: ArtKey } | { kind: "image"; src: string; alt: string };

export type StockStatus = "in-stock" | "low-stock" | "preorder" | "sold-out";

/** How each stock status reads in the shop, and to the Discord bot's AI assistant. */
export const STOCK_LABEL: Record<StockStatus, string> = { "in-stock": "In stock", "low-stock": "Low stock", preorder: "Pre-order", "sold-out": "Sold out" };

/** Most units of one product (all options combined) a single order may hold. Enforced at checkout. */
export const MAX_QTY = 10;

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

/**
 * One product page's long and identity fields (getProductDetail). Loaded on their own, never on Product, so the
 * shop grid, the menu and related-product cards don't carry them to the browser.
 */
export interface ProductDetail {
  /** Long description in Markdown, tokens not yet filled. Empty when none is written. */
  description: string;
  brand?: string;
  mpn?: string;
  gtin?: string;
  /** ISO time of the last change to the product's copy or images: sitemap lastmod, JSON-LD dateModified. */
  contentUpdatedAt?: string;
  /** Offer.priceValidUntil (YYYY-MM-DD, the end of next year), worked out in the cache: pages can't read the clock while prerendering. */
  priceValidUntil: string;
}

/** A category page's own copy (getCategoryPage). */
export interface CategoryPage extends CategoryInfo {
  /** Markdown, tokens not yet filled. Empty when none is written. */
  intro: string;
  seoTitle?: string;
  seoDescription?: string;
  /** ISO time of the last change to the category's copy. */
  contentUpdatedAt?: string;
}

/** The header's Shop menu: the categories that have products, and Ferrum to feature. */
export interface ShopMenu {
  categories: (CategoryInfo & { count: number })[];
  featured: Pick<Product, "slug" | "name" | "tagline" | "price" | "compareAt" | "visual"> | null;
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

/**
 * Categories a product may suggest after its own: DMA cards and their accessories go together; fusers, input
 * devices and bundles stay within their own category. Related blocks never mix product families.
 */
const RELATED_CATEGORIES: Record<string, string[]> = { dma: ["accessory"], accessory: ["dma"] };

export function relatedProducts(all: Product[], product: Product, count = 4) {
  const others = all.filter((p) => p.slug !== product.slug);
  const extra = RELATED_CATEGORIES[product.category] ?? [];
  return [...others.filter((p) => p.category === product.category), ...others.filter((p) => extra.includes(p.category))].slice(0, count);
}
