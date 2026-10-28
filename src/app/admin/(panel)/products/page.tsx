import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Package, Plus, Star } from "lucide-react";
import { bulkUpdateProducts } from "@/actions/admin/products";
import { BulkCheckbox, BulkForm, BulkSelectAll, type BulkAction } from "@/components/admin/BulkForm";
import { Badge, Card, EmptyState, FilterTabs, LinkButton, PageHeader, Pagination, qs, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { StockBadge } from "@/components/admin/StockBadge";
import { ProductArt } from "@/components/product/ProductArt";
import { ART_KEYS, type ArtKey } from "@/lib/catalog/types";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { listCategories, listProducts } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Products" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const status = param(sp.status);
  const page = pageParam(sp.page);
  const [{ rows, total, pageCount, counts }, cats] = await Promise.all([listProducts({ q, status, page }), listCategories()]);
  const bulkActions: BulkAction[] = [
    { value: "status:active", label: "Publish (set active)" },
    { value: "status:draft", label: "Set to draft" },
    { value: "status:archived", label: "Archive" },
    { value: "category", label: "Move to category", input: { label: "Category", type: "select", options: [...cats.map((c) => ({ value: String(c.id), label: c.name })), { value: "none", label: "No category" }] } },
    { value: "stock-set", label: "Set stock to", input: { label: "Units", type: "number", min: -9999, max: 1_000_000, placeholder: "e.g. 25" } },
    { value: "stock-adjust", label: "Add / remove stock", input: { label: "Change", type: "number", placeholder: "e.g. 10 or -5" } },
    { value: "price-percent", label: "Change price by %", input: { label: "Percent", type: "number", min: -90, max: 500, step: 0.5, placeholder: "e.g. -10" } },
    { value: "featured:on", label: "Feature on homepage" },
    { value: "featured:off", label: "Remove from featured" },
    { value: "delete", label: "Delete", confirm: "Delete {n}? Their photos are removed too. Past orders keep their details. This can't be undone." },
  ];

  const tab =(label: string, value?: string) => ({ label, href: `/admin/products${qs({ status: value, q })}`, active: status === value, count: counts[value ?? "all"] ?? 0 });

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`}
        actions={
          <LinkButton href="/admin/products/new">
            <Plus className="size-4" /> New product
          </LinkButton>
        }
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Product deleted.</p>}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterTabs items={[tab("All"), tab("Active", "active"), tab("Draft", "draft"), tab("Archived", "archived")]} />
        <SearchBox action="/admin/products" defaultValue={q} placeholder="Search name or slug" keep={{ status }} />
      </div>

      <BulkForm key={`${status}|${q}|${page}`} ids={rows.map((p) => p.id)} actions={bulkActions} run={bulkUpdateProducts} noun={["product", "products"]}>
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package className="size-5" />}
            title={q ? "No products match your search" : "No products yet"}
            description={q ? "Try a different search." : "Create your first product, or run npm run db:seed to import the starter catalogue."}
            action={!q && <LinkButton href="/admin/products/new">New product</LinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <BulkSelectAll />
                  </Th>
                  <Th className="w-16" />
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <BulkCheckbox id={p.id} label={p.name} />
                    </Td>
                    <Td>
                      <div className="relative size-11 overflow-hidden rounded-lg border border-line bg-ink-950">
                        {p.thumb ? (
                          <Image src={p.thumb} alt="" fill unoptimized className="object-cover" />
                        ) : (
                          <ProductArt art={(ART_KEYS as readonly string[]).includes(p.artKey ?? "") ? (p.artKey as ArtKey) : "placeholder"} animated={false} className="scale-[1.6]" />
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Link href={`/admin/products/${p.id}`} className="font-medium text-fg hover:text-amber">
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-dim">
                        /{p.slug} {p.featured && <Star className="size-3 fill-amber text-amber" aria-label="Featured" />}
                      </div>
                    </Td>
                    <Td className="text-muted">{p.category ?? "—"}</Td>
                    <Td>
                      <StockBadge {...p} />
                    </Td>
                    <Td>
                      <Badge tone={p.status === "active" ? "ok" : p.status === "draft" ? "neutral" : "warn"}>{p.status}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {money(p.priceCents)}
                      {p.compareAtCents ? <div className="text-xs text-dim line-through">{money(p.compareAtCents)}</div> : null}
                    </Td>
                    <Td className="text-right text-xs text-dim">{shortDate(p.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/products${qs({ status, q, page: n })}`} />
          </>
        )}
      </Card>
      </BulkForm>
    </>
  );
}
