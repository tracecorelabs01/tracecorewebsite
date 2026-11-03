import type { Metadata } from "next";
import { Markdown } from "@/components/content/Markdown";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { aboutPage } from "@/data/about";
import { getTokenContext } from "@/lib/catalog/server";
import { aboutPageLd, breadcrumbLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { fillTokens } from "@/lib/tokens";

export const metadata: Metadata = pageMetadata({
  title: "About TraceCoreLab: Lab-Tested FPGA and Video Hardware",
  description: "TraceCoreLab sells lab-tested PCIe DMA cards, video fusers, USB passthrough devices and accessories, with setup guides, a 3-month warranty and worldwide shipping.",
  path: "/about",
});

export default async function AboutPage() {
  const source = fillTokens(aboutPage, await getTokenContext());
  return (
    <>
      <JsonLd
        data={[
          aboutPageLd({ path: "/about", name: "About TraceCoreLab", description: "What the TraceCoreLab store sells and how it works." }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "About" }]),
        ]}
      />
      <PageHero
        kicker="About"
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        lines={[
          "About",
          <span key="b" className="text-gradient">
            TraceCoreLab.
          </span>,
        ]}
        description="Lab-tested FPGA DMA cards, video fusers, USB input passthrough devices and accessories, with setup guides for each."
      />
      <section className="container-x pb-28">
        <Markdown source={source} className="max-w-3xl" />
      </section>
    </>
  );
}
