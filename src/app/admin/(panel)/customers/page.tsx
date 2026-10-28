import Link from "next/link";
import type { Metadata } from "next";
import { Download, Users } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, qs, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { listCustomers } from "@/lib/admin/customers";
import { money, pageParam, param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Customers" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin("staff");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const page = pageParam(sp.page);
  const { rows, total, pageCount } = await listCustomers({ q, page });

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total.toLocaleString("en-US")} customer${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""} · spend counts paid orders only`}
        actions={
          // `download` makes this a plain browser download rather than a client-side navigation.
          <LinkButton href="/api/admin/export/customers" variant="secondary" prefetch={false} download>
            <Download className="size-4" /> Export CSV
          </LinkButton>
        }
      />
      <div className="mb-4 flex justify-end">
        <SearchBox action="/admin/customers" defaultValue={q} placeholder="Search name or email" />
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q ? "No customers match your search" : "No customers yet"}
            description={q ? "Try a different search." : "Customers are added automatically when they place an order."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Spent</Th>
                  <Th>Last order</Th>
                  <Th>Country</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-fg hover:text-amber">
                        {`${c.firstName} ${c.lastName}`.trim() || c.email}
                      </Link>
                    </Td>
                    <Td className="text-muted">{c.email}</Td>
                    <Td className="text-right tabular-nums">{c.orderCount}</Td>
                    <Td className="text-right tabular-nums">{money(c.spentCents)}</Td>
                    <Td className="text-xs text-dim">{shortDate(c.lastOrderAt)}</Td>
                    <Td className="text-muted">{c.country || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/customers${qs({ q, page: n })}`} />
          </>
        )}
      </Card>
    </>
  );
}
