"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon, TikTokIcon, XIcon, YouTubeIcon } from "@/components/ui/icons";
import { Magnetic, RevealLines } from "@/components/ui/motion";
import { subscribe } from "@/actions/store";
import { site } from "@/lib/site";
import { useStoreSettings } from "./StoreSettings";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/shop" },
      { label: "DMA cards", href: "/shop?category=dma" },
      { label: "Input devices", href: "/shop?category=input" },
      { label: "Bundles", href: "/shop?category=bundle" },
      { label: "Accessories", href: "/shop?category=accessory" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Contact support", href: "/support" },
      { label: "Shipping", href: "/faq#shipping" },
      { label: "Warranty", href: "/faq#warranty" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Refund policy", href: "/legal/refunds" },
    ],
  },
];

export function Footer() {
  const settings = useStoreSettings();
  const socials = [
    { href: settings.links.discord, Icon: DiscordIcon, label: "Discord" },
    { href: settings.links.x, Icon: XIcon, label: "X" },
    { href: settings.links.youtube, Icon: YouTubeIcon, label: "YouTube" },
    { href: settings.links.tiktok, Icon: TikTokIcon, label: "TikTok" },
  ];
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const wordY = useTransform(scrollYProgress, [0.3, 1], ["40%", "0%"]);
  const wordOpacity = useTransform(scrollYProgress, [0.3, 0.9], [0, 1]);

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-line bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(255_61_0/0.22),transparent_70%)]" />

      {/* CTA */}
      <div className="container-x relative pt-24 md:pt-32">
        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <RevealLines
            className="type-h1 max-w-4xl"
            lines={[
              "Step into",
              <span key="l2">
                the <span className="text-gradient">lab.</span>
              </span>,
            ]}
          />
          <div className="flex flex-wrap gap-3">
            <Magnetic>
              <ButtonLink href="/shop" size="lg">
                Shop hardware
              </ButtonLink>
            </Magnetic>
            <Magnetic>
              <ButtonLink href={settings.links.discord} target="_blank" rel="noreferrer" variant="ghost" size="lg" icon={<DiscordIcon className="size-4" />}>
                Join Discord
              </ButtonLink>
            </Magnetic>
          </div>
        </div>

        <div className="mt-20 grid gap-12 border-t border-line pt-14 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <LogoMark className="h-9" />
              <span className="font-display text-3xl uppercase">
                <span className="text-gradient">TraceCore</span>
                <span className="text-silver">Lab</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-muted">{site.description}</p>
            <Newsletter />
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:justify-items-end">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="type-kicker text-dim">{col.title}</h3>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-2 text-fg/80 transition-colors hover:text-fg">
                        <span className="h-px w-0 bg-brand transition-all duration-300 group-hover:w-3" />
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-line py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {settings.payments.map((p) => (
              <span key={p} className="rounded-md border border-line-strong bg-ink-850 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {socials.map(({ href, Icon, label }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-fg">
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Giant wordmark */}
      <div className="relative select-none overflow-hidden" aria-hidden>
        <motion.div style={{ y: wordY, opacity: wordOpacity }} className="whitespace-nowrap text-center font-display text-[18.5vw] uppercase leading-[0.78] tracking-[-0.01em]">
          <span className="bg-[linear-gradient(180deg,#ff3a00_0%,#ff1408_40%,rgb(255_20_8/0.05)_100%)] bg-clip-text text-transparent">TraceCore</span>
          <span className="bg-[linear-gradient(180deg,#e9eaec_0%,rgb(233_234_236/0.05)_100%)] bg-clip-text text-transparent">Lab</span>
        </motion.div>
      </div>
      <div className="container-x relative flex flex-col items-center justify-between gap-2 border-t border-line py-5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim sm:flex-row">
        <span>
          © 2026 {site.name}. All rights reserved.
        </span>
        <span>{site.domain}</span>
      </div>
    </footer>
  );
}

function Newsletter() {
  const [state, formAction, pending] = useActionState(subscribe, null);
  const done = state?.ok === true;

  return (
    <form action={formAction} className="mt-8 max-w-md">
      <label htmlFor="newsletter" className="type-kicker text-dim">
        Restock alerts & drops
      </label>
      <div className="mt-3 flex h-12 items-center rounded-full border border-line-strong bg-ink-900 pl-5 pr-1.5 transition-colors focus-within:border-blaze">
        <input id="newsletter" name="email" type="email" required placeholder="you@email.com" disabled={done} className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-dim" />
        <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button type="submit" disabled={done || pending} aria-label="Subscribe" className="grid size-9 place-items-center rounded-full bg-brand text-white transition-transform hover:scale-105 disabled:opacity-100">
          {pending ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
        </button>
      </div>
      <p className={`mt-2 min-h-4 text-xs ${state && !state.ok ? "text-ember" : "text-muted"}`} aria-live="polite">
        {state?.message ?? ""}
      </p>
    </form>
  );
}
