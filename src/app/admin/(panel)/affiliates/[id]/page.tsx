import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addAdjustment, saveRules, savePartner, setCommissionStatus, setPartnerStatus } from "@/actions/admin/affiliates";
import { RulesTable } from "@/components/admin/affiliates/RulesTable";
import { ActionForm, ConfirmButton, Field, Input, Select, SubmitButton, Textarea } from "@/components/admin/forms";
import { Badge, Card, DescriptionList, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { COMMISSION_STATUS, PAYOUT_METHOD } from "@/lib/affiliate-labels";
import { partnerBalance, partnerCommissions, partnerPayouts, partnerStats, rulesFor } from "@/lib/affiliates";
import { getPartner, listGroups, PARTNER_TONE } from "@/lib/admin/affiliates";
import { dateTime, money, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Partner" };
// Admin pages read the session and live data on every request.
export const instant = false;

const STATUS_TONE = { warn: "warn", ok: "ok", neutral: "neutral", dim: "neutral" } as const;

export default async function PartnerPage({ params }: PageProps<"/admin/affiliates/[id]">) {
  await requireAdmin("admin");
  const id = Number((await params).id);
  const row = Number.isInteger(id) ? await getPartner(id) : null;
  if (!row) notFound();
  const { partner: a, email, firstName, lastName } = row;
  const [groups, stats, balance, commissions, payouts, rules] = await Promise.all([
    listGroups(),
    partnerStats(id),
    partnerBalance(id),
    partnerCommissions(id, 100),
    partnerPayouts(id),
    rulesFor({ level: "partner", id }),
  ]);

  return (
    <>
      <PageHeader
        title={a.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={PARTNER_TONE[a.status]}>{a.status}</Badge>
            <span>
              {[firstName, lastName].filter(Boolean).join(" ") || "No name"} ·{" "}
              <Link href={`/admin/customers/${a.customerId}`} className="hover:text-fg">
                {email}
              </Link>
            </span>
          </span>
        }
        back={{ href: "/admin/affiliates", label: "Affiliates" }}
        actions={
          <div className="flex flex-wrap gap-2">
            {a.status === "pending" && (
              <>
                <ConfirmButton action={setPartnerStatus.bind(null, id, "approved")} variant="primary" size="md" confirm={`Approve ${a.name}? They'll be emailed their code.`}>
                  Approve
                </ConfirmButton>
                <ConfirmButton action={setPartnerStatus.bind(null, id, "rejected")} size="md" confirm={`Decline ${a.name}'s application? They'll be emailed.`}>
                  Decline
                </ConfirmButton>
              </>
            )}
            {a.status === "approved" && (
              <ConfirmButton action={setPartnerStatus.bind(null, id, "suspended")} variant="danger" size="md" confirm={`Suspend ${a.name}? Their link and code stop working.`}>
                Suspend
              </ConfirmButton>
            )}
            {(a.status === "suspended" || a.status === "rejected") && (
              <ConfirmButton action={setPartnerStatus.bind(null, id, "approved")} variant="primary" size="md" confirm={`Make ${a.name} an active partner?`}>
                {a.status === "suspended" ? "Reinstate" : "Approve"}
              </ConfirmButton>
            )}
          </div>
        }
      />

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clicks · 30 days" value={stats.clicks.toLocaleString("en-US")} />
          <StatCard label="Paid orders · 30 days" value={stats.orders.toLocaleString("en-US")} hint={`${(stats.conversion * 100).toFixed(1)}% conversion`} />
          <StatCard label="Available" value={money(balance.availableCents)} tone="brand" hint={`${money(balance.pendingCents)} pending`} />
          <StatCard label="Paid out" value={money(balance.paidCents)} hint={balance.requestedCents ? `${money(balance.requestedCents)} requested` : undefined} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card title="Partner">
            <ActionForm action={savePartner.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name">
                <Input name="name" defaultValue={a.name} maxLength={120} />
              </Field>
              <Field label="Code" name="code" hint={`Link: ${site.url}/?ref=${a.code}`}>
                <Input name="code" defaultValue={a.code} maxLength={32} className="font-mono uppercase" />
              </Field>
              <Field label="Group" name="groupId" hint="Products, commissions and prices come from the group unless set below.">
                <Select name="groupId" defaultValue={a.groupId ?? ""}>
                  <option value="">Default group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="PayPal email" name="paypalEmail">
                <Input name="paypalEmail" type="email" defaultValue={a.paypalEmail ?? ""} maxLength={191} />
              </Field>
              <Field label="Notes (staff only)" name="notes" className="sm:col-span-2">
                <Textarea name="notes" defaultValue={a.notes ?? ""} rows={3} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton>Save partner</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Application">
            <DescriptionList
              items={[
                { label: "Applied", value: dateTime(a.createdAt) },
                { label: "Approved", value: a.approvedAt ? dateTime(a.approvedAt) : "—" },
                { label: "Website", value: a.website ? <a href={a.website} target="_blank" rel="noreferrer" className="hover:text-fg">{a.website}</a> : "—" },
                { label: "How they'd promote us", value: <span className="whitespace-pre-wrap">{a.audience ?? "—"}</span> },
              ]}
            />
          </Card>
        </div>

        <Card title="Products for this partner" description="Overrides just for them. Blank fields use their group's settings, then the program's." padded={false}>
          <RulesTable level="partner" rows={rules} action={saveRules.bind(null, { level: "partner", id })} />
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card title="Commissions" padded={false}>
            {commissions.length === 0 ? (
              <EmptyState title="No commissions yet" description="They appear when an order they referred is paid." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Order</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <Td className="whitespace-nowrap text-muted">{shortDate(c.createdAt)}</Td>
                      <Td>
                        <div className="font-mono text-sm">{c.orderNumber ?? "Adjustment"}</div>
                        <div className="text-xs text-dim">{c.kind === "order" ? (c.lines ?? []).map((l) => `${l.qty} × ${l.name}`).join(", ") : c.note}</div>
                      </Td>
                      <Td className="tabular-nums">{money(c.amountCents)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[COMMISSION_STATUS[c.status].tone]}>{COMMISSION_STATUS[c.status].label}</Badge>
                        {c.payoutId && c.status === "approved" && <div className="mt-1 text-xs text-dim">In a payout</div>}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {c.status === "pending" && (
                            <ConfirmButton action={setCommissionStatus.bind(null, c.id, "approved")} confirm="Approve this commission now, before the hold period ends?">
                              Approve
                            </ConfirmButton>
                          )}
                          {(c.status === "pending" || c.status === "approved") && !c.payoutId && (
                            <ConfirmButton action={setCommissionStatus.bind(null, c.id, "reversed")} variant="danger" confirm="Reverse this commission? The partner won't be paid it.">
                              Reverse
                            </ConfirmButton>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <div className="grid content-start gap-4">
            <Card title="Adjust the balance" description="A bonus, or a deduction (e.g. -10). It's available straight away.">
              <ActionForm action={addAdjustment.bind(null, id)} className="grid gap-3" resetOnSuccess>
                <Field label="Amount ($)" name="amount">
                  <Input name="amount" inputMode="decimal" placeholder="25.00" />
                </Field>
                <Field label="Reason" name="note">
                  <Input name="note" maxLength={255} placeholder="Launch video bonus" />
                </Field>
                <SubmitButton size="sm">Add adjustment</SubmitButton>
              </ActionForm>
            </Card>
            <Card title="Payouts" padded={false}>
              {payouts.length === 0 ? (
                <p className="p-5 text-sm text-muted">No payouts yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <div>
                          {PAYOUT_METHOD[p.method]} · <span className="tabular-nums">{money(p.amountCents)}</span>
                        </div>
                        <div className="font-mono text-xs text-dim">{p.reference ?? p.note ?? shortDate(p.createdAt)}</div>
                      </div>
                      <Badge tone={p.status === "paid" ? "ok" : p.status === "requested" ? "warn" : "neutral"}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {payouts.some((p) => p.status === "requested") && (
                <p className="border-t border-line px-5 py-3 text-xs text-muted">
                  Pay requests from{" "}
                  <Link href="/admin/affiliates?tab=payouts" className="text-fg hover:text-amber">
                    Payouts
                  </Link>
                  .
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
