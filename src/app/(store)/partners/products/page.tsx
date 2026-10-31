import type { Metadata } from "next";
import { AccountShell, Panel, PARTNER_TABS } from "@/components/account/AccountShell";
import { CopyText } from "@/components/partners/PartnerForms";
import { ProductVisual } from "@/components/product/ProductVisual";
import { commissionLabel, partnerTerms, requirePartner, type Terms } from "@/lib/affiliates";
import { getCatalog } from "@/lib/catalog/server";
import { site } from "@/lib/site";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Partner products", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

/** What the partner earns on one unit at their customers' price. */
const perUnit = (t: Terms) => (t.commission.kind === "percent" ? Math.round((t.priceCents * t.commission.value) / 10_000) : Math.min(t.commission.value, t.priceCents));

export default async function PartnerProductsPage() {
  const { partner } = await requirePartner("/partners/products");
  const [terms, { products }] = await Promise.all([partnerTerms(partner.id), getCatalog()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const visible = [...terms.values()].filter((t) => t.visible && bySlug.has(t.slug));

  return (
    <AccountShell tabs={PARTNER_TABS} kicker="Partner portal" active="/partners/products" title={<span>Your <span className="text-gradient">products.</span></span>} description="What you can promote, what your customers pay and what you earn on each.">
      <Panel>
        {visible.length === 0 ? (
          <p className="text-muted">No products are set up for you yet. We&apos;ll let you know when there are.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {visible.map((t) => {
              const product = bySlug.get(t.slug)!;
              return (
                <li key={t.productId} className="flex gap-4 rounded-2xl border border-line p-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-850">
                    <ProductVisual visual={product.visual} variant="thumb" />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <p className="font-display text-xl uppercase leading-tight">{t.name}</p>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-dim">Your customers pay</dt>
                        <dd className="font-mono">
                          {formatPrice(t.priceCents / 100)}
                          {t.priceCents < t.regularCents && <span className="ml-1.5 text-xs text-dim line-through">{formatPrice(t.regularCents / 100)}</span>}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-dim">Commission</dt>
                        <dd className="font-mono">{commissionLabel(t.commission)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-dim">You earn</dt>
                        <dd className="font-mono text-ok">{formatPrice(perUnit(t) / 100)}</dd>
                      </div>
                    </dl>
                    <CopyText text={`${site.url}/product/${t.slug}?ref=${partner.code}`} label="Copy product link" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </AccountShell>
  );
}
