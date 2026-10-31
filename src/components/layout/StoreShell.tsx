import type { ReactNode } from "react";
import type { PublicSettings } from "@/lib/settings-defaults";
import { Providers } from "./Providers";
import { Preloader } from "./Preloader";
import { Header } from "./Header";
import { MobileMenu } from "./MobileMenu";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { Cursor } from "./Cursor";
import { StoreSettingsProvider } from "./StoreSettings";
import { ReferralTracker } from "@/components/partners/ReferralTracker";

/** Storefront chrome: smooth scroll, intro, header, cart, footer. Not used by /admin. */
export function StoreShell({ settings, children }: { settings: PublicSettings; children: ReactNode }) {
  return (
    <StoreSettingsProvider value={settings}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-fg focus:px-5 focus:py-3 focus:text-ink-950">
        Skip to content
      </a>
      <Providers>
        <Preloader />
        <Header />
        <MobileMenu />
        <main id="main" className="relative">
          {children}
        </main>
        <Footer />
        <CartDrawer />
        <ReferralTracker />
        <Cursor />
      </Providers>
      <div className="grain" aria-hidden />
    </StoreSettingsProvider>
  );
}
