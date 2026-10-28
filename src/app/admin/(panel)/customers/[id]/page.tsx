import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleDollarSign, Mail, Receipt, Wallet } from "lucide-react";
import { saveCustomerNotes } from "@/actions/admin/customers";
import { ActionForm, SubmitButton, Textarea } from "@/components/admin/forms";
import { buttonClass, Card, DescriptionList, EmptyState, LinkButton, OrderStatusBadge, PageHeader, PaymentBadge, qs, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { getCustomer } from "@/lib/admin/customers";
import { money, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Customer" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin("staff");
  const customerId = Number((await params).id);
  if (!Number.isInteger(customerId)) notFound();
  const data = await getCustomer(customerId);
  if (!data) notFound();
  const { customer, stats, orders } = data;
  const name = `${customer.firstName} ${customer.lastName}`.trim();

  return (
    <>
      <PageHeader
        title={name || customer.email}
        description={name ? customer.email : undefined}
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          <a href={`mailto:${customer.email}`} className={buttonClass("secondary")}>
            <Mail className="size-4" /> Email
          </a>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Orders" value={stats.orders.toLocaleString("en-US")} hint={`${stats.paidOrders.toLocaleString("en-US")} paid`} icon={<Receipt className="size-4" />} />
            <StatCard label="Paid spend" value={money(stats.paidSpendCents)} hint="Lifetime, paid orders" icon={<CircleDollarSign className="size-4" />} tone="brand" />
            <StatCard label="Avg paid order" value={money(stats.averagePaidCents)} icon={<Wallet className="size-4" />} />
          </div>

          <Card
            title="Orders"
            description={stats.orders > orders.length ? `Latest ${orders.length} of ${stats.orders}` : undefined}
            padded={false}
            actions={
              stats.orders > orders.length && (
                <LinkButton href={`/admin/orders${qs({ q: customer.email })}`} variant="ghost" size="sm">
                  View all
                </LinkButton>
              )
            }
          >
            {orders.length === 0 ? (
              <EmptyState icon={<Receipt className="size-5" />} title="No orders yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Items</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm text-fg hover:text-amber">
                          {o.number}
                        </Link>
                        <div className="text-xs text-dim">{shortDate(o.createdAt)}</div>
                      </Td>
                      <Td className="tabular-nums text-muted">
                        {o.units} item{o.units === 1 ? "" : "s"}
                      </Td>
                      <Td>
                        <PaymentBadge status={o.paymentStatus} />
                      </Td>
                      <Td>
                        <OrderStatusBadge status={o.status} />
                      </Td>
                      <Td className="text-right tabular-nums">{money(o.totalCents, o.currency)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Profile">
            <DescriptionList
              items={[
                {
                  label: "Email",
                  value: (
                    <a href={`mailto:${customer.email}`} className="break-all hover:text-amber">
                      {customer.email}
                    </a>
                  ),
                },
                { label: "Phone", value: customer.phone || "—" },
                { label: "Country", value: customer.country || "—" },
                { label: "Customer since", value: shortDate(customer.createdAt) },
                { label: "Last order", value: shortDate(orders[0]?.createdAt) },
              ]}
            />
          </Card>
          <Card title="Notes" description="Only visible to staff.">
            <ActionForm action={saveCustomerNotes.bind(null, customer.id)} className="space-y-3">
              <Textarea name="notes" defaultValue={customer.notes ?? ""} rows={5} maxLength={5000} aria-label="Customer notes" placeholder="Preferences, support history, anything the team should know…" />
              <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
                Save notes
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
