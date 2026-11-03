import { getCatalog, getProductDetail, getTokenContext } from "@/lib/catalog/server";
import type { StockStatus } from "@/lib/catalog/types";
import { guarded } from "@/lib/content-guard";
import { plainText } from "@/lib/markdown";
import { site } from "@/lib/site";
import { fillTokens } from "@/lib/tokens";

// Product feed for Google Merchant Center and Microsoft Merchant Center (RSS 2.0 with the g: namespace), so products
// can appear in free Shopping listings in every country the store ships to. Prices and availability come from the
// same catalogue as the pages. Shipping and returns are set in the Merchant Center account, not per item.
// Text the content guard blocks is dropped (and logged), never published.

const AVAILABILITY: Record<StockStatus, string> = { "in-stock": "in_stock", "low-stock": "in_stock", preorder: "preorder", "sold-out": "out_of_stock" };

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (path: string) => (path.startsWith("http") ? path : `${site.url}${path}`);
const tag = (name: string, value: string | undefined) => (value ? `<g:${name}>${xml(value)}</g:${name}>` : "");

export async function GET() {
  const [{ products }, tokens] = await Promise.all([getCatalog(), getTokenContext()]);
  const items = await Promise.all(
    products.map(async (p) => {
      const detail = await getProductDetail(p.slug);
      const title = guarded(p.seoTitle || p.name, `feed ${p.slug} title`);
      if (!title) return "";
      const description = guarded(plainText(fillTokens(detail?.description || p.summary || p.tagline, tokens)).slice(0, 5000), `feed ${p.slug} description`);
      const images = (p.gallery ?? [p.visual]).flatMap((v) => (v.kind === "image" ? [abs(v.src)] : []));
      const identified = Boolean(detail?.gtin || detail?.mpn);
      return [
        "<item>",
        tag("id", p.slug),
        tag("title", title.slice(0, 150)),
        tag("description", description),
        tag("link", abs(`/product/${p.slug}`)),
        tag("image_link", images[0]),
        ...images.slice(1, 11).map((src) => tag("additional_image_link", src)),
        tag("availability", AVAILABILITY[p.status]),
        tag("price", `${p.price.toFixed(2)} ${site.currency}`),
        tag("condition", "new"),
        tag("brand", detail?.brand),
        tag("gtin", detail?.gtin),
        tag("mpn", detail?.mpn),
        identified ? "" : tag("identifier_exists", "no"),
        tag("product_type", p.categoryLabel),
        "</item>",
      ].join("");
    }),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${xml(site.name)}</title><link>${site.url}</link><description>${xml(site.description)}</description>${items.join("\n")}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
