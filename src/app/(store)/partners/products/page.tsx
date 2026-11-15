import type { Metadata } from "next";
import { AccountShell, Panel, PARTNER_TABS } from "@/components/account/AccountShell";
import { PartnerProducts } from "@/components/partners/PartnerProducts";
import { ProductVisual } from "@/components/product/ProductVisual";
import { partnerTerms, requirePartner } from "@/lib/affiliates";
import { getCatalog } from "@/lib/catalog/server";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Partner products", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function PartnerProductsPage() {
  const { partner } = await requirePartner();
  const [terms, { products }] = await Promise.all([partnerTerms(partner.id), getCatalog()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const visible = [...terms.values()].filter((t) => t.visible && bySlug.has(t.slug));

  return (
    <AccountShell tabs={PARTNER_TABS} kicker="Partner portal" active="/partners/products" title={<span>Your <span className="text-gradient">products.</span></span>} description="What you can promote, what your customers pay and what you earn on each.">
      {visible.length === 0 ? (
        <Panel>
          <p className="text-muted">No products are set up for you yet. We&apos;ll let you know when there are.</p>
        </Panel>
      ) : (
        <PartnerProducts
          products={visible.map((t) => ({
            productId: t.productId,
            slug: t.slug,
            name: t.name,
            regularCents: t.regularCents,
            floorCents: t.floorCents,
            commission: t.commission,
            thumb: <ProductVisual visual={bySlug.get(t.slug)!.visual} variant="thumb" />,
          }))}
          discount={partner.customerDiscount}
          linkBase={site.url}
          code={partner.code}
        />
      )}
    </AccountShell>
  );
}
