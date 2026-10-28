import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Package, Plus, Search, Star, X } from "lucide-react";
import { bulkUpdateProducts } from "@/actions/admin/products";
import { BulkCheckbox, BulkForm, BulkSelectAll, type BulkAction } from "@/components/admin/BulkForm";
import { AutoSubmitSelect } from "@/components/admin/forms";
import { Badge, buttonClass, Card, EmptyState, FilterTabs, inputClass, LinkButton, PageHeader, Pagination, qs, Table, Td, Th } from "@/components/admin/ui";
import { StockBadge } from "@/components/admin/StockBadge";
import { ProductArt } from "@/components/product/ProductArt";
import { ART_KEYS, type ArtKey } from "@/lib/catalog/types";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { isProductSort, isStockFilter, listCategories, listProducts, PAGE_SIZE, PRODUCT_SORTS, STOCK_FILTERS, type ProductSort } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };
// Admin pages read the session and live data on every request.
export const instant = false;

/** Which way each sort runs, for the arrow on its column header. */
const SORT_DIRECTION: Record<ProductSort, "up" | "down"> = { name: "up", "price-asc": "up", "price-desc": "down", stock: "up", updated: "down", newest: "down" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const status = param(sp.status) || undefined;
  const rawStock = param(sp.stock);
  const stock = isStockFilter(rawStock) ? rawStock : undefined;
  const rawSort = param(sp.sort);
  const sort = isProductSort(rawSort) ? rawSort : undefined;
  const page = pageParam(sp.page);

  const cats = await listCategories();
  const rawCategory = param(sp.category);
  const cat = rawCategory === "none" ? "none" : cats.find((c) => c.slug === rawCategory);
  const category = cat === "none" ? "none" : cat?.slug;
  const { rows, total, pageCount, counts, categoryCounts } = await listProducts({ q, status, categoryId: cat === "none" ? "none" : cat?.id, stock, sort, page });

  // Every link keeps the other filters and drops the page number, so changing a filter starts at page 1.
  const view = { status, category, q, stock, sort };
  const href = (change: Partial<typeof view> & { page?: number } = {}) => `/admin/products${qs({ ...view, ...change })}`;
  const filtered = Boolean(q || category || stock || sort);
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;

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

  const statusTab = (label: string, value?: string) => ({ label, href: href({ status: value }), active: status === value, count: counts[value ?? "all"] ?? 0 });
  const categoryTabs = [
    { label: "All categories", href: href({ category: undefined }), active: !category, count: categoryCounts.all ?? 0 },
    ...cats.map((c) => ({ label: c.name, href: href({ category: c.slug }), active: category === c.slug, count: categoryCounts[c.id] ?? 0 })),
    ...(categoryCounts.none || category === "none" ? [{ label: "Uncategorised", href: href({ category: "none" }), active: category === "none", count: categoryCounts.none ?? 0 }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description={total ? `Showing ${first}–${first + rows.length - 1} of ${total} product${total === 1 ? "" : "s"}${filtered ? " matching your filters" : ""}` : "No products to show"}
        actions={
          <LinkButton href="/admin/products/new">
            <Plus className="size-4" /> New product
          </LinkButton>
        }
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Product deleted.</p>}

      <div className="mb-3 space-y-3">
        <FilterTabs items={[statusTab("All"), statusTab("Active", "active"), statusTab("Draft", "draft"), statusTab("Archived", "archived")]} />
        <FilterTabs items={categoryTabs} />
      </div>

      {/* A plain GET form, so every view has a URL you can refresh, share or go back to. */}
      <form action="/admin/products" className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        {status && <input type="hidden" name="status" value={status} />}
        {category && <input type="hidden" name="category" value={category} />}
        <label className="relative flex-1">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input name="q" defaultValue={q} placeholder="Search by name or slug, then press Enter" className={cn(inputClass, "pl-9")} />
        </label>
        <AutoSubmitSelect name="stock" defaultValue={stock ?? ""} aria-label="Filter by stock" className="md:w-44">
          <option value="">Any stock level</option>
          {Object.entries(STOCK_FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="sort" defaultValue={sort ?? ""} aria-label="Sort products" className="md:w-56">
          <option value="">Sort: store order</option>
          {Object.entries(PRODUCT_SORTS).map(([value, s]) => (
            <option key={value} value={value}>
              Sort: {s.label}
            </option>
          ))}
        </AutoSubmitSelect>
        {filtered && (
          <Link href={href({ q: undefined, category: undefined, stock: undefined, sort: undefined })} className={buttonClass("ghost")}>
            <X className="size-4" /> Clear filters
          </Link>
        )}
      </form>

      <BulkForm key={`${status}|${category}|${q}|${stock}|${sort}|${page}`} ids={rows.map((p) => p.id)} actions={bulkActions} run={bulkUpdateProducts} noun={["product", "products"]}>
        <Card padded={false}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Package className="size-5" />}
              title={filtered || status ? "No products match these filters" : "No products yet"}
              description={filtered || status ? "Try another category, stock level or search." : "Create your first product, or run npm run db:seed to import the starter catalogue."}
              action={
                filtered || status ? (
                  <LinkButton href="/admin/products" variant="secondary">
                    Clear filters
                  </LinkButton>
                ) : (
                  <LinkButton href="/admin/products/new">New product</LinkButton>
                )
              }
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <BulkSelectAll />
                    </Th>
                    <Th className="w-24" />
                    <SortTh label="Product" options={["name"]} current={sort} href={(s) => href({ sort: s })} />
                    <Th>Category</Th>
                    <SortTh label="Stock" options={["stock"]} current={sort} href={(s) => href({ sort: s })} />
                    <Th>Status</Th>
                    <SortTh label="Price" options={["price-asc", "price-desc"]} current={sort} href={(s) => href({ sort: s })} align="right" />
                    <SortTh label="Updated" options={["updated"]} current={sort} href={(s) => href({ sort: s })} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td>
                        <BulkCheckbox id={p.id} label={p.name} />
                      </Td>
                      <Td>
                        <Link href={`/admin/products/${p.id}`} tabIndex={-1} aria-hidden className="relative block aspect-video w-20 overflow-hidden rounded-md border border-line bg-ink-950">
                          {p.thumb ? (
                            <Image src={p.thumb} alt="" fill sizes="80px" className="object-cover" />
                          ) : (
                            <ProductArt art={(ART_KEYS as readonly string[]).includes(p.artKey ?? "") ? (p.artKey as ArtKey) : "placeholder"} animated={false} className="scale-[1.2]" />
                          )}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/products/${p.id}`} className="font-medium text-fg hover:text-amber">
                            {p.name}
                          </Link>
                          {p.featured && <Star className="size-3.5 shrink-0 fill-amber text-amber" aria-label="Featured on homepage" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-dim">
                          /{p.slug}
                          {p.status === "active" && (
                            <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg" aria-label={`View ${p.name} on the store (opens in a new tab)`}>
                              <ExternalLink className="size-3" /> View
                            </a>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {p.categorySlug ? (
                          <Link href={href({ category: p.categorySlug })} className="text-muted hover:text-fg" title={`Show only ${p.category}`}>
                            {p.category}
                          </Link>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </Td>
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
              <Pagination page={page} pageCount={pageCount} href={(n) => href({ page: n })} />
            </>
          )}
        </Card>
      </BulkForm>
    </>
  );
}

/**
 * A column header that sorts by `options[0]`; clicking again flips to `options[1]` if there is one,
 * otherwise returns to the store order.
 */
function SortTh({ label, options, current, href, align }: { label: string; options: ProductSort[]; current?: ProductSort; href: (sort?: ProductSort) => string; align?: "right" }) {
  const index = current ? options.indexOf(current) : -1;
  const next = index === -1 ? options[0] : options[index + 1];
  const Icon = index === -1 ? ArrowUpDown : SORT_DIRECTION[current!] === "up" ? ArrowUp : ArrowDown;
  return (
    <Th className={cn(align === "right" && "text-right")} aria-sort={index === -1 ? undefined : SORT_DIRECTION[current!] === "up" ? "ascending" : "descending"}>
      <Link href={href(next)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-fg", index !== -1 && "text-fg")}>
        {label}
        <Icon className={cn("size-3", index === -1 && "opacity-50")} />
      </Link>
    </Th>
  );
}
