"use client";

import { commissionLabel, percentLabel } from "@/lib/affiliate-labels";
import { centsToInput } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { ActionForm, SubmitButton, useActionForm, type ActionState } from "../forms";
import { inputClass } from "../ui";

export type RuleRow = {
  product: { id: number; name: string; priceCents: number };
  rule: { visible: boolean | null; commissionKind: "percent" | "fixed" | null; commissionValue: number | null; priceCents: number | null } | null;
  /** What applies without this level's rule. */
  inherited: { visible: boolean; commission: { kind: "percent" | "fixed"; value: number }; floorCents: number };
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const cell = cn(inputClass, "h-9 px-2.5 text-sm");

/**
 * Per product, at one level (the program, a group or a partner): whether partners can promote it, its commission
 * and the lowest price a partner's customers can pay. Blank fields show what applies without them, in brackets.
 */
export function RulesTable({ level, rows, action }: { level: "program" | "group" | "partner"; rows: RuleRow[]; action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="grid gap-4" showStatus={false}>
      <Rows level={level} rows={rows} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
        <p className="text-xs text-dim">
          {level === "program"
            ? "Only products in the program can be promoted. A commission or lowest price set here holds for every partner, whatever their group's rates, unless their group or own page has a row for the product. Blank uses the general rates."
            : "Fill in only what should differ for one product. Blank shows what applies now, in brackets: a row for the product at a level above, or else the general commission and discount limit."}
        </p>
        <SubmitButton pendingText="Saving…">Save products</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Rows({ level, rows }: { level: "program" | "group" | "partner"; rows: RuleRow[] }) {
  const { state } = useActionForm();
  const errors = state?.fieldErrors ?? {};
  return (
    <div className="overflow-x-auto">
      {state?.message && <p className={cn("px-5 pt-4 text-sm", state.ok ? "text-ok" : "text-[#ff6b5e]")}>{state.message}</p>}
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
            <th className="px-5 py-3 font-normal">Product</th>
            <th className="px-3 py-3 font-normal">{level === "program" ? "In program" : "Can promote"}</th>
            <th className="px-3 py-3 font-normal">Commission</th>
            <th className="px-3 py-3 font-normal">Lowest customer price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product: p, rule: r, inherited: i }) => (
            <tr key={p.id} className="border-b border-line/70 align-top">
              <td className="px-5 py-3">
                <div className="font-medium text-fg">{p.name}</div>
                <div className="text-xs text-dim">Regular {usd(p.priceCents)}</div>
              </td>
              <td className="px-3 py-3">
                <select name={`v_${p.id}`} defaultValue={r?.visible == null ? "" : r.visible ? "1" : "0"} className={cn(cell, "w-40")}>
                  {level === "program" ? (
                    <>
                      <option value="">Not in program</option>
                      <option value="1">In program</option>
                    </>
                  ) : (
                    <>
                      <option value="">Inherit ({i.visible ? "yes" : "no"})</option>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </>
                  )}
                </select>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-2">
                  <select name={`k_${p.id}`} defaultValue={r?.commissionKind ?? ""} className={cn(cell, "w-44")}>
                    <option value="">
                      {level === "program" ? "Default" : "Inherit"} ({commissionLabel(i.commission)})
                    </option>
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed $ per unit</option>
                  </select>
                  <input
                    name={`n_${p.id}`}
                    inputMode="decimal"
                    defaultValue={r?.commissionValue != null ? centsToInput(r.commissionValue) : ""}
                    placeholder={i.commission.kind === "percent" ? "e.g. 10" : "e.g. 5.00"}
                    aria-label={`${p.name} commission`}
                    className={cn(cell, "w-24", errors[`n_${p.id}`] && "border-ember")}
                  />
                </div>
                {errors[`n_${p.id}`] && <p className="mt-1 text-xs text-[#ff6b5e]">{errors[`n_${p.id}`]}</p>}
              </td>
              <td className="px-3 py-3">
                <input
                  name={`p_${p.id}`}
                  inputMode="decimal"
                  defaultValue={r?.priceCents != null ? centsToInput(r.priceCents) : ""}
                  placeholder={`${usd(i.floorCents)}${i.floorCents < p.priceCents ? ` (${percentLabel(Math.round((1 - i.floorCents / p.priceCents) * 1000) * 10)} off)` : " (regular)"}`}
                  aria-label={`${p.name} lowest customer price`}
                  className={cn(cell, "w-40", errors[`p_${p.id}`] && "border-ember")}
                />
                {errors[`p_${p.id}`] && <p className="mt-1 text-xs text-[#ff6b5e]">{errors[`p_${p.id}`]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
