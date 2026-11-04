import Link from "next/link";
import type { Metadata } from "next";
import { Calculator, Trash2 } from "lucide-react";
import { deleteCostField, saveCostField } from "@/actions/admin/costs";
import { ActionForm, ConfirmButton, Field, Input, Select, SubmitButton } from "@/components/admin/forms";
import { ExpensesHeader } from "@/components/admin/ExpensesHeader";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/admin/ui";
import { getCostOverview } from "@/lib/admin/costs";
import { money } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { COST_KIND_HINTS, COST_KIND_LABELS, costInput, type CostKind } from "@/lib/costs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cost fields" };
// Admin pages read the session and live data on every request.
export const instant = false;

/** How many products set their own value for a cost, and what the rest do. */
function usageText(n: number, hasDefault: boolean) {
  const own = n === 0 ? "No product sets its own value" : n === 1 ? "1 product sets its own value" : `${n} products set their own value`;
  return `${own}${hasDefault ? `; ${n ? "the rest use" : "all use"} the default.` : "."}`;
}

export default async function CostFieldsPage() {
  await requireAdmin("admin");
  const { fields, usage, profits } = await getCostOverview();

  return (
    <>
      <ExpensesHeader active="costs" />
      <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">
        Add each cost once here, e.g. supplier price, postage and payment fee. Every product then shows these fields on its Costs &amp; profit tab, to fill in once. From then on each order&apos;s costs and profit are worked out automatically. A default fills in for products you haven&apos;t set.
      </p>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {fields.length === 0 ? (
            <Card>
              <EmptyState icon={<Calculator className="size-5" />} title="No cost fields yet" description="Add your first one, e.g. Supplier price as an amount per item." />
            </Card>
          ) : (
            fields.map((f) => (
              <Card key={f.id}>
                <ActionForm action={saveCostField.bind(null, f.id)} className="grid gap-3 sm:grid-cols-12 sm:items-start">
                  <Field label="Name" name="name" className="sm:col-span-5">
                    <Input name="name" defaultValue={f.name} required maxLength={60} />
                  </Field>
                  <div className="sm:col-span-3">
                    <span className="mb-1.5 block text-xs font-medium text-muted">Counted as</span>
                    <span className="flex h-10 items-center text-sm">{COST_KIND_LABELS[f.kind]}</span>
                  </div>
                  <Field label={`Default (${f.kind === "percent" ? "%" : "USD"})`} name="defaultValue" className="sm:col-span-4">
                    <Input name="defaultValue" inputMode="decimal" defaultValue={costInput(f.defaultValue)} placeholder="None" autoComplete="off" className="tabular-nums" />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-12">
                    <span className="text-xs text-dim">
                      {COST_KIND_HINTS[f.kind]} {usageText(usage.get(f.id) ?? 0, f.defaultValue != null)}
                    </span>
                    <div className="flex gap-2">
                      <ConfirmButton
                        action={deleteCostField.bind(null, f.id)}
                        confirm={`Delete “${f.name}”? Products lose their values for it. Orders already placed keep the costs they recorded.`}
                        variant="danger"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </ConfirmButton>
                      <SubmitButton variant="secondary" size="sm">
                        Save
                      </SubmitButton>
                    </div>
                  </div>
                </ActionForm>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card title="Add a cost field" className="h-fit">
            <ActionForm action={saveCostField.bind(null, null)} resetOnSuccess className="space-y-4">
              <Field label="Name" name="name">
                <Input name="name" required maxLength={60} placeholder="Supplier price" autoComplete="off" />
              </Field>
              <Field label="Counted as" name="kind" hint="Can't be changed later: it decides what each product's value means.">
                <Select name="kind" defaultValue="per-item">
                  {(Object.keys(COST_KIND_LABELS) as CostKind[]).map((k) => (
                    <option key={k} value={k}>
                      {COST_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Default (optional)" name="defaultValue" hint="Used by products without their own value: an amount in USD, or a percent such as 1.85.">
                <Input name="defaultValue" inputMode="decimal" placeholder="None" autoComplete="off" />
              </Field>
              <SubmitButton className="w-full">Add cost field</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="How profit is worked out">
            <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted">
              <li>Each paid order&apos;s costs are worked out from its products&apos; values and taken off its revenue. Nothing to enter per order.</li>
              <li>Orders keep the costs they had when they were placed. Orders from before you set costs up use today&apos;s values.</li>
              <li>Other expenses is only for spending outside orders (rent, ads). Don&apos;t add these costs there too, or they&apos;ll count twice.</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Profit per sale" description="One of each product ordered on its own, with the store's shipping charge." padded={false} className="mt-4">
        {profits.length === 0 ? (
          <EmptyState title="No products yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Customer pays</Th>
                <Th className="text-right">Costs</Th>
                <Th className="text-right">Profit</Th>
                <Th className="text-right">Margin</Th>
              </tr>
            </thead>
            <tbody>
              {profits.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/admin/products/${p.id}#costs`} className="hover:text-amber">
                      {p.name}
                    </Link>
                    {p.status === "draft" && (
                      <Badge className="ml-2" tone="neutral">
                        Draft
                      </Badge>
                    )}
                    {fields.length > 0 && !p.costsSet && (
                      <Badge className="ml-2" tone="warn">
                        Costs not set
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{money(p.paidCents)}</Td>
                  <Td className="text-right font-mono tabular-nums text-muted">{p.costCents ? money(p.costCents) : "—"}</Td>
                  <Td className={cn("text-right font-mono tabular-nums", !p.costsSet ? "text-dim" : p.profitCents < 0 ? "text-warn" : "text-ok")}>{money(p.profitCents)}</Td>
                  <Td className="text-right tabular-nums text-muted">{p.paidCents ? `${((p.profitCents / p.paidCents) * 100).toFixed(1)}%` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
