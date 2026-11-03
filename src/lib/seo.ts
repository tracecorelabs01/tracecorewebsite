// Page metadata. Next merges the metadata of a route's layouts and page shallowly: a page that sets `openGraph`
// replaces the root layout's whole openGraph object, which is how pages lost their og:image. pageMetadata() builds
// the complete set for one page from ogDefaults, with a canonical URL that points at the page itself.
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md, "Merging")

import type { Metadata } from "next";
import { plainText } from "./markdown";
import { site } from "./site";

type OpenGraph = NonNullable<Metadata["openGraph"]>;
export type OgImage = string | { url: string; width?: number; height?: number; alt?: string };

/** The site-wide share image (src/app/opengraph-image.png, 1200x630). */
export const DEFAULT_OG_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630 };

/** What every page's Open Graph tags share. Spread it first, then set the page's own url, title, description and images. */
export const ogDefaults = {
  siteName: site.name,
  locale: "en_US",
  type: "website" as const,
  images: [DEFAULT_OG_IMAGE] as OgImage[],
};

export interface PageMetadataInput {
  /** Filled into the root layout's title template; `{ absolute }` skips the template. */
  title: string | { absolute: string };
  /** Plain text or Markdown; flattened and cut to fit (metaDescription). */
  description?: string;
  /** The page's path, e.g. "/product/tracecore-75t": its canonical URL and og:url (made absolute by metadataBase). */
  path: string;
  /** Share images, 1200x630 PNG or JPEG (not WebP). Default: the site image. */
  images?: OgImage[];
  type?: "website" | "article";
  /** Article dates (ISO) and topics, for type "article". */
  article?: { publishedTime?: string; modifiedTime?: string; section?: string; tags?: string[] };
  /** Keep the page out of search results; links on it are still followed. */
  noindex?: boolean;
}

/** Complete metadata for one page: title, description, self-canonical, Open Graph and Twitter card. */
export function pageMetadata({ title, description, path, images, type = "website", article, noindex }: PageMetadataInput): Metadata {
  const shareTitle = typeof title === "string" ? title : title.absolute;
  const desc = description ? metaDescription(description) || undefined : undefined;
  const shareImages = images?.length ? images : ogDefaults.images;
  const base = { ...ogDefaults, url: path, title: shareTitle, description: desc, images: shareImages };
  const openGraph: OpenGraph = type === "article" ? { ...base, ...article, type: "article" } : { ...base, type: "website" };
  return {
    title,
    ...(desc ? { description: desc } : {}),
    alternates: { canonical: path },
    openGraph,
    twitter: { card: "summary_large_image", title: shareTitle, description: desc, images: shareImages },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * One line for a meta description: Markdown, line breaks and repeated spaces flattened, and cut at a word boundary
 * to at most `max` characters (ending in an ellipsis when cut).
 */
export function metaDescription(text: string, max = 158): string {
  const flat = plainText(text);
  if (flat.length <= max) return flat;
  const room = flat.slice(0, max);
  const lastSpace = room.lastIndexOf(" ");
  // Cut at the last whole word, unless that would throw away most of the text (one very long word).
  const head = lastSpace > max * 0.6 ? room.slice(0, lastSpace) : room.slice(0, max - 1);
  return `${head.replace(/[\s,;:.(\-]+$/, "")}…`;
}
