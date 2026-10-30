import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleDollarSign, Mail, Receipt, Wallet } from "lucide-react";
import { openCustomerAccount, saveCustomerNotes, signOutCustomer } from "@/actions/admin/customers";
import { adjustPoints } from "@/actions/admin/loyalty";
import { ActionForm, ConfirmButton, Field, Input, SubmitButton, Textarea } from "@/components/admin/forms";
import { buttonClass, Card, DescriptionList, EmptyState, LinkButton, OrderStatusBadge, PageHeader, PaymentBadge, qs, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { getCustomer } from "@/lib/admin/customers";
import { dateTime, money, param, shortDate } from "@/lib/admin/format";
import { getCustomerLoyalty } from "@/lib/admin/loyalty";
import { hasRole, requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Customer" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function CustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  const user = await requireAdmin("staff");
  const customerId = Number((await params).id);
  if (!Number.isInteger(customerId)) notFound();
  const [data, loyalty, sp] = await Promise.all([getCustomer(customerId), getCustomerLoyalty(customerId), searchParams]);
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
      {param(sp.created) && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-ok" /> Customer created. We emailed them that their account is ready; they sign in at /account/login with a code.
        </p>
      )}

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
                { label: "Account", value: loyalty.accountCreatedAt ? `Opened ${shortDate(loyalty.accountCreatedAt)}` : "Not opened yet" },
                ...(loyalty.lastLoginAt ? [{ label: "Last login", value: dateTime(loyalty.lastLoginAt) }] : []),
              ]}
            />
          </Card>
          {hasRole(user, "admin") && (
            <Card
              title="Account"
              description={
                loyalty.accountCreatedAt
                  ? "They sign in with a code we email them, so there's no password to reset. Lost a device? Sign them out everywhere."
                  : "Accounts open with the first paid order. Open one now and we'll email them how to sign in."
              }
            >
              {loyalty.accountCreatedAt ? (
                <ConfirmButton action={signOutCustomer.bind(null, customer.id)} confirm={`Sign ${customer.email} out on every device?`}>
                  Sign out everywhere
                </ConfirmButton>
              ) : (
                <ConfirmButton action={openCustomerAccount.bind(null, customer.id)} confirm={`Open an account for ${customer.email} and email them?`}>
                  Open account
                </ConfirmButton>
              )}
            </Card>
          )}
          <Card title="Loyalty points" description={`Balance: ${loyalty.balance.toLocaleString("en-US")} points`}>
            {loyalty.history.length === 0 ? (
              <p className="text-sm text-muted">No points yet. They&apos;re added when this customer&apos;s orders are marked paid.</p>
            ) : (
              <ul className="divide-y divide-line/70 text-sm">
                {loyalty.history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{h.note}</span>
                      <span className="text-xs text-dim">{shortDate(h.createdAt)}</span>
                    </span>
                    <span className={h.points > 0 ? "shrink-0 font-mono tabular-nums text-ok" : "shrink-0 font-mono tabular-nums text-muted"}>
                      {h.points > 0 ? "+" : "−"}
                      {Math.abs(h.points).toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {loyalty.codes.length > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-dim">
                Reward codes: {loyalty.codes.map((c) => `${c.code}${c.usedCount ? " (used)" : ""}`).join(", ")}
              </p>
            )}
            {hasRole(user, "admin") && (
              <ActionForm action={adjustPoints.bind(null, customer.id)} resetOnSuccess className="mt-4 space-y-3 border-t border-line pt-4">
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                  <Field label="Points" name="points">
                    <Input name="points" inputMode="numeric" placeholder="500 or -500" className="tabular-nums" />
                  </Field>
                  <Field label="Reason" name="note">
                    <Input name="note" maxLength={200} placeholder="Goodwill for a late delivery" />
                  </Field>
                </div>
                <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
                  Adjust points
                </SubmitButton>
              </ActionForm>
            )}
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
