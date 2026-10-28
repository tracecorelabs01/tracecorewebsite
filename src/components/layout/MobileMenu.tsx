"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon, TikTokIcon, XIcon, YouTubeIcon } from "@/components/ui/icons";
import { EASE_EXPO } from "@/components/ui/motion";
import { site } from "@/lib/site";
import { useUi } from "@/lib/ui-store";
import { useStoreSettings } from "./StoreSettings";

const links = [{ label: "Home", href: "/" }, ...site.nav];

export function MobileMenu() {
  const open = useUi((s) => s.menuOpen);
  const setMenu = useUi((s) => s.setMenu);
  const { links: social } = useStoreSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const onResize = () => window.innerWidth >= 1024 && setMenu(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, setMenu]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          className="fixed inset-0 z-40 flex flex-col bg-ink-950 pt-[96px] lg:hidden"
          initial={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
          animate={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
          exit={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
          transition={{ duration: 0.7, ease: EASE_EXPO }}
          data-lenis-prevent
        >
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50 mask-radial" />
          <div className="pointer-events-none absolute -right-1/3 top-1/4 size-[80vw] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.18),transparent_65%)]" />
          <nav className="container-x relative flex-1 overflow-y-auto" aria-label="Mobile">
            <ul className="flex flex-col">
              {links.map((l, i) => (
                <li key={l.href} className="overflow-hidden border-b border-line">
                  <motion.div initial={{ y: "100%" }} animate={{ y: "0%" }} transition={{ duration: 0.8, ease: EASE_EXPO, delay: 0.12 + i * 0.05 }}>
                    <Link href={l.href} onClick={() => setMenu(false)} className="group flex items-baseline justify-between py-4">
                      <span className="font-display text-5xl uppercase text-fg transition-colors group-active:text-blaze">{l.label}</span>
                      <span className="font-mono text-xs text-dim">0{i + 1}</span>
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
          </nav>
          <motion.div
            className="container-x relative flex items-center justify-between gap-4 py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.45 }}
          >
            <ButtonLink href="/shop" onClick={() => setMenu(false)}>
              Shop now
            </ButtonLink>
            <div className="flex items-center gap-1 text-muted">
              {[
                { href: social.discord, Icon: DiscordIcon, label: "Discord" },
                { href: social.x, Icon: XIcon, label: "X" },
                { href: social.youtube, Icon: YouTubeIcon, label: "YouTube" },
                { href: social.tiktok, Icon: TikTokIcon, label: "TikTok" },
              ].map(({ href, Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full hover:text-fg">
                  <Icon className="size-[18px]" />
                </a>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
