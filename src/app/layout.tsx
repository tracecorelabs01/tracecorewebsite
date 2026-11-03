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
const introScript = `try{if(location.pathname!=='/'||sessionStorage.getItem('tc-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.intro='done'}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${anton.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
