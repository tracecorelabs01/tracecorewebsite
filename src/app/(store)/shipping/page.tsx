import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Globe2, PackageCheck, Receipt } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { SHIPPING_REGIONS } from "@/data/shipping-regions";
import { getStoreSettings } from "@/lib/catalog/server";
import { ALL_COUNTRIES, shipCountries } from "@/lib/countries";
import { breadcrumbLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/utils";

// Where the store ships, region by region with every country named, and what buyers pay on arrival. Countries come
// from src/lib/countries.ts minus Settings > countries we don't ship to; amounts come from Settings.

export const metadata: Metadata = pageMetadata({
  title: "Worldwide Shipping: Delivery Times, Duties and Taxes by Country",
  description:
    "TraceCoreLab ships DMA cards, video fusers and USB passthrough devices worldwide by tracked courier: delivery times, costs, duties and VAT for the US, UK, EU, Gulf and more.",
  path: "/shipping",
});

const NAME = new Map(ALL_COUNTRIES);

export default async function ShippingPage() {
  const settings = await getStoreSettings();
  const shipTo = new Set(shipCountries(settings.shipExcluded).map(([code]) => code));
  const excluded = settings.shipExcluded.map((c) => NAME.get(c)).filter(Boolean);
  const regions = SHIPPING_REGIONS.map((r) => ({ ...r, countries: r.codes.filter((c) => shipTo.has(c)).map((c) => NAME.get(c) as string) })).filter((r) => r.countries.length);
  const freeOver = settings.freeShippingThreshold > 0 ? formatPrice(settings.freeShippingThreshold) : null;

  const facts = [
    { Icon: Globe2, title: `${shipTo.size} countries`, text: "Tracked express shipping to every country listed at checkout." },
    { Icon: PackageCheck, title: "Dispatched in 1 business day", text: "Paid orders are tested and usually leave our lab the next business day." },
    { Icon: Clock, title: "3 to 7 business days", text: "Typical delivery time after dispatch. Customs checks can add a few days." },
    {
      Icon: Receipt,
      title: freeOver ? `Free over ${freeOver}` : "Free shipping",
      text: freeOver ? `Below that, a flat ${formatPrice(settings.flatShipping)} anywhere in the world. Prices in USD.` : "On every order, anywhere in the world. Prices in USD.",
    },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Worldwide shipping" }])} />
      <PageHero
        kicker="Shipping"
        crumbs={[{ label: "Home", href: "/" }, { label: "Worldwide shipping" }]}
        lines={[
          "Worldwide",
          <span key="b" className="text-gradient">
            shipping.
          </span>,
        ]}
        description="Tracked express delivery to the US, Canada, the UK, every EU country, the Gulf states and the rest of the world. Here is what it costs, how long it takes and what you pay on arrival."
      />

      <section className="container-x pb-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-3xl border border-line bg-ink-900/60 p-6">
              <Icon className="size-5 text-blaze" />
              <p className="mt-4 font-display text-2xl uppercase">{title}</p>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
        <nav aria-label="Regions" className="mt-10 flex flex-wrap gap-2">
          {regions.map((r) => (
            <a key={r.id} href={`#${r.id}`} className="rounded-full border border-line-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-blaze hover:text-fg">
              {r.name}
            </a>
          ))}
        </nav>
      </section>

      <section className="container-x grid gap-4 pb-16">
        {regions.map((r) => (
          <article key={r.id} id={r.id} className="scroll-mt-28 rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
            <h2 className="font-display text-3xl uppercase">Shipping to {r.name}</h2>
            <p className="mt-4 text-muted">
              Orders to {r.countries.length === 1 ? r.countries[0] : "these countries"} ship by tracked express courier, usually within 1 business day of payment, and
              typically arrive 3 to 7 business days after dispatch. {freeOver ? `Shipping is free on orders over ${freeOver}; below that it is a flat ${formatPrice(settings.flatShipping)}.` : "Shipping is free."}
            </p>
            <p className="mt-3 text-muted">{r.taxes}</p>
            {r.countries.length > 1 && (
              <p className="mt-5 text-sm leading-relaxed text-fg/80">
                <span className="type-kicker mr-2 text-dim">Countries</span>
                {r.countries.join(", ")}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="container-x pb-28">
        <div className="grid gap-6 rounded-3xl border border-line bg-ink-900/60 p-6 md:grid-cols-2 md:p-8">
          <div>
            <h2 className="font-display text-2xl uppercase">Customs, duties and taxes</h2>
            <p className="mt-3 text-sm text-muted">
              Our prices don&apos;t include import duties, VAT, GST or courier handling fees. Where your country charges them, they are collected by customs or the courier and
              paid by you on delivery.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl uppercase">More details</h2>
            <p className="mt-3 text-sm text-muted">
              The <Link href="/legal/shipping" className="text-fg underline underline-offset-4 hover:text-blaze">shipping policy</Link> covers tracking, address changes and lost
              parcels. Questions about delivery to your country? <Link href="/support" className="text-fg underline underline-offset-4 hover:text-blaze">Contact support</Link>.
              {excluded.length > 0 && ` We can't ship to ${excluded.join(", ")}.`}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
