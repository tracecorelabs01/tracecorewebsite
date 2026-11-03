import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { PixelClockCalculator } from "@/components/tools/PixelClockCalculator";
import { PageHero } from "@/components/ui/PageHero";
import { breadcrumbLd, webApplicationLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

const PATH = "/tools/pixel-clock-calculator";
const DESCRIPTION =
  "Free pixel clock calculator: work out the pixel clock and data rate of any resolution and refresh rate, and whether HDMI 2.0, HDMI 2.1 or DisplayPort 1.4 carries it uncompressed.";

export const metadata: Metadata = pageMetadata({
  title: "Pixel Clock Calculator for HDMI and DisplayPort Bandwidth",
  description: DESCRIPTION,
  path: PATH,
});

const LINK = "text-fg underline underline-offset-4 hover:text-blaze";

export default function PixelClockCalculatorPage() {
  return (
    <>
      <JsonLd
        data={[
          webApplicationLd({ path: PATH, name: "Pixel clock calculator", description: DESCRIPTION }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: "Pixel clock calculator" }]),
        ]}
      />
      <PageHero
        kicker="Tools"
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: "Pixel clock calculator" },
        ]}
        lines={[
          "Pixel clock",
          <span key="b" className="text-gradient">
            calculator.
          </span>,
        ]}
        description="Check whether a resolution and refresh rate fits through HDMI 2.0, HDMI 2.1 or DisplayPort 1.4 before you connect a monitor through a video fuser."
      />

      <section className="container-x pb-20">
        <PixelClockCalculator />
      </section>

      <section className="container-x pb-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-4 leading-relaxed text-muted lg:col-span-7">
            <h2 className="type-h3 text-fg">How the pixel clock is worked out</h2>
            <p>
              The pixel clock is the number of pixels a link sends each second, blanking included: horizontal total x vertical total x refresh rate. The totals are the
              visible resolution plus the blanking intervals around it. This calculator uses VESA CVT reduced blanking v2, the timing most high refresh rate monitors use:
              80 pixels of horizontal blanking, and a vertical blank of at least 460 microseconds.
            </p>
            <p>
              The data rate is the pixel clock multiplied by the bits per pixel: 24 for 8-bit RGB, 30 for 10-bit. Ten-bit colour needs 1.25 times the bandwidth of the same
              mode in 8-bit.
            </p>
            <h2 className="type-h3 pt-6 text-fg">Link limits</h2>
            <ul className="list-disc space-y-2 pl-5 marker:text-blaze">
              <li>HDMI 2.0: 18 Gbit/s TMDS, about 14.4 Gbit/s of video data (a 600 MHz pixel clock at 8-bit RGB).</li>
              <li>DisplayPort 1.4 (HBR3, four lanes): 32.4 Gbit/s, 25.92 Gbit/s of video data after 8b/10b coding.</li>
              <li>HDMI 2.1 (FRL, four lanes at 12 Gbit/s): 48 Gbit/s, about 42.67 Gbit/s of video data after 16b/18b coding.</li>
            </ul>
            <p>
              A mode above a link&apos;s limit needs Display Stream Compression (DSC) or chroma subsampling (4:2:2 or 4:2:0), and every device in the chain has to support
              it. HDMI 2.1 features are optional, so a product sold as HDMI 2.1 does not always run FRL at 48 Gbit/s: check the maker&apos;s specifications, and use an
              Ultra High Speed HDMI cable or a certified DisplayPort cable.
            </p>
            <p>
              Real monitors publish their own timings in their EDID, and these can be a little tighter or looser than CVT reduced blanking v2, so treat a result close to a
              limit as borderline. Modes listed by video fuser makers are vendor-listed, not tested by TraceCoreLab.
            </p>
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="rounded-2xl border border-line bg-ink-900/60 p-6">
              <p className="type-kicker text-dim">Read next</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/guides/pixel-clock-and-fuser-bandwidth" className={LINK}>
                    Pixel clock and bandwidth: will my monitor work through a video fuser?
                  </Link>
                </li>
                <li>
                  <Link href="/shop/fuser" className={LINK}>
                    HDMI and DisplayPort video fusers
                  </Link>
                </li>
                <li>
                  <Link href="/guides#fuser" className={LINK}>
                    All video fuser guides
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
