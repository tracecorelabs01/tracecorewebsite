import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { ogDefaults } from "@/lib/seo";
import { site } from "@/lib/site";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"], display: "swap" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | FPGA DMA Cards, Video Fusers and USB Passthrough`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: { ...ogDefaults, title: `${site.name} | ${site.tagline}`, description: site.description },
  twitter: { card: "summary_large_image" },
  // Search Console and Bing Webmaster Tools ownership tags, set as environment variables on the host.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#060304",
  colorScheme: "dark",
};

// Runs before first paint. The storefront intro plays only when a visit starts on the homepage, once per session,
// and never for reduced-motion users; everywhere else the preloader stays hidden (CSS) so pages paint at once.
// Browser translation (Google Translate, or the browser's own) swaps text nodes React still holds; these guards turn the
// resulting "removeChild/insertBefore of a node that isn't a child" errors into no-ops instead of a crashed page.
const translateGuard = `try{var P=Node.prototype,R=P.removeChild,I=P.insertBefore;P.removeChild=function(c){return c.parentNode!==this?c:R.apply(this,arguments)};P.insertBefore=function(n,r){return r&&r.parentNode!==this?n:I.apply(this,arguments)}}catch(e){}`;

const introScript = `try{if(location.pathname!=='/'||sessionStorage.getItem('tc-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.intro='done'}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${anton.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
        <script dangerouslySetInnerHTML={{ __html: translateGuard }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
