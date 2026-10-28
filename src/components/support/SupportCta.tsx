"use client";

import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/motion";
import { useStoreSettings } from "@/components/layout/StoreSettings";

export function SupportCta() {
  const { links } = useStoreSettings();
  return (
    <section className="container-x pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-brand-diag p-8 md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(120deg,transparent_0px,transparent_22px,rgb(255_255_255/0.06)_22px,rgb(255_255_255/0.06)_44px)]" />
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="type-h2 text-white">Still need a hand?</h2>
              <p className="mt-3 max-w-lg text-white/85">Message the team on Discord or send us a ticket — real people, seven days a week.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={links.discord} target="_blank" rel="noreferrer" variant="light" size="lg" icon={<DiscordIcon className="size-4" />}>
                Open Discord
              </ButtonLink>
              <ButtonLink href="/support" variant="ghost" size="lg">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
