"use client";

import type { PublicReview as Review, ReviewSummary } from "@/lib/catalog/types";
import { Kicker, Stars } from "@/components/ui/bits";
import { CssMarquee } from "@/components/ui/Marquee";
import { Reveal, RevealLines } from "@/components/ui/motion";

export function Reviews({ reviews, summary }: { reviews: Review[]; summary: ReviewSummary | null }) {
  if (reviews.length === 0) return null;
  const half = Math.ceil(reviews.length / 2);
  return (
    <section className="relative overflow-hidden py-28 md:py-36" aria-labelledby="reviews-heading">
      <div className="container-x flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Kicker index="05">Community</Kicker>
          <RevealLines as="h2" className="type-h2 mt-5" lines={[<span key="a" id="reviews-heading">Loved by</span>, <span key="b" className="text-gradient">the community.</span>]} />
        </div>
        {summary && (
          <Reveal delay={0.15}>
            <div className="flex items-center gap-6 rounded-3xl border border-line bg-ink-900/70 px-7 py-5 backdrop-blur">
              <span className="font-display text-7xl leading-none text-gradient">{summary.average}</span>
              <div>
                <Stars rating={summary.average} size={18} />
                <p className="mt-2 text-sm text-muted">
                  Average from {summary.count.toLocaleString("en-US")} review{summary.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </Reveal>
        )}
      </div>

      <div className="mt-16 space-y-5">
        <CssMarquee duration={70}>
          {reviews.slice(0, half).map((r, i) => (
            <ReviewCard key={i} review={r} />
          ))}
        </CssMarquee>
        <CssMarquee duration={80} reverse>
          {reviews.slice(half).map((r, i) => (
            <ReviewCard key={i} review={r} />
          ))}
        </CssMarquee>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initials = review.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <figure className="mr-5 flex w-[340px] shrink-0 flex-col justify-between gap-6 rounded-3xl border border-line bg-ink-900 p-6 transition-colors duration-300 hover:border-blaze/40 md:w-[400px]">
      <div>
        <Stars rating={review.rating} />
        <blockquote className="mt-4 text-[15px] leading-relaxed text-fg/90">&ldquo;{review.text}&rdquo;</blockquote>
      </div>
      <figcaption className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand font-display text-base text-white">{initials}</span>
          <div className="leading-tight">
            <div className="text-sm font-medium">{review.name}</div>
            <div className="font-mono text-[11px] text-dim">{review.handle}</div>
          </div>
        </div>
        <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{review.product}</span>
      </figcaption>
    </figure>
  );
}
