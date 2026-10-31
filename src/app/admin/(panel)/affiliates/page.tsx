import Link from "next/link";
import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { declinePayout, payPayout, saveGroup, saveProgram, saveRules } from "@/actions/admin/affiliates";
import { RulesTable } from "@/components/admin/affiliates/RulesTable";
import { ActionForm, Field, Input, Select, SubmitButton, Toggle } from "@/components/admin/forms";
import { Badge, Card, EmptyState, FilterTabs, PageHeader, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { PAYOUT_METHOD } from "@/lib/affiliate-labels";
import { getProgram, rulesFor } from "@/lib/affiliates";
import { listGroups, listPartners, listPayouts, PARTNER_STATUSES, PARTNER_TONE, partnerStatusCounts, type PartnerStatus } from "@/lib/admin/affiliates";
import { centsToInput, dateTime, money, param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Affiliates" };
// Admin pages read the session and live data on every request.
export const instant = false;

const TABS = ["partners", "groups", "payouts", "program"] as const;

export default async function AffiliatesPage({ searchParams }: PageProps<"/admin/affiliates">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(param(sp.tab) ?? "") ? (param(sp.tab) as (typeof TABS)[number]) : "partners";

  return (
    <>
      <PageHeader title="Affiliates" description="Partners who refer orders, what they can promote, what they earn and the prices their customers pay." />
      <div className="mb-4">
        <FilterTabs
          items={[
            { label: "Partners", href: "/admin/affiliates", active: tab === "partners" },
            { label: "Groups", href: "/admin/affiliates?tab=groups", active: tab === "groups" },
            { label: "Payouts", href: "/admin/affiliates?tab=payouts", active: tab === "payouts" },
            { label: "Program & products", href: "/admin/affiliates?tab=program", active: tab === "program" },
          ]}
        />
      </div>
      {tab === "partners" && <Partners status={param(sp.status)} q={param(sp.q) ?? ""} />}
      {tab === "groups" && <Groups />}
      {tab === "payouts" && <Payouts />}
      {tab === "program" && <Program />}
    </>
  );
}

async function Partners({ status, q }: { status?: string; q: string }) {
  const filter = (PARTNER_STATUSES as readonly string[]).includes(status ?? "") ? (status as PartnerStatus) : null;
  const [rows, counts] = await Promise.all([listPartners(filter, q), partnerStatusCounts()]);
  const all = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  const href = (s?: string) => `/admin/affiliates${s ? `?status=${s}` : ""}`;
  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
        <FilterTabs
          items={[
            { label: "All", href: href(), active: !filter, count: all },
            ...PARTNER_STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), href: href(s), active: filter === s, count: counts[s] ?? 0 })),
          ]}
        />
        <SearchBox action="/admin/affiliates" defaultValue={q} placeholder="Name, code or email" keep={{ status: filter ?? undefined }} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Handshake className="size-5" />} title="No partners here yet" description="Customers apply at /partners. New applications show up under Pending." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Partner</Th>
              <Th>Code</Th>
              <Th>Group</Th>
              <Th>Status</Th>
              <Th>Earned</Th>
              <Th>Applied</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                <Td>
                  <Link href={`/admin/affiliates/${r.id}`} className="font-medium text-fg hover:text-amber">
                    {r.name}
                  </Link>
                  <div className="text-xs text-dim">{r.email}</div>
                </Td>
                <Td className="font-mono text-sm">{r.code}</Td>
                <Td className="text-muted">{r.groupName ?? "Default"}</Td>
                <Td>
                  <Badge tone={PARTNER_TONE[r.status]}>{r.status}</Badge>
                </Td>
                <Td className="tabular-nums">{money(Number(r.earnedCents ?? 0))}</Td>
                <Td className="text-muted">{shortDate(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function Groups() {
  const groups = await listGroups();
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card title="Groups" description="Each group has its own products, commissions and partner prices. Partners without a group use the default one." padded={false}>
        {groups.length === 0 ? (
          <EmptyState title="No groups yet" description="Create one, e.g. Creators or Resellers. Without groups, partners get the program settings and their own." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Partners</Th>
                <Th>Default</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/affiliates/groups/${g.id}`} className="font-medium text-fg hover:text-amber">
                      {g.name}
                    </Link>
                    {g.description && <div className="text-xs text-dim">{g.description}</div>}
                  </Td>
                  <Td className="tabular-nums">{Number(g.partners ?? 0)}</Td>
                  <Td>{g.isDefault && <Badge tone="brand">default</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="New group">
        <ActionForm action={saveGroup.bind(null, null)} className="grid gap-4">
          <Field label="Name" name="name">
            <Input name="name" maxLength={80} placeholder="Creators" />
          </Field>
          <Field label="Description" name="description">
            <Input name="description" maxLength={255} placeholder="YouTube and Twitch partners" />
          </Field>
          <Toggle name="isDefault" label="Default group" description="New partners join it." />
          <SubmitButton>Create group</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

async function Payouts() {
  const { requested, recent } = await listPayouts();
  return (
    <div className="grid gap-4">
      <Card title="To pay" description="Send each by PayPal, then mark it paid with the transaction ID. The partner is emailed." padded={false}>
        {requested.length === 0 ? (
          <EmptyState title="No payout requests" description="Partners ask for PayPal payouts from their portal once they reach the minimum." />
        ) : (
          <ul className="divide-y divide-line">
            {requested.map(({ payout: p, partnerName, partnerId }) => (
              <li key={p.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <Link href={`/admin/affiliates/${partnerId}`} className="font-medium text-fg hover:text-amber">
                    {partnerName}
                  </Link>
                  <div className="mt-1 font-display text-3xl">{money(p.amountCents)}</div>
                  <div className="text-xs text-dim">
                    PayPal {p.paypalEmail} · asked {dateTime(p.createdAt)}
                  </div>
                </div>
                <ActionForm action={payPayout.bind(null, p.id)} className="grid content-start gap-2">
                  <Field label="PayPal transaction ID" name="reference">
                    <Input name="reference" maxLength={191} />
                  </Field>
                  <SubmitButton size="sm">Mark paid</SubmitButton>
                </ActionForm>
                <ActionForm action={declinePayout.bind(null, p.id)} className="grid content-start gap-2">
                  <Field label="Or reject it: why?" name="note">
                    <Input name="note" maxLength={255} placeholder="The PayPal email bounced" />
                  </Field>
                  <SubmitButton size="sm" variant="secondary">
                    Reject
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Recent payouts" padded={false}>
        {recent.length === 0 ? (
          <EmptyState title="Nothing paid yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Method</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Reference</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map(({ payout: p, partnerName, partnerId }) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/admin/affiliates/${partnerId}`} className="text-fg hover:text-amber">
                      {partnerName}
                    </Link>
                  </Td>
                  <Td>{PAYOUT_METHOD[p.method]}</Td>
                  <Td className="tabular-nums">{money(p.amountCents)}</Td>
                  <Td>
                    <Badge tone={p.status === "paid" ? "ok" : "neutral"}>{p.status}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{p.reference ?? p.note ?? "—"}</Td>
                  <Td className="text-muted">{dateTime(p.paidAt ?? p.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

async function Program() {
  const [program, rows] = await Promise.all([getProgram(), rulesFor({ level: "program" })]);
  return (
    <div className="grid gap-4">
      <Card title="Program settings">
        <ActionForm action={saveProgram} className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <Toggle name="enabled" label="Program open" description="Off: links and partner codes stop working and applications close. Existing commissions are kept." defaultChecked={program.enabled} />
          </div>
          <Field label="Default commission" name="commissionKind" hint="For products in the program without their own.">
            <Select name="commissionKind" defaultValue={program.commissionKind}>
              <option value="percent">Percent of the price</option>
              <option value="fixed">Fixed $ per unit</option>
            </Select>
          </Field>
          <Field label="Rate (% or $)" name="commissionValue">
            <Input name="commissionValue" inputMode="decimal" defaultValue={centsToInput(program.commissionValue)} />
          </Field>
          <Field label="Referral window (days)" name="cookieDays" hint="How long a link or code keeps counting.">
            <Input name="cookieDays" type="number" min={1} max={365} defaultValue={program.cookieDays} />
          </Field>
          <Field label="Hold after delivery (days)" name="holdDays" hint="Before a commission can be paid out.">
            <Input name="holdDays" type="number" min={0} max={365} defaultValue={program.holdDays} />
          </Field>
          <Field label="Minimum PayPal payout ($)" name="minPayout" hint="Store credit has no minimum.">
            <Input name="minPayout" inputMode="decimal" defaultValue={centsToInput(program.minPayoutCents)} />
          </Field>
          <div className="flex items-end">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card title="Products in the program" description="The defaults every partner gets. Groups and partners can override them." padded={false}>
        <RulesTable level="program" rows={rows} action={saveRules.bind(null, { level: "program" })} />
      </Card>
    </div>
  );
}
