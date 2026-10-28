import { Badge, type Tone } from "@/components/admin/ui";
import type { DiscountState } from "@/lib/admin/discounts";

const DISCOUNT: Record<DiscountState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  "used-up": { label: "Used up", tone: "warn" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export function DiscountStateBadge({ state }: { state: DiscountState }) {
  const { label, tone } = DISCOUNT[state];
  return (
    <Badge tone={tone} className="normal-case">
      {label}
    </Badge>
  );
}

const REVIEW_TONE: Record<string, Tone> = { pending: "warn", approved: "ok", rejected: "danger" };

export function ReviewStatusBadge({ status }: { status: string }) {
  return <Badge tone={REVIEW_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function MessageStatusBadge({ status }: { status: string }) {
  return <Badge tone={status === "open" ? "warn" : "neutral"}>{status}</Badge>;
}

export function SubscriberBadge({ unsubscribedAt }: { unsubscribedAt: Date | null }) {
  return unsubscribedAt ? <Badge>Unsubscribed</Badge> : <Badge tone="ok">Active</Badge>;
}
