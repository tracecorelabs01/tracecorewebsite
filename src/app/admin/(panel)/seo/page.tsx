import Link from "next/link";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { categories, getDb, productImages, products } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { findBlocked, findLiteralPrices } from "@/lib/content-guard";
import { listGuidesForAdmin } from "@/lib/guides";
import { findPlaceholders, plainText } from "@/lib/markdown";

export const metadata: Metadata = { title: "SEO" };
// Admin pages read the session and live data on every request.
export const instant = false;

// What search results show well: the same ranges as the counters in src/components/admin/SeoFields.tsx.
const TITLE = { min: 50, max: 65 };
const DESCRIPTION = { min: 140, max: 160 };
const MIN_WORDS = 300;

type Row = { key: string; kind: "Product" | "Category" | "Guide"; name: string; path: string; edit: string; status?: string; warnings: string[] };

const words = (markdown: string | null) => (markdown ? plainText(markdown).split(" ").filter(Boolean).length : 0);
const quoted = (items: string[]) => items.map((t) => `“${t}”`).join(", ");

/**
 * Title and description warnings for what the page really shows: the SEO field, or the fallback the storefront
 * uses when it's empty (flattened to one line, as the page does).
 */
function metaWarnings(seoTitle: string | null, titleFallback: string, seoDescription: string | null, descriptionFallback: string) {
  const out: string[] = [];
  const title = (seoTitle?.trim() || titleFallback).replace(/\s+/g, " ").trim();
  const from = (own: string | null | undefined) => (own?.trim() ? "" : ", from the fallback");
  if (!title) out.push("No title");
  else if (title.length < TITLE.min) out.push(`Title short (${title.length}${from(seoTitle)})`);
  else if (title.length > TITLE.max) out.push(`Title long (${title.length}${from(seoTitle)})`);
  const description = plainText(seoDescription?.trim() || descriptionFallback);
  if (!description) out.push("No meta description");
  else if (description.length < DESCRIPTION.min) out.push(`Description short (${description.length}${from(seoDescription)})`);
  else if (description.length > DESCRIPTION.max) out.push(`Description long (${description.length}${from(seoDescription)}, cut to 158 on the page)`);
  if (seoDescription && /[\r\n]/.test(seoDescription)) out.push("SEO description has line breaks (save it again to make it one line)");
  return out;
}

/** Excluded terms anywhere in the text a page publishes (src/lib/content-guard.ts). */
function wordingWarnings(texts: (string | null | undefined)[]) {
  const terms = findBlocked(texts.filter(Boolean).join("\n"));
  return terms.length ? [`Excluded terms: ${quoted(terms)}`] : [];
}

/** Literal prices and unfilled placeholders in Markdown copy. */
function markdownWarnings(label: string, markdown: string | null) {
  if (!markdown) return [];
  const out: string[] = [];
  const prices = findLiteralPrices(markdown);
  if (prices.length) out.push(`Literal price in ${label}: ${quoted(prices)} (use {{price:<slug>}})`);
  const blanks = findPlaceholders(markdown);
  if (blanks.length) out.push(`Placeholder in ${label}: ${quoted(blanks)}`);
  return out;
}

export default async function SeoHealthPage() {
  await requireAdmin("admin");
  const db = getDb();
  const [productRows, images, categoryRows, guides] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
    db.select({ productId: productImages.productId, alt: productImages.alt }).from(productImages),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
    listGuidesForAdmin(),
  ]);
  const now = new Date();

  const covered = new Set(guides.filter((g) => g.status === "published").flatMap((g) => g.relatedProducts));
  const altsById = new Map<number, string[]>();
  for (const img of images) altsById.set(img.productId, [...(altsById.get(img.productId) ?? []), img.alt.trim()]);

  const productList: Row[] = productRows.map((p) => {
    const alts = altsById.get(p.id) ?? [];
    const noAlt = alts.filter((a) => !a).length;
    const nameAlt = alts.filter((a) => a && a.toLowerCase() === p.name.trim().toLowerCase()).length;
    const descriptionWords = words(p.description);
    const warnings = [
      // Same fallbacks as the product page: the name, then the summary or tagline.
      ...metaWarnings(p.seoTitle, p.name, p.seoDescription, p.summary || p.tagline),
      ...wordingWarnings([p.name, p.tagline, p.summary, p.description, p.brand, p.mpn, p.badge, p.seoTitle, p.seoDescription, p.optionName, ...(p.highlights ?? []), ...(p.inTheBox ?? []), ...(p.optionValues ?? []), ...(p.specs ?? []).map((s) => `${s.label}: ${s.value}`), ...alts]),
      ...markdownWarnings("description", p.description),
      ...(noAlt ? [`${noAlt} photo${noAlt === 1 ? "" : "s"} with no alt text`] : []),
      ...(nameAlt ? [`${nameAlt} photo${nameAlt === 1 ? "" : "s"} with the name as alt text`] : []),
      ...(p.brand ? [] : ["No brand"]),
      ...(descriptionWords < MIN_WORDS ? [descriptionWords ? `Long description ${descriptionWords} words (aim for ${MIN_WORDS}+)` : "No long description"] : []),
      ...(covered.has(p.slug) ? [] : ["No published guide covers it"]),
    ];
    return { key: `p${p.id}`, kind: "Product", name: p.name, path: `/product/${p.slug}`, edit: `/admin/products/${p.id}`, status: p.status, warnings };
  });

  const categoryList: Row[] = categoryRows.map((c) => ({
    key: `c${c.id}`,
    kind: "Category",
    name: c.name,
    path: `/shop/${c.slug}`,
    edit: `/admin/categories#category-${c.id}`,
    warnings: [
      // Same fallbacks as the category page: the name, then the short description or the intro.
      ...metaWarnings(c.seoTitle, c.name, c.seoDescription, c.blurb || c.intro || ""),
      ...wordingWarnings([c.name, c.blurb, c.intro, c.seoTitle, c.seoDescription]),
      ...markdownWarnings("intro", c.intro),
    ],
  }));

  const guideList: Row[] = guides.map((g) => ({
    key: `g${g.id}`,
    kind: "Guide",
    name: g.title,
    path: `/guides/${g.slug}`,
    edit: `/admin/guides/${g.id}`,
    status: g.status,
    warnings: [
      // A guide's description field is its meta description; it has no fallback.
      ...metaWarnings(g.seoTitle, g.title, g.description, ""),
      ...wordingWarnings([g.title, g.seoTitle, g.description, g.body, g.coverAlt]),
      ...markdownWarnings("body", g.body),
      ...(g.coverUrl && !g.coverAlt.trim() ? ["Cover image has no alt text"] : []),
      ...(g.status === "published" && g.reviewDue && new Date(g.reviewDue) < now ? ["Review overdue"] : []),
    ],
  }));

  // Pages with the most to fix first, within each type.
  const rows = [productList, categoryList, guideList].flatMap((list) => list.toSorted((a, b) => b.warnings.length - a.warnings.length));
  const flagged = rows.filter((r) => r.warnings.length).length;

  return (
    <>
      <PageHeader
        title="SEO"
        description={`${flagged} of ${rows.length} page${rows.length === 1 ? "" : "s"} have something to fix. Titles aim for ${TITLE.min} to ${TITLE.max} characters and descriptions for ${DESCRIPTION.min} to ${DESCRIPTION.max}, counting the fallback a page uses when its SEO field is empty.`}
      />
      <Card padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Page</Th>
              <Th>Type</Th>
              <Th>Warnings</Th>
              <Th className="text-right">
                <span className="sr-only">Edit</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <Td className="align-top">
                  <p className="font-medium">{r.name}</p>
                  <p className="font-mono text-xs text-dim">{r.path}</p>
                </Td>
                <Td className="align-top">
                  <span className="flex flex-wrap gap-1.5">
                    <Badge>{r.kind}</Badge>
                    {r.status && r.status !== "active" && r.status !== "published" && <Badge tone="warn">{r.status}</Badge>}
                  </span>
                </Td>
                <Td className="align-top">
                  {r.warnings.length ? (
                    <ul className="space-y-1 text-[13px] text-muted">
                      {r.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <Badge tone="ok">Good</Badge>
                  )}
                </Td>
                <Td className="text-right align-top">
                  <Link href={r.edit} className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
