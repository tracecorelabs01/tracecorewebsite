import { Hero } from "@/components/home/Hero";
import { TickerBands } from "@/components/home/TickerBands";
import { VideoReveal } from "@/components/home/VideoReveal";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { WhyUs } from "@/components/home/WhyUs";
import { SequenceScroll } from "@/components/home/SequenceScroll";
import { Reviews } from "@/components/home/Reviews";
import { PartnerCta } from "@/components/home/PartnerCta";
import { FaqPreview } from "@/components/home/FaqPreview";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import type { Metadata } from "next";
import { getCatalog, getReviewsData } from "@/lib/catalog/server";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: { absolute: `${site.name} | FPGA DMA Cards, Video Fusers and USB Passthrough` },
  description:
    "Shop lab-tested PCIe DMA cards on Xilinx Artix-7, HDMI and DisplayPort video fusers and USB input passthrough devices, with setup guides and worldwide shipping.",
  path: "/",
});

export default async function Home() {
  const [{ products, categories }, { reviews, summary }] = await Promise.all([getCatalog(), getReviewsData()]);
  const ferrum = products.find((p) => p.slug === "ferrum");
  const card = products.find((p) => p.slug === "tracecore-75t");

  return (
    <>
      <Hero rating={summary} ferrumPrice={ferrum?.price} cardPrice={card?.price} />
      <TickerBands />
      <VideoReveal />
      <FeaturedProducts products={products} categories={categories} />
      <CategoryTiles counts={Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => p.category === c.id).length]))} />
      <WhyUs />
      <SequenceScroll />
      <Reviews reviews={reviews} summary={summary} />
      <PartnerCta />
      <FaqPreview />
    </>
  );
}
