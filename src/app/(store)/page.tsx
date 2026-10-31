import { Hero } from "@/components/home/Hero";
import { TickerBands } from "@/components/home/TickerBands";
import { VideoReveal } from "@/components/home/VideoReveal";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { WhyUs } from "@/components/home/WhyUs";
import { SequenceScroll } from "@/components/home/SequenceScroll";
import { Reviews } from "@/components/home/Reviews";
import { PartnerCta } from "@/components/home/PartnerCta";
import { FaqPreview } from "@/components/home/FaqPreview";
import { getCatalog, getReviewsData } from "@/lib/catalog/server";

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
      <WhyUs />
      <SequenceScroll />
      <Reviews reviews={reviews} summary={summary} />
      <PartnerCta />
      <FaqPreview />
    </>
  );
}
