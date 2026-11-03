// Structured data (schema.org JSON-LD): plain objects for <JsonLd> (src/components/seo/JsonLd.tsx). Pure: callers
// pass the catalogue, settings and guide data in. Every text value passes the content guard: a blocked string is
// dropped and logged, never thrown, so one bad row can't fail a prerender.
//
// Left out on purpose: MerchantReturnPolicy (no return-policy markup until there is legal advice on withdrawal
// rights), FAQPage and HowTo, a SearchAction, and ratings from anything but first-party reviews.

import type { Product, ProductDetail, StockStatus } from "@/lib/catalog/types";
import { guarded } from "@/lib/content-guard";
import { EMBARGOED, shipCountryCodes } from "@/lib/countries";
import type { MarkdownVideo } from "@/lib/markdown";
import { metaDescription } from "@/lib/seo";
import type { StoreSettings } from "@/lib/settings-defaults";
import { site } from "@/lib/site";
import { fillTokens, type TokenContext } from "@/lib/tokens";
import { WARRANTY_MONTHS } from "@/lib/warranty";

export type JsonLdNode = { "@type": string } & Record<string, unknown>;

export const ORGANIZATION_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const productLdId = (slug: string) => `${site.url}/product/${slug}#product`;

/** Absolute URL for a site path (or an absolute URL as it is). */
const abs = (path: string) => (path === "/" ? site.url : new URL(path, site.url).toString());
const ref = (id: string) => ({ "@id": id });
const SCHEMA = "https://schema.org/";

/** Topics the store's copy and guides cover, from the SEO plan's keyword and entity pairs (one family per entry). */
const KNOWS_ABOUT = [
  "FPGA DMA cards",
  "PCIe DMA hardware",
  "Xilinx Artix-7 FPGA development boards",
  "PCILeech-compatible hardware",
  "MemProcFS",
  "Memory forensics",
  "Live memory acquisition",
  "Incident response",
  "Hardware debugging",
  "FT601 USB 3 data link",
  "Video fusers",
  "Stream overlays",
  "Chroma key",
  "Picture-in-picture",
  "HDMI 2.1 and DisplayPort 1.4 video",
  "USB input passthrough devices",
  "USB polling rate",
];

const AVAILABILITY: Record<StockStatus, string> = {
  "in-stock": `${SCHEMA}InStock`,
  "low-stock": `${SCHEMA}LimitedAvailability`,
  preorder: `${SCHEMA}PreOrder`,
  "sold-out": `${SCHEMA}OutOfStock`,
};



/** Drops every string (at any depth) that the content guard blocks, and undefined values. */
function clean<T>(value: T, where: string): T | undefined {
  if (typeof value === "string") return guarded(value, where) as T | undefined;
  if (Array.isArray(value)) return value.map((v, i) => clean(v, `${where}[${i}]`)).filter((v) => v !== undefined) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const kept = key.startsWith("@") ? v : clean(v, `${where}.${key}`);
      if (kept !== undefined) out[key] = kept;
    }
    return out as T;
  }
  return value;
}
const node = (data: JsonLdNode, where: string) => clean(data, where) as JsonLdNode;

/** A real profile page: http(s) with a path, not a bare domain left in Settings as a placeholder. */
function isProfile(url: string) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.pathname.replace(/\/+$/, "") !== "";
  } catch {
    return false;
  }
}

/** The social links in Settings that are real profiles, Discord first. */
export function profileLinks(links: StoreSettings["links"]): string[] {
  return [links.discord, links.youtube, links.x, links.tiktok].filter(isProfile);
}

function contactPoints(settings: Pick<StoreSettings, "supportEmail" | "links">) {
  const discord = isProfile(settings.links.discord) ? settings.links.discord : null;
  return [
    { "@type": "ContactPoint", contactType: "customer support", email: settings.supportEmail, availableLanguage: ["English"] },
    ...(discord ? [{ "@type": "ContactPoint", contactType: "technical support", url: discord, availableLanguage: ["English"] }] : []),
  ];
}

/** The store itself (home page; other pages refer to it by ORGANIZATION_ID). */
export function organizationLd(settings: Pick<StoreSettings, "supportEmail" | "links">): JsonLdNode {
  const sameAs = profileLinks(settings.links);
  return node(
    {
      "@type": "OnlineStore",
      "@id": ORGANIZATION_ID,
      name: site.name,
      alternateName: "TraceCore Lab",
      url: site.url,
      logo: abs("/icon.png"),
      image: abs("/opengraph-image.png"),
      description: site.scopeStatement,
      email: settings.supportEmail,
      ...(sameAs.length ? { sameAs } : {}),
      contactPoint: contactPoints(settings),
      knowsAbout: KNOWS_ABOUT,
      // Ships worldwide (every country at checkout; /shipping lists them by region).
      areaServed: "Worldwide",
    },
    "Organization",
  );
}

/** The website (home page). No SearchAction: the store has no site search URL. */
export function websiteLd(): JsonLdNode {
  return node({ "@type": "WebSite", "@id": WEBSITE_ID, url: site.url, name: site.name, inLanguage: "en", publisher: ref(ORGANIZATION_ID) }, "WebSite");
}

export interface ProductLdInput {
  product: Product;
  /** From getProductDetail(): description, brand, MPN, GTIN, dates and priceValidUntil. */
  detail?: ProductDetail | null;
  /** Shipping amounts and the values for tokens in the copy: pass getTokenContext(). */
  tokens: TokenContext & { settings: Pick<StoreSettings, "freeShippingThreshold" | "flatShipping" | "supportEmail"> };
  /** ISO codes the store ships to (shipCountryCodes(settings.shipExcluded)). Default: every country except the embargoed ones. */
  shipTo?: string[];
  /** First-party reviews only (Product.rating and reviewCount from getCatalog() are). Omit when there are none. */
  rating?: { average: number; count: number } | null;
}

/** Product with its Offer (USD price, stock, shipping to the checkout countries, warranty). Null if its name is blocked. */
export function productLd({ product, detail, tokens, rating, shipTo = shipCountryCodes(EMBARGOED) }: ProductLdInput): JsonLdNode | null {
  const name = guarded(product.name, `Product ${product.slug} name`);
  if (!name) return null;
  const url = abs(`/product/${product.slug}`);
  const { settings } = tokens;
  const text = product.summary || detail?.description || product.tagline;
  const images = (product.gallery ?? [product.visual]).flatMap((v) => (v.kind === "image" ? [abs(v.src)] : []));
  return node(
    {
      "@type": "Product",
      "@id": productLdId(product.slug),
      sku: product.slug,
      name,
      url,
      description: text ? metaDescription(fillTokens(text, tokens)) : undefined,
      image: images.length ? images : undefined,
      brand: detail?.brand ? { "@type": "Brand", name: detail.brand } : undefined,
      mpn: detail?.mpn,
      gtin: detail?.gtin,
      category: product.categoryLabel,
      ...(rating && rating.count > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 } }
        : {}),
      offers: {
        "@type": "Offer",
        url,
        price: product.price.toFixed(2),
        priceCurrency: site.currency,
        priceValidUntil: detail?.priceValidUntil,
        availability: AVAILABILITY[product.status],
        itemCondition: `${SCHEMA}NewCondition`,
        seller: ref(ORGANIZATION_ID),
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: { "@type": "MonetaryAmount", value: product.price >= settings.freeShippingThreshold ? 0 : settings.flatShipping, currency: site.currency },
          shippingDestination: shipTo.map((code) => ({ "@type": "DefinedRegion", addressCountry: code })),
          // As the shipping policy states: dispatched within 1 business day, delivered in 3 to 7 business days.
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
          },
        },
        warranty: { "@type": "WarrantyPromise", durationOfWarranty: { "@type": "QuantitativeValue", value: WARRANTY_MONTHS, unitCode: "MON" } },
      },
    },
    `Product ${product.slug}`,
  );
}

/** Breadcrumb trail, home first. The last item (the page itself) may leave out its path. */
export function breadcrumbLd(items: { name: string; path?: string }[]): JsonLdNode {
  return node(
    {
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.path ? abs(item.path) : undefined })),
    },
    "BreadcrumbList",
  );
}

/** An ordered list of pages (products in a category, guides in a section). */
export function itemListLd(items: { name: string; path: string }[]): JsonLdNode {
  return node(
    {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, url: abs(item.path), name: item.name })),
    },
    "ItemList",
  );
}

/** A page that lists products or guides (/shop, /shop/<category>, /guides), with the list as its main entity. */
export function collectionPageLd(page: { path: string; name: string; description?: string; dateModified?: string; items?: { name: string; path: string }[] }): JsonLdNode {
  return node(
    {
      "@type": "CollectionPage",
      "@id": `${abs(page.path)}#page`,
      url: abs(page.path),
      name: page.name,
      description: page.description ? metaDescription(page.description) : undefined,
      dateModified: page.dateModified,
      inLanguage: "en",
      isPartOf: ref(WEBSITE_ID),
      mainEntity: page.items ? itemListLd(page.items) : undefined,
    },
    `CollectionPage ${page.path}`,
  );
}

export interface TechArticleLdInput {
  path: string;
  headline: string;
  description?: string;
  /** Cover image path or URL. */
  image?: string;
  /** ISO times. */
  datePublished?: string;
  dateModified?: string;
  /** The products the guide covers. */
  about?: Pick<Product, "slug" | "name">[];
  /** Section label, e.g. "DMA cards". */
  section?: string;
}

/** A guide. Author and publisher are the store (guides carry no personal bylines). */
export function techArticleLd(article: TechArticleLdInput): JsonLdNode {
  const url = abs(article.path);
  return node(
    {
      "@type": "TechArticle",
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: article.headline,
      description: article.description ? metaDescription(article.description) : undefined,
      image: article.image ? [abs(article.image)] : undefined,
      datePublished: article.datePublished,
      dateModified: article.dateModified ?? article.datePublished,
      author: ref(ORGANIZATION_ID),
      publisher: ref(ORGANIZATION_ID),
      about: article.about?.length ? article.about.map((p) => ({ "@id": productLdId(p.slug), name: p.name, url: abs(`/product/${p.slug}`) })) : undefined,
      articleSection: article.section,
      inLanguage: "en",
      isPartOf: ref(WEBSITE_ID),
    },
    `TechArticle ${article.path}`,
  );
}

/** /about: the page about the store. */
export function aboutPageLd(page: { path?: string; name: string; description?: string }): JsonLdNode {
  const url = abs(page.path ?? "/about");
  return node(
    { "@type": "AboutPage", "@id": `${url}#page`, url, name: page.name, description: page.description, inLanguage: "en", isPartOf: ref(WEBSITE_ID), mainEntity: ref(ORGANIZATION_ID) },
    "AboutPage",
  );
}

/** /support: how to reach the store (email, and Discord when its invite is set). */
export function contactPageLd(page: { path?: string; name: string; description?: string; settings: Pick<StoreSettings, "supportEmail" | "links"> }): JsonLdNode {
  const url = abs(page.path ?? "/support");
  return node(
    {
      "@type": "ContactPage",
      "@id": `${url}#page`,
      url,
      name: page.name,
      description: page.description,
      inLanguage: "en",
      isPartOf: ref(WEBSITE_ID),
      mainEntity: { "@id": ORGANIZATION_ID, contactPoint: contactPoints(page.settings) },
    },
    "ContactPage",
  );
}

/** A free in-browser tool (e.g. the pixel clock calculator). */
export function webApplicationLd(app: { path: string; name: string; description: string }): JsonLdNode {
  return node(
    {
      "@type": "WebApplication",
      url: abs(app.path),
      name: app.name,
      description: metaDescription(app.description),
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: site.currency },
      publisher: ref(ORGANIZATION_ID),
      inLanguage: "en",
    },
    `WebApplication ${app.path}`,
  );
}

/**
 * A YouTube video embedded in a guide (a ```youtube block, see extractVideos). Null without an upload date: search
 * engines require one, so give the block a "date:" line.
 */
export function videoObjectLd(video: MarkdownVideo, fallback: { name: string; description: string }): JsonLdNode | null {
  if (!video.date) return null;
  const name = video.title ?? fallback.name;
  return node(
    {
      "@type": "VideoObject",
      name,
      description: metaDescription(fallback.description || name),
      thumbnailUrl: [`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`],
      uploadDate: video.date,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    },
    `VideoObject ${video.id}`,
  );
}
