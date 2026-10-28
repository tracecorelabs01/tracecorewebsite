import Link from "next/link";
import type { Metadata } from "next";
import { Pencil, Plus, Power, PowerOff, TicketPercent, Trash2 } from "lucide-react";
import { deleteDiscount, saveDiscount, setDiscountActive } from "@/actions/admin/discounts";
import { DiscountStateBadge } from "@/components/admin/community/badges";
import { DiscountForm } from "@/components/admin/DiscountForm";
import { ConfirmButton } from "@/components/admin/forms";
import { buttonClass, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { discountLabel, discountState, listDiscounts } from "@/lib/admin/discounts";
import { dateTime, money, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Discounts" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function DiscountsPage({ searchParams }: PageProps<"/admin/discounts">) {
  await requireAdmin("admin");
  const [rows, sp] = await Promise.all([listDiscounts(), searchParams]);
  const now = new Date();
  const live = rows.filter((d) => discountState(d, now) === "active").length;

  return (
    <>
      <PageHeader
        title="Discounts"
        description={`${rows.length} code${rows.length === 1 ? "" : "s"}, ${live} usable right now. Customers enter codes at checkout; all times are UTC.`}
        actions={
          <a href="#new-code" className={buttonClass()}>
            <Plus className="size-4" /> New code
          </a>
        }
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Discount code deleted.</p>}

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={<TicketPercent className="size-5" />} title="No discount codes yet" description="Create your first code with the form below." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Min. subtotal</Th>
                <Th>Used</Th>
                <Th>Window</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/discounts/${d.id}`} className="font-mono font-medium text-fg hover:text-amber">
                      {d.code}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{discountLabel(d)}</Td>
                  <Td className="tabular-nums text-muted">{d.minSubtotalCents > 0 ? money(d.minSubtotalCents) : "—"}</Td>
                  <Td className="whitespace-nowrap font-mono text-sm tabular-nums">
                    {d.usedCount} <span className="text-dim">/</span> {d.maxUses ?? "∞"}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    <div>
                      <span className="text-dim">Starts</span> {dateTime(d.startsAt)}
                    </div>
                    <div>
                      <span className="text-dim">Ends</span> {dateTime(d.endsAt)}
                    </div>
                  </Td>
                  <Td>
                    <DiscountStateBadge state={discountState(d, now)} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/admin/discounts/${d.id}`} variant="secondary" size="sm">
                        <Pencil className="size-3.5" /> Edit
                      </LinkButton>
                      <ConfirmButton action={setDiscountActive.bind(null, d.id, !d.isActive)}>
                        {d.isActive ? (
                          <>
                            <PowerOff className="size-3.5" /> Disable
                          </>
                        ) : (
                          <>
                            <Power className="size-3.5" /> Enable
                          </>
                        )}
                      </ConfirmButton>
                      <ConfirmButton
                        action={deleteDiscount.bind(null, d.id)}
                        confirm={`Delete ${d.code} permanently? Customers won't be able to use it. Past orders keep their discount.`}
                        variant="danger"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </ConfirmButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div id="new-code" className="mt-4 scroll-mt-24">
        <Card title="New code" description="Codes are saved in capitals. Leave the dates blank for a code that works until you disable it.">
          <DiscountForm action={saveDiscount.bind(null, null)} resetOnSuccess submitLabel="Create code" />
        </Card>
      </div>
    </>
  );
}
