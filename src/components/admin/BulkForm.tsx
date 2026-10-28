"use client";

import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import type { ActionState } from "./forms";
import { buttonClass, inputClass } from "./ui";
import { cn } from "@/lib/utils";

export type BulkAction = {
  value: string;
  label: string;
  /** Extra value the action needs, sent as `value`. */
  input?: { label: string; type: "number"; min?: number; max?: number; step?: number; placeholder?: string } | { label: string; type: "select"; options: { value: string; label: string }[] };
  /** Ask before running, for destructive actions. `{n}` is replaced with the count. */
  confirm?: string;
};

type Ctx = { selected: Set<number>; toggle: (id: number) => void; ids: number[]; setAll: (on: boolean) => void };
const BulkContext = createContext<Ctx | null>(null);
const useBulk = () => use(BulkContext)!;

const checkboxClass = "size-4 cursor-pointer rounded border-line-strong bg-ink-950 accent-[#ff3d00]";

/**
 * Row selection plus a bulk action bar. Wrap the whole list card (empty state included, so the result message
 * survives a list that empties out); render <BulkCheckbox> per row and <BulkSelectAll> in its header.
 * Key it by the view (filter, search, page) so selection and message reset when the admin navigates.
 */
export function BulkForm({
  ids,
  actions,
  run,
  noun,
  children,
}: {
  ids: number[];
  actions: BulkAction[];
  run: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  noun: [singular: string, plural: string];
  children: ReactNode;
}) {
  const [picked, setSelected] = useState<Set<number>>(new Set());
  const [choice, setChoice] = useState(actions[0]?.value ?? "");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const current = actions.find((a) => a.value === choice);
  // Rows can disappear after an action refreshes the list; only count what's still shown.
  const selected = new Set(ids.filter((id) => picked.has(id)));
  const count = selected.size;
  const label = `${count} ${count === 1 ? noun[0] : noun[1]}`;

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function apply() {
    if (!current || !count) return;
    if (current.confirm && !window.confirm(current.confirm.replace("{n}", label))) return;
    const fd = new FormData();
    for (const id of selected) fd.append("ids", String(id));
    fd.set("action", current.value);
    fd.set("value", value);
    startTransition(async () => {
      const res = await run(null, fd);
      setResult(res);
      if (res?.ok) {
        setSelected(new Set());
        setValue("");
      }
    });
  }

  return (
    <BulkContext value={{ selected, toggle, ids, setAll: (on) => setSelected(on ? new Set(ids) : new Set()) }}>
      {result?.message && (
        <p role="status" className={cn("mb-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm", result.ok ? "border-ok/30 bg-ok/10 text-fg" : "border-ember/40 bg-ember/10 text-fg")}>
          {result.ok ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : <XCircle className="size-4 shrink-0 text-ember" />}
          {result.message}
        </p>
      )}
      {children}
      {count > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line-strong bg-ink-850/95 p-3 shadow-2xl backdrop-blur">
          <span className="px-1 text-sm font-medium tabular-nums">{label} selected</span>
          <select
            aria-label="Bulk action"
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setValue("");
            }}
            className={cn(inputClass, "w-auto min-w-48")}
          >
            {actions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          {current?.input?.type === "number" && (
            <input
              type="number"
              aria-label={current.input.label}
              placeholder={current.input.placeholder ?? current.input.label}
              min={current.input.min}
              max={current.input.max}
              step={current.input.step ?? 1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className={cn(inputClass, "w-36 tabular-nums")}
            />
          )}
          {current?.input?.type === "select" && (
            <select aria-label={current.input.label} value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputClass, "w-auto min-w-40")}>
              <option value="" disabled>
                {current.input.label}…
              </option>
              {current.input.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={apply} disabled={pending || (Boolean(current?.input) && !value)} className={buttonClass(current?.confirm ? "danger" : "primary")}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Apply
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={cn(buttonClass("ghost"), "ml-auto")}>
            <X className="size-4" /> Clear
          </button>
        </div>
      )}
    </BulkContext>
  );
}

/** Renders nothing outside a <BulkForm>, so shared row components can always include it. */
export function BulkCheckbox({ id, label }: { id: number; label: string }) {
  const ctx = use(BulkContext);
  if (!ctx) return null;
  return <input type="checkbox" aria-label={`Select ${label}`} checked={ctx.selected.has(id)} onChange={() => ctx.toggle(id)} className={checkboxClass} />;
}

export function BulkSelectAll({ label = "Select all on this page" }: { label?: string }) {
  const { selected, ids, setAll } = useBulk();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={() => setAll(!all)}
      className={checkboxClass}
    />
  );
}
