import Link from "next/link";
import type { Metadata } from "next";
import { Download, Handshake, Search, X } from "lucide-react";
import { bulkPayouts, bulkUpdatePartners, saveGroup, saveProgram, saveRules, setPartnerStatus } from "@/actions/admin/affiliates";
import { RulesTable } from "@/components/admin/affiliates/RulesTable";
import { TermsFields } from "@/components/admin/affiliates/TermsFields";
import { BulkCheckbox, BulkForm, BulkSelectAll, type BulkAction } from "@/components/admin/BulkForm";
import { ActionForm, AutoSubmitSelect, ConfirmButton, Field, Input, Select, SubmitButton, Toggle } from "@/components/admin/forms";
import { Badge, buttonClass, Card, EmptyState, FilterTabs, inputClass, LinkButton, PageHeader, Pagination, qs, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { commissionLabel, PAYOUT_METHOD, percentLabel } from "@/lib/affiliate-labels";
import { generalTerms } from "@/lib/affiliate-terms";
import { getProgram, rulesFor } from "@/lib/affiliates";
import {
  isPartnerSort,
  listApplications,
  listGroups,
  listPartners,
  listPayouts,
  PARTNER_SORTS,
  PARTNER_TONE,
  partnerStatusCounts,
  payoutsToPay,
  programSummary,
  type PartnerStatus,
} from "@/lib/admin/affiliates";
import { centsToInput, dateTime, money, pageParam, param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliates" };
// Admin pages read the session and live data on every request.
export const instant = false;

const TABS = ["partners", "applications", "payouts", "groups", "program"] as const;
type Tab = (typeof TABS)[number];
type Search = Awaited<PageProps<"/admin/affiliates">["searchParams"]>;
const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export default async function AffiliatesPage({ searchParams }: PageProps<"/admin/affiliates">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  // ?status=pending is the old address of the applications list.
  const raw = param(sp.tab) ?? (param(sp.status) === "pending" ? "applications" : "partners");
  const tab: Tab = (TABS as readonly string[]).includes(raw) ? (raw as Tab) : "partners";
  const [counts, toPay] = await Promise.all([partnerStatusCounts(), payoutsToPay()]);

  return (
    <>
      <PageHeader title="Affiliates" description="Partners who refer orders: what they earn, how big a discount they may give their customers, and what you owe them." />
      <div className="mb-4">
        <FilterTabs
          items={[
            { label: "Partners", href: "/admin/affiliates", active: tab === "partners" },
            { label: "Applications", href: "/admin/affiliates?tab=applications", active: tab === "applications", count: counts.pending || undefined },
            { label: "Payouts", href: "/admin/affiliates?tab=payouts", active: tab === "payouts", count: toPay.count || undefined },
            { label: "Groups", href: "/admin/affiliates?tab=groups", active: tab === "groups" },
            { label: "Program & products", href: "/admin/affiliates?tab=program", active: tab === "program" },
          ]}
        />
      </div>
      {tab === "partners" && <Partners sp={sp} counts={counts} toPay={toPay} />}
      {tab === "applications" && <Applications />}
      {tab === "payouts" && <Payouts toPayCents={toPay.cents} />}
      {tab === "groups" && <Groups />}
      {tab === "program" && <Program />}
    </>
  );
}

/* ───────────── partners ───────────── */

const LISTED: PartnerStatus[] = ["approved", "suspended", "rejected"];

async function Partners({ sp, counts, toPay }: { sp: Search; counts: Partial<Record<PartnerStatus, number>>; toPay: { count: number; cents: number } }) {
  const status = LISTED.find((s) => s === param(sp.status));
  const q = param(sp.q)?.trim() || undefined;
  const rawSort = param(sp.sort);
  const sort = isPartnerSort(rawSort) ? rawSort : undefined;
  const page = pageParam(sp.page);
  const [groups, summary] = await Promise.all([listGroups(), programSummary()]);
  const group = groups.find((g) => String(g.id) === param(sp.group));
  const { rows, total, pageCount } = await listPartners({ status, groupId: group?.id, q, sort, page });

  // Every link keeps the other filters and drops the page number, so changing a filter starts at page 1.
  const view = { status, group: group?.id, q, sort };
  const href = (change: Partial<typeof view> & { page?: number } = {}) => `/admin/affiliates${qs({ ...view, ...change })}`;
  const filtered = Boolean(q || group || sort);
  const everyone = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);

  const bulkActions: BulkAction[] = [
    {
      value: "group",
      label: "Move to group",
      input: { label: "Group", type: "select", options: [...groups.map((g) => ({ value: String(g.id), label: g.name })), { value: "default", label: "No group (use the default)" }] },
    },
    { value: "approved", label: "Approve or reinstate (emails new partners)" },
    { value: "suspended", label: "Suspend", confirm: "Suspend {n}? Their links and codes stop working." },
    { value: "rejected", label: "Decline application (emails them)", confirm: "Decline {n}? They'll be emailed." },
  ];

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Applications to review"
          value={(counts.pending ?? 0).toLocaleString("en-US")}
          tone={counts.pending ? "brand" : "neutral"}
          hint={counts.pending ? <Link href="/admin/affiliates?tab=applications" className="text-fg underline underline-offset-4 hover:text-amber">Review them</Link> : "Nothing waiting"}
        />
        <StatCard
          label="Payouts to send"
          value={money(toPay.cents)}
          tone={toPay.count ? "brand" : "neutral"}
          hint={toPay.count ? <Link href="/admin/affiliates?tab=payouts" className="text-fg underline underline-offset-4 hover:text-amber">{plural(toPay.count, "request")}</Link> : "No requests"}
        />
        <StatCard label="Partner sales · 30 days" value={money(summary.salesCents)} hint={plural(summary.orders, "paid order")} />
        <StatCard label="Commission · 30 days" value={money(summary.commissionCents)} hint={`${money(summary.owedCents)} owed in total`} />
      </div>

      <div className="mb-3">
        <FilterTabs
          items={[
            { label: "All", href: href({ status: undefined }), active: !status, count: everyone },
            ...LISTED.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), href: href({ status: s }), active: status === s, count: counts[s] ?? 0 })),
          ]}
        />
      </div>

      {/* A plain GET form, so every view has a URL you can refresh, share or go back to. */}
      <form action="/admin/affiliates" className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="relative flex-1">
          <span className="sr-only">Search partners</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input name="q" defaultValue={q} placeholder="Search by name, code or email, then press Enter" className={cn(inputClass, "pl-9")} />
        </label>
        {groups.length > 0 && (
          <AutoSubmitSelect name="group" defaultValue={group?.id ?? ""} aria-label="Filter by group" className="md:w-48">
            <option value="">Any group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </AutoSubmitSelect>
        )}
        <AutoSubmitSelect name="sort" defaultValue={sort ?? ""} aria-label="Sort partners" className="md:w-56">
          {Object.entries(PARTNER_SORTS).map(([value, label]) => (
            <option key={value} value={value === "newest" ? "" : value}>
              Sort: {label}
            </option>
          ))}
        </AutoSubmitSelect>
        {filtered && (
          <Link href={href({ q: undefined, group: undefined, sort: undefined })} className={buttonClass("ghost")}>
            <X className="size-4" /> Clear filters
          </Link>
        )}
      </form>

      <BulkForm key={`${status}|${group?.id}|${q}|${sort}|${page}`} ids={rows.map((r) => r.id)} actions={bulkActions} run={bulkUpdatePartners} noun={["partner", "partners"]}>
        <Card padded={false}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Handshake className="size-5" />}
              title={filtered || status ? "No partners match these filters" : "No partners yet"}
              description={filtered || status ? "Try another group, status or search." : "Customers apply at /partners. New applications show up under Applications."}
              action={
                (filtered || status) && (
                  <LinkButton href="/admin/affiliates" variant="secondary">
                    Clear filters
                  </LinkButton>
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
                    <Th>Partner</Th>
                    <Th>Group</Th>
                    <Th>Status</Th>
                    <Th>Customer discount</Th>
                    <Th>Sales · 30 days</Th>
                    <Th className="text-right">Earned</Th>
                    <Th className="text-right">Owed</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td>
                        <BulkCheckbox id={r.id} label={r.name} />
                      </Td>
                      <Td>
                        <Link href={`/admin/affiliates/${r.id}`} className="font-medium text-fg hover:text-amber">
                          {r.name}
                        </Link>
                        <div className="text-xs text-dim">
                          <span className="font-mono">{r.code}</span> · {r.email}
                        </div>
                      </Td>
                      <Td className="text-muted">{r.groupName ?? "—"}</Td>
                      <Td>
                        <Badge tone={PARTNER_TONE[r.status]}>{r.status}</Badge>
                      </Td>
                      <Td className="tabular-nums">
                        {r.limit === 0 ? (
                          <span className="text-dim">None</span>
                        ) : (
                          <>
                            {percentLabel(r.discount)}
                            <div className="text-xs text-dim">{r.discount >= r.limit ? "the most allowed" : `of ${percentLabel(r.limit)} allowed`}</div>
                          </>
                        )}
                      </Td>
                      <Td className="tabular-nums">
                        {money(r.salesCents)}
                        <div className="text-xs text-dim">
                          {plural(r.orders, "order")} · {plural(r.clicks, "click")}
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">{money(r.earnedCents)}</Td>
                      <Td className={cn("text-right tabular-nums", r.owedCents > 0 ? "text-amber" : "text-dim")}>{money(r.owedCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageCount={pageCount} href={(n) => href({ page: n })} />
            </>
          )}
        </Card>
      </BulkForm>
      {total > 0 && <p className="mt-3 text-xs text-dim">{plural(total, "partner")}. Earned is everything not reversed; owed is approved and not yet paid out. Tick partners to approve, suspend or move them together.</p>}
    </>
  );
}

/* ───────────── applications ───────────── */

async function Applications() {
  const rows = await listApplications();
  const actions: BulkAction[] = [
    { value: "approved", label: "Approve (emails them their code)" },
    { value: "rejected", label: "Decline (emails them)", confirm: "Decline {n}? They'll be emailed." },
  ];
  return (
    <BulkForm ids={rows.map((a) => a.id)} actions={actions} run={bulkUpdatePartners} noun={["application", "applications"]}>
      <Card
        title="Applications to review"
        description="Oldest first. Approving emails the partner their code and puts them in the default group. Tick several to decide them together."
        padded={false}
        actions={
          rows.length > 1 && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted">
              <BulkSelectAll label="Select all applications" /> Select all
            </label>
          )
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon={<Handshake className="size-5" />} title="No applications waiting" description="Customers apply at /partners. You're emailed when one comes in." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="grid gap-3 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto]">
                <div className="pt-0.5">
                  <BulkCheckbox id={a.id} label={a.name} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link href={`/admin/affiliates/${a.id}`} className="font-medium text-fg hover:text-amber">
                      {a.name}
                    </Link>
                    <span className="text-xs text-dim">
                      {a.email} · applied {shortDate(a.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Discord: {a.discordId ? (a.discordUsername ?? a.discordId) : <span className="text-warn">not linked, so they can&apos;t be approved yet</span>}
                    {a.website && (
                      <>
                        {" · "}
                        <a href={a.website} target="_blank" rel="noreferrer" className="break-all hover:text-fg">
                          {a.website}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-fg/90">{a.audience || "No details given."}</p>
                </div>
                <div className="flex items-start gap-2">
                  {a.discordId && (
                    <ConfirmButton action={setPartnerStatus.bind(null, a.id, "approved")} variant="primary" confirm={`Approve ${a.name}? They'll be emailed their code.`}>
                      Approve
                    </ConfirmButton>
                  )}
                  <ConfirmButton action={setPartnerStatus.bind(null, a.id, "rejected")} confirm={`Decline ${a.name}'s application? They'll be emailed.`}>
                    Decline
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </BulkForm>
  );
}

/* ───────────── payouts ───────────── */

async function Payouts({ toPayCents }: { toPayCents: number }) {
  const { requested, recent } = await listPayouts();
  const actions: BulkAction[] = [
    { value: "paid", label: "Mark paid (emails the partner)", input: { label: "PayPal transaction or batch ID", type: "text", maxLength: 191 } },
    { value: "rejected", label: "Reject", input: { label: "Why, for the partner", type: "text", maxLength: 255, placeholder: "Why, e.g. the PayPal email bounced" }, confirm: "Reject {n}? The amount goes back to each partner's balance." },
  ];
  return (
    // grid-cols-1: lets the wide tables scroll inside their cards instead of widening the page on phones.
    <div className="grid grid-cols-1 gap-4">
      <BulkForm ids={requested.map((r) => r.payout.id)} actions={actions} run={bulkPayouts} noun={["payout", "payouts"]}>
        <Card
          title={requested.length ? `To pay: ${money(toPayCents)} in ${plural(requested.length, "request")}` : "To pay"}
          description="Send them by PayPal, then tick the ones you sent and mark them paid with the PayPal transaction or batch ID. Each partner is emailed."
          padded={false}
          actions={
            requested.length > 0 && (
              // `download` makes this a plain browser download rather than a client-side navigation.
              <LinkButton href="/api/admin/export/payouts" variant="secondary" size="sm" prefetch={false} download>
                <Download className="size-4" /> Export CSV
              </LinkButton>
            )
          }
        >
          {requested.length === 0 ? (
            <EmptyState title="No payout requests" description="Partners ask for PayPal payouts from their portal once they reach the minimum." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <BulkSelectAll />
                  </Th>
                  <Th>Partner</Th>
                  <Th>PayPal email</Th>
                  <Th>Asked</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {requested.map(({ payout: p, partnerName, partnerId }) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <BulkCheckbox id={p.id} label={`payout to ${partnerName}`} />
                    </Td>
                    <Td>
                      <Link href={`/admin/affiliates/${partnerId}`} className="font-medium text-fg hover:text-amber">
                        {partnerName}
                      </Link>
                    </Td>
                    <Td className="font-mono text-sm">{p.paypalEmail}</Td>
                    <Td className="text-muted">{dateTime(p.createdAt)}</Td>
                    <Td className="text-right tabular-nums">{money(p.amountCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </BulkForm>
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

/* ───────────── groups ───────────── */

async function Groups() {
  const [groups, program] = await Promise.all([listGroups(), getProgram()]);
  const programTerms = generalTerms([], program);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
      <Card title="Groups" description="Set a commission and a discount limit once for a whole group, e.g. Creators or Resellers, then move partners into it. Partners without a group use the default one." padded={false}>
        {groups.length === 0 ? (
          <EmptyState title="No groups yet" description="Without groups, every partner gets the program's commission and discount limit." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Partners</Th>
                <Th>Commission</Th>
                <Th>Biggest discount</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const terms = generalTerms([g], program);
                const own = <T,>(set: boolean, value: T) => (set ? value : <span className="text-dim">{String(value)} (program)</span>);
                return (
                  <tr key={g.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/admin/affiliates/groups/${g.id}`} className="font-medium text-fg hover:text-amber">
                        {g.name}
                      </Link>
                      {g.isDefault && (
                        <Badge tone="brand" className="ml-2">
                          default
                        </Badge>
                      )}
                      {g.description && <div className="text-xs text-dim">{g.description}</div>}
                    </Td>
                    <Td className="tabular-nums">
                      <Link href={`/admin/affiliates${qs({ group: g.id })}`} className="hover:text-amber">
                        {g.partners}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">{own(g.commissionKind != null && g.commissionValue != null, commissionLabel(terms.commission))}</Td>
                    <Td className="tabular-nums">{own(g.maxDiscount != null, percentLabel(terms.maxDiscount))}</Td>
                  </tr>
                );
              })}
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
          <TermsFields inherited={programTerms} above="the program" />
          <Toggle name="isDefault" label="Default group" description="New partners join it." />
          <SubmitButton>Create group</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

/* ───────────── program ───────────── */

async function Program() {
  const [program, rows] = await Promise.all([getProgram(), rulesFor({ level: "program" })]);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card title="Program settings" description="These apply to every partner, unless their group or their own page says otherwise.">
        <ActionForm action={saveProgram} className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <Toggle name="enabled" label="Program open" description="Off: links and partner codes stop working and applications close. Existing commissions are kept." defaultChecked={program.enabled} />
          </div>
          <Field label="Commission" name="commissionKind">
            <Select name="commissionKind" defaultValue={program.commissionKind}>
              <option value="percent">Percent of the price</option>
              <option value="fixed">Fixed $ per unit</option>
            </Select>
          </Field>
          <Field label="Rate (% or $)" name="commissionValue">
            <Input name="commissionValue" inputMode="decimal" defaultValue={centsToInput(program.commissionValue)} />
          </Field>
          <Field label="Biggest customer discount (%)" name="maxDiscount" hint="Partners choose their customers' discount, from 0% up to this. Until a partner chooses, their customers get all of it.">
            <Input name="maxDiscount" inputMode="decimal" defaultValue={String(program.maxDiscount / 100)} />
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
          <div className="md:col-span-3">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card title="Products in the program" description="Which products partners can promote, and any product that needs its own commission or lowest price." padded={false}>
        <RulesTable level="program" rows={rows} action={saveRules.bind(null, { level: "program" })} />
      </Card>
    </div>
  );
}
