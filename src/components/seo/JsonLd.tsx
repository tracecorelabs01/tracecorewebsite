import type { JsonLdNode } from "@/lib/jsonld";

/**
 * Structured data for search engines, rendered by a server component (build the nodes with src/lib/jsonld.ts).
 * Several nodes become one @graph; nulls are skipped. `<` is escaped so no text can close the script tag
 * (node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 */
export function JsonLd({ data }: { data: JsonLdNode | null | undefined | (JsonLdNode | null | undefined)[] }) {
  const nodes = (Array.isArray(data) ? data : [data]).filter((n): n is JsonLdNode => Boolean(n));
  if (!nodes.length) return null;
  const doc = nodes.length === 1 ? { "@context": "https://schema.org", ...nodes[0] } : { "@context": "https://schema.org", "@graph": nodes };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(doc).replace(/</g, "\\u003c") }} />;
}
