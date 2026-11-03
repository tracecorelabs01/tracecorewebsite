// Placeholders in editable copy that are filled in when the copy is shown, so amounts, prices and stock never go
// stale or disagree with Settings and the product pages. Used by the legal pages, the FAQ, the announcement bar,
// guides, category intros and product descriptions. Pure: no server-only import, so client components use it too.
//
//   {{freeShippingThreshold}}  {{flatShipping}}  {{supportEmail}}   from Settings
//   {{price:<product-slug>}}  {{stock:<product-slug>}}               from the catalogue (public price, "In stock"...)
//
// A token that can't be filled (unknown name, product not on sale) is left as written, and reported in development.

import { STOCK_LABEL, type Product } from "@/lib/catalog/types";
import type { StoreSettings } from "@/lib/settings-defaults";
import { formatPrice } from "@/lib/utils";

export interface TokenContext {
  settings?: Pick<StoreSettings, "freeShippingThreshold" | "flatShipping" | "supportEmail">;
  /** Products on sale, for {{price:...}} and {{stock:...}}. getTokenContext() in src/lib/catalog/server.ts builds the whole context. */
  products?: readonly Pick<Product, "slug" | "price" | "status">[];
}

const TOKEN = /\{\{\s*([a-zA-Z]+)(?::([a-z0-9-]+))?\s*\}\}/g;

function tokenValue(name: string, arg: string | undefined, ctx: TokenContext): string | undefined {
  const { settings } = ctx;
  if (arg === undefined) {
    if (name === "freeShippingThreshold" && settings) return formatPrice(settings.freeShippingThreshold);
    if (name === "flatShipping" && settings) return formatPrice(settings.flatShipping);
    if (name === "supportEmail" && settings) return settings.supportEmail;
    return undefined;
  }
  const product = ctx.products?.find((p) => p.slug === arg);
  if (!product) return undefined;
  if (name === "price") return formatPrice(product.price);
  if (name === "stock") return STOCK_LABEL[product.status];
  return undefined;
}

/** `text` with every token it has a value for filled in; the rest stay as written. */
export function fillTokens(text: string, ctx: TokenContext): string {
  return text.replace(TOKEN, (token: string, name: string, arg: string | undefined) => {
    const value = tokenValue(name, arg, ctx);
    if (value === undefined && process.env.NODE_ENV !== "production") console.warn(`[tokens] can't fill ${token}: unknown token or product`);
    return value ?? token;
  });
}

/** The tokens in `text` that fillTokens would leave as written, e.g. a misspelt name or a product that's not on sale. */
export function unknownTokens(text: string, ctx: TokenContext): string[] {
  return [...new Set([...text.matchAll(TOKEN)].filter((m) => tokenValue(m[1], m[2], ctx) === undefined).map((m) => m[0]))];
}
