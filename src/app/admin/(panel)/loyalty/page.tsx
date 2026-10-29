import Link from "next/link";
import type { Metadata } from "next";
import { Award, Coins, Eye, EyeOff, Gift, Pencil, Plus, TicketCheck, Users } from "lucide-react";
import { saveLoyaltySettings, saveOffer, setOfferActive } from "@/actions/admin/loyalty";
import { ActionForm, ConfirmButton, Field, FormStatus, Input, SubmitButton, Toggle } from "@/components/admin/forms";
import { LoyaltyOfferForm } from "@/components/admin/LoyaltyOfferForm";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatCard, Table, Td, Th, buttonClass } from "@/components/admin/ui";
import { getLoyaltyStats, listOffers, listRecentPoints } from "@/lib/admin/loyalty";
import { dateTime, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { getLoyaltyConfig, rewardLabel } from "@/lib/loyalty";

export const metadata: Metadata = { title: "Loyalty" };
// Admin pages read the session and live data on every request.
export const instant = false;

const KIND = { order: "Order", redeem: "Redeemed", adjust: "Adjusted" } as const;
const n = (v: number) => v.toLocaleString("en-US");

export default async function LoyaltyPage({ searchParams }: PageProps<"/admin/loyalty">) {
  await requireAdmin("admin");
  const [config, stats, offers, recent, sp] = await Promise.all([getLoyaltyConfig(), getLoyaltyStats(), listOffers(), listRecentPoints(), searchParams]);

  return (
    <>
      <PageHeader
        title="Loyalty"
        description="Customers earn points on paid orders and swap them for the offers below. Each redemption gives them a single-use code for checkout."
        actions={
          <a href="#new-offer" className={buttonClass()}>
            <Plus className="size-4" /> New offer
          </a>
        }
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Offer deleted. Codes customers already redeemed still work.</p>}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={n(stats.accounts)} hint="Customers who opened an account" icon={<Users className="size-4" />} />
        <StatCard label="Points held" value={n(stats.outstanding)} hint="Unspent, across all customers" icon={<Coins className="size-4" />} tone="brand" />
        <StatCard label="Earned · 30d" value={n(stats.earned30)} hint="From paid orders" icon={<Award className="size-4" />} />
        <StatCard label="Rewards redeemed" value={n(stats.redeemed)} hint={`${n(stats.codesUsed)} of those codes used at checkout`} icon={<TicketCheck className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card title="Offers" description="What customers can spend points on, shown in their account under Rewards." padded={false}>
            {offers.length === 0 ? (
              <EmptyState icon={<Gift className="size-5" />} title="No offers yet" description="Create one below, e.g. 10,000 points for $10 off." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Offer</Th>
                    <Th>Reward</Th>
                    <Th className="text-right">Points</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td>
                        <Link href={`/admin/loyalty/offers/${o.id}`} className="font-medium hover:text-amber">
                          {o.title}
                        </Link>
                        {o.description && <div className="max-w-xs truncate text-xs text-dim">{o.description}</div>}
                      </Td>
                      <Td className="whitespace-nowrap text-muted">{rewardLabel(o)}</Td>
                      <Td className="text-right font-mono tabular-nums">{n(o.pointsCost)}</Td>
                      <Td>{o.isActive ? <Badge tone="ok">Showing</Badge> : <Badge>Hidden</Badge>}</Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          <LinkButton href={`/admin/loyalty/offers/${o.id}`} variant="secondary" size="sm">
                            <Pencil className="size-3.5" /> Edit
                          </LinkButton>
                          <ConfirmButton action={setOfferActive.bind(null, o.id, !o.isActive)}>
                            {o.isActive ? (
                              <>
                                <EyeOff className="size-3.5" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5" /> Show
                              </>
                            )}
                          </ConfirmButton>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Recent points" description="The latest points earned, spent or adjusted." padded={false}>
            {recent.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nothing yet. Points appear when an order from a customer is marked paid.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Customer</Th>
                    <Th>What</Th>
                    <Th className="text-right">Points</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-xs text-muted">{dateTime(r.createdAt)}</Td>
                      <Td>
                        <Link href={`/admin/customers/${r.customerId}`} className="hover:text-amber">
                          {r.email}
                        </Link>
                      </Td>
                      <Td className="text-muted">
                        <span className="text-dim">{KIND[r.kind]}</span> · {r.note}
                      </Td>
                      <Td className={r.points > 0 ? "text-right font-mono tabular-nums text-ok" : "text-right font-mono tabular-nums text-muted"}>
                        {r.points > 0 ? "+" : "−"}
                        {n(Math.abs(r.points))}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <div id="new-offer" className="scroll-mt-24">
            <Card title="New offer" description="For example: 10,000 points for $10 off, or 25,000 points for 15% off orders over $200.">
              <LoyaltyOfferForm action={saveOffer.bind(null, null)} resetOnSuccess submitLabel="Create offer" />
            </Card>
          </div>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card title="Earning points" description="Applies to orders paid from now on. Points already earned stay as they are.">
            <ActionForm action={saveLoyaltySettings} showStatus={false}>
              <div className="space-y-4">
                <Toggle name="enabled" label="Loyalty program on" description="Off: no new points and no redemptions. Balances are kept." defaultChecked={config.enabled} />
                <Field label="Points per $1 spent" name="pointsPerDollar" hint="Counted on the products after discounts. Shipping doesn't earn points.">
                  <Input name="pointsPerDollar" inputMode="numeric" defaultValue={config.pointsPerDollar} className="tabular-nums" />
                </Field>
                <SubmitButton className="w-full" pendingText="Saving…">
                  Save
                </SubmitButton>
                <FormStatus className="mt-0" />
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
