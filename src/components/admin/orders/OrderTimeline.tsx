import { CircleDot, CreditCard, Mail, PackagePlus, RefreshCw, ShoppingBag, StickyNote, Truck, type LucideIcon } from "lucide-react";
import { dateTime } from "@/lib/admin/format";

const ICONS: Record<string, LucideIcon> = {
  created: ShoppingBag,
  status: RefreshCw,
  payment: CreditCard,
  shipping: Truck,
  email: Mail,
  restock: PackagePlus,
  note: StickyNote,
};

export type TimelineEvent = { id: number; type: string; message: string; createdAt: Date; adminName: string | null };

/** Order history, newest first. */
export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted">Nothing recorded yet.</p>;
  return (
    <ol>
      {events.map((e, i) => {
        const Icon = ICONS[e.type] ?? CircleDot;
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < events.length - 1 && <span aria-hidden className="absolute bottom-0 left-3.5 top-8 w-px -translate-x-1/2 bg-line-strong" />}
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong bg-ink-850 text-muted">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="break-words text-sm text-fg/90">{e.message}</p>
              <p className="mt-0.5 text-xs text-dim">
                {dateTime(e.createdAt)}
                {e.adminName ? ` · ${e.adminName}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
