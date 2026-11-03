import "server-only";
import { getCatalog, getProductDetail, getTokenContext } from "@/lib/catalog/server";
import type { Product } from "@/lib/catalog/types";
import { guarded } from "@/lib/content-guard";
import { getGuide, getGuides, GUIDE_SECTION_LABELS, type GuideSection } from "@/lib/guides";
import { LEGAL_DOCS } from "@/lib/legal";
import { plainText } from "@/lib/markdown";
import { site } from "@/lib/site";
import { fillTokens } from "@/lib/tokens";

// /llms.txt and /llms-full.txt (https://llmstxt.org): what the store is and where things are, in Markdown, for AI
// answer engines. Built from the same catalogue and guides as the pages; every line passes the content guard
// (a blocked line is dropped and logged). Product families stay in separate sections.

const url = (path: string) => `${site.url}${path}`;
const line = (text: string | undefined, where: string) => guarded(text, `llms.txt ${where}`);

function productLine(p: Product) {
  const text = line(`- [${p.name}](${url(`/product/${p.slug}`)}): ${p.tagline || plainText(p.summary).slice(0, 140)}`, p.slug);
  return text ? [text] : [];
}

async function sections(full: boolean) {
  const [{ products, categories }, guides, tokens] = await Promise.all([getCatalog(), getGuides(), getTokenContext()]);
  const out: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.scopeStatement}`,
    "",
    `${site.name} (${site.url}) is an online hardware store. Prices are in USD, orders ship worldwide with tracking, every product carries a 3-month warranty, and support is on Discord and by email (${tokens.settings.supportEmail}).`,
    "",
  ];

  for (const c of categories) {
    const items = products.filter((p) => p.category === c.id);
    if (!items.length) continue;
    out.push(`## ${c.label}`, "", line(`${c.blurb} Category page: ${url(`/shop/${c.id}`)}`, c.id) ?? "", "");
    for (const p of items) {
      out.push(...productLine(p));
      if (full) {
        const detail = await getProductDetail(p.slug);
        const body = line(fillTokens(detail?.description || p.summary, tokens), `${p.slug} description`);
        if (body) out.push("", body.trim(), "");
      }
    }
    out.push("");
  }

  const bySection = new Map<GuideSection, typeof guides>();
  for (const g of guides) bySection.set(g.section, [...(bySection.get(g.section) ?? []), g]);
  for (const [section, list] of bySection) {
    out.push(`## Guides: ${GUIDE_SECTION_LABELS[section]}`, "");
    for (const g of list) {
      const entry = line(`- [${g.title}](${url(`/guides/${g.slug}`)}): ${g.description}`, g.slug);
      if (entry) out.push(entry);
      if (full) {
        const guide = await getGuide(g.slug);
        const body = guide && line(fillTokens(guide.body, tokens), `${g.slug} body`);
        if (body) out.push("", `### ${g.title}`, "", body.trim(), "");
      }
    }
    out.push("");
  }

  out.push(
    "## Help and policies",
    "",
    `- [FAQ](${url("/faq")}): orders, shipping, setup and warranty`,
    `- [Worldwide shipping](${url("/shipping")}): countries, delivery times, duties and taxes by region`,
    `- [Support](${url("/support")}): contact the team`,
    `- [Pixel clock calculator](${url("/tools/pixel-clock-calculator")}): check whether a display mode fits HDMI or DisplayPort bandwidth`,
    ...Object.entries(LEGAL_DOCS).map(([slug, title]) => `- [${title}](${url(`/legal/${slug}`)})`),
    "",
  );
  return out.join("\n");
}

export const llmsTxt = () => sections(false);
export const llmsFullTxt = () => sections(true);
