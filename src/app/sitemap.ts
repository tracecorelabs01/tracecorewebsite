import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog/server";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await getCatalog();
  const pages = ["", "/shop", "/build", "/faq", "/support", "/legal/terms", "/legal/privacy", "/legal/refunds"];
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...products.map((p) => ({ url: `${site.url}/product/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
