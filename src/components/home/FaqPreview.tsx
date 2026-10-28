"use client";

import { quickFaq } from "@/data/faq";
import { Accordion, Kicker } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon } from "@/components/ui/icons";
import { Reveal, RevealLines } from "@/components/ui/motion";
import { useStoreSettings } from "@/components/layout/StoreSettings";

export function FaqPreview() {
  const { links } = useStoreSettings();
  return (
    <section className="relative py-28 md:py-36" aria-labelledby="faq-heading">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Kicker index="06">Quick answers</Kicker>
          <RevealLines as="h2" className="type-h2 mt-5" lines={[<span key="a" id="faq-heading">Got</span>, <span key="b" className="text-gradient">questions?</span>]} />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-muted">The essentials on ordering, shipping and setup. Can&apos;t find what you need? 24/7 support is a message away.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/faq" variant="ghost">
                View all FAQ
              </ButtonLink>
            </div>
            <a
              href={links.discord}
              target="_blank"
              rel="noreferrer"
              className="group mt-10 flex max-w-md items-center gap-5 rounded-3xl border border-line bg-ink-900/70 p-5 transition-colors hover:border-blaze/50"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#5865F2] text-white shadow-[0_10px_30px_-8px_rgb(88_101_242/0.7)] transition-transform group-hover:-rotate-6 group-hover:scale-105">
                <DiscordIcon className="size-7" />
              </span>
              <span>
                <span className="block font-display text-2xl uppercase">24/7 support</span>
                <span className="text-sm text-muted">Reach us on Discord any time, day or night.</span>
              </span>
            </a>
          </Reveal>
        </div>
        <Reveal className="lg:col-span-7" delay={0.15}>
          <Accordion items={quickFaq} />
        </Reveal>
      </div>
    </section>
  );
}
