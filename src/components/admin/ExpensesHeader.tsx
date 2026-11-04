import type { ReactNode } from "react";
import { PERIODS, type Period } from "@/lib/admin/expenses";
import { cn } from "@/lib/utils";
import { buttonClass, FilterTabs, inputClass, PageHeader, qs } from "./ui";

/** The period as search params, so links and forms keep it. This month is the default and needs none. */
export function periodQuery(p: Period) {
  return { period: p.key === "month" ? undefined : p.key, from: p.key === "custom" ? (p.from ?? undefined) : undefined, to: p.key === "custom" ? (p.to ?? undefined) : undefined };
}

/** The Expenses heading and its tabs. `period` carries the chosen dates between Profit and Other expenses. */
export function ExpensesHeader({ active, period, actions }: { active: "profit" | "costs" | "other"; period?: Period; actions?: ReactNode }) {
  const keep = period ? qs(periodQuery(period)) : "";
  return (
    <>
      <PageHeader
        title="Expenses"
        description="Profit works itself out: every paid order, minus the costs set on its products, minus any other expenses you add. Amounts are in USD and dates in UTC."
        actions={actions}
      />
      <div className="mb-4">
        <FilterTabs
          items={[
            { label: "Profit", href: `/admin/expenses${keep}`, active: active === "profit" },
            { label: "Cost fields", href: "/admin/expenses/costs", active: active === "costs" },
            { label: "Other expenses", href: `/admin/expenses/other${keep}`, active: active === "other" },
          ]}
        />
      </div>
    </>
  );
}

/** This month, last month… or a custom range, for the page at `base`, keeping its other filters. */
export function PeriodFilter({ base, period, keep = {} }: { base: string; period: Period; keep?: Record<string, string | undefined> }) {
  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
      {/* Sized to its options, so it doesn't read as a second row of page tabs. */}
      <div className="max-w-full self-start 2xl:self-center">
        <FilterTabs items={Object.entries(PERIODS).map(([key, label]) => ({ label, href: `${base}${qs({ period: key === "month" ? undefined : key, ...keep })}`, active: period.key === key }))} />
      </div>
      <form action={base} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="period" value="custom" />
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="date" name="from" defaultValue={period.from ?? ""} aria-label="From" className={cn(inputClass, "w-auto")} />
        <span className="text-sm text-dim">to</span>
        <input type="date" name="to" defaultValue={period.to ?? ""} aria-label="To" className={cn(inputClass, "w-auto")} />
        <button type="submit" className={buttonClass("secondary")}>
          Apply
        </button>
      </form>
    </div>
  );
}
