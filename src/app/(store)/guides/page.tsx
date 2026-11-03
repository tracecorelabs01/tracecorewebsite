import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { GuideCard, readingMinutes } from "@/components/guides/GuideCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { getGuide, getGuides, GUIDE_SECTION_LABELS, type GuideSection } from "@/lib/guides";
import { breadcrumbLd, collectionPageLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

// The guides hub: the only page that lists every product family's guides, each family in its own section.

const DESCRIPTION =
  "Setup guides for FPGA DMA cards, video fusers and USB passthrough devices: installation, drivers, connection tests, compatibility and troubleshooting, reviewed by the TraceCoreLab team.";

export const metadata: Metadata = pageMetadata({
  title: "DMA Card, Video Fuser and USB Passthrough Setup Guides",
  description: DESCRIPTION,
  path: "/guides",
});

/** Each section's intro and the shop links that belong to it (one family per section, never mixed). */
const SECTIONS: Record<GuideSection, { intro: string; links: { label: string; href: string }[] }> = {
  dma: {
    intro:
      "Install, connect and test PCIe DMA cards built on Xilinx Artix-7 FPGAs, for PCILeech-compatible memory forensics, security research and hardware debugging on computers you own or are authorized to examine.",
    links: [{ label: "Shop DMA cards", href: "/shop/dma" }],
  },
  fuser: {
    intro:
      "Set up HDMI and DisplayPort video fusers for stream overlays, presentation graphics and picture-in-picture, and check which resolutions and refresh rates each link carries.",
    links: [
      { label: "Pixel clock calculator", href: "/tools/pixel-clock-calculator" },
      { label: "Shop video fusers", href: "/shop/fuser" },
    ],
  },
  input: {
    intro: "Wire USB passthrough devices, install their drivers, check the polling rate and fix connection problems.",
    links: [{ label: "Shop USB passthrough devices", href: "/shop/input" }],
  },
  reference: {
    intro: "Terms and definitions used across the guides.",
    links: [],
  },
};

export default async function GuidesPage() {
  const guides = await getGuides();
  // Reading times need the bodies: each guide's cached entry, the same one its page uses.
  const bodies = await Promise.all(guides.map((g) => getGuide(g.slug)));
  const minutes = new Map(bodies.flatMap((g) => (g ? [[g.slug, readingMinutes(g.body)] as const] : [])));
  const sections = (Object.keys(GUIDE_SECTION_LABELS) as GuideSection[])
    .map((key) => ({ key, guides: guides.filter((g) => g.section === key) }))
    .filter((s) => s.guides.length > 0);
  const lastChange = guides.reduce<string | undefined>((max, g) => (g.contentUpdatedAt && (!max || g.contentUpdatedAt > max) ? g.contentUpdatedAt : max), undefined);

  return (
    <>
      <JsonLd
        data={[
          collectionPageLd({
            path: "/guides",
            name: "TraceCoreLab setup guides",
            description: DESCRIPTION,
            dateModified: lastChange,
            items: sections.flatMap((s) => s.guides.map((g) => ({ name: g.title, path: `/guides/${g.slug}` }))),
          }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides" }]),
        ]}
      />
      <PageHero
        kicker="Guides"
        crumbs={[{ label: "Home", href: "/" }, { label: "Guides" }]}
        lines={[
          "Setup guides and",
          <span key="b" className="text-gradient">
            hardware explainers.
          </span>,
        ]}
        description="Install, connect, test and troubleshoot FPGA DMA cards, video fusers and USB passthrough devices, step by step."
      />

      {sections.length > 0 && (
        <nav aria-label="Guide sections" className="container-x pb-4">
          <ul className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <li key={s.key}>
                <a href={`#${s.key}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-fg">
                  {GUIDE_SECTION_LABELS[s.key]}
                  <span className="text-blaze tabular-nums">{s.guides.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="container-x pb-28">
        {sections.length === 0 ? (
          <div className="rounded-3xl border border-line bg-ink-900/60 p-8 text-center md:p-14">
            <h2 className="type-h3">Guides are on their way</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted">
              Our setup guides are being written and checked against the hardware. Until they are published, the{" "}
              <Link href="/faq" className="text-fg underline underline-offset-4 hover:text-blaze">
                FAQ
              </Link>{" "}
              covers the common questions and{" "}
              <Link href="/support" className="text-fg underline underline-offset-4 hover:text-blaze">
                support
              </Link>{" "}
              can help with your setup.
            </p>
          </div>
        ) : (
          sections.map((s) => (
            <section key={s.key} id={s.key} aria-labelledby={`${s.key}-title`} className="scroll-mt-32 border-t border-line pt-12 [&:not(:first-child)]:mt-16">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="max-w-2xl">
                  <h2 id={`${s.key}-title`} className="type-h2">
                    {GUIDE_SECTION_LABELS[s.key]}
                  </h2>
                  <p className="mt-4 text-muted">{SECTIONS[s.key].intro}</p>
                </div>
                {SECTIONS[s.key].links.length > 0 && (
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {SECTIONS[s.key].links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg">
                          {l.label} <ArrowUpRight className="size-3.5 text-blaze" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {s.guides.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} minutes={minutes.get(g.slug)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
