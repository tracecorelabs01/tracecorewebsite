import Link from "next/link";
import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { setStock } from "@/actions/admin/products";
import { ActionForm, FormStatus, Input, SubmitButton } from "@/components/admin/forms";
import { StockBadge } from "@/components/admin/StockBadge";
import { Badge, Card, EmptyState, PageHeader, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { param } from "@/lib/admin/format";
import { listInventory } from "@/lib/admin/products";
import { hasRole, requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inventory" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const user = await requireAdmin("staff");
  const q = param((await searchParams).q)?.trim() || undefined;
  const rows = await listInventory(q);
  const canEditProducts = hasRole(user, "admin");

  return (
    <>
      <PageHeader title="Inventory" description="Set stock after a delivery or a stock count. Changes go live immediately and are recorded in the activity log." />
      <div className="mb-4 flex justify-end">
        <SearchBox action="/admin/inventory" defaultValue={q} placeholder="Search products" />
      </div>
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={<Boxes className="size-5" />} title="No products found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th>Now</Th>
                <Th className="w-[360px]">Update stock · alert at</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <Td>
                    {canEditProducts ? (
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-amber">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{p.name}</span>
                    )}
                    <div className="font-mono text-[11px] text-dim">/{p.slug}</div>
                  </Td>
                  <Td>
                    <Badge tone={p.status === "active" ? "ok" : "neutral"}>{p.status}</Badge>
                  </Td>
                  <Td>
                    <StockBadge {...p} />
                  </Td>
                  <Td>
                    {p.trackInventory ? (
                      <ActionForm action={setStock.bind(null, p.id)} className="flex items-center gap-2" showStatus={false}>
                        <Input name="stockQty" type="number" defaultValue={p.stockQty} aria-label={`Stock for ${p.name}`} className="h-8 w-24 text-xs" />
                        <Input name="lowStockThreshold" type="number" min={0} defaultValue={p.lowStockThreshold} aria-label="Low-stock alert threshold" className="h-8 w-20 text-xs" />
                        <SubmitButton variant="secondary" size="sm">
                          Save
                        </SubmitButton>
                        <FormStatus className="mt-0 text-xs" />
                      </ActionForm>
                    ) : (
                      <span className="text-xs text-dim">Stock not tracked{canEditProducts ? " — enable it on the product" : ""}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
