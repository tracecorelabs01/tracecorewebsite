import { Check, Trash2, X } from "lucide-react";
import { deleteReview, setReviewStatus } from "@/actions/admin/reviews";
import { ConfirmButton } from "@/components/admin/forms";
import { Badge, Card } from "@/components/admin/ui";
import { shortDate } from "@/lib/admin/format";
import { ReviewStatusBadge } from "./badges";
import { Stars } from "./Stars";

type Review = {
  id: number;
  name: string;
  handle: string | null;
  email: string | null;
  rating: number;
  body: string;
  status: "pending" | "approved" | "rejected";
  source: string;
  createdAt: Date;
  product: string | null;
};

/** One review in the moderation list, with approve / reject / delete. */
export function ReviewCard({ review: r }: { review: Review }) {
  return (
    <Card>
      <article>
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={r.rating} />
              <span className="font-medium text-fg">{r.name}</span>
              {r.handle && <span className="font-mono text-xs text-dim">{r.handle}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className={r.product ? "text-fg/90" : undefined}>{r.product ?? "General"}</span>
              <span className="text-dim">·</span>
              <time dateTime={r.createdAt.toISOString()}>{shortDate(r.createdAt)}</time>
              <Badge>{r.source}</Badge>
              {r.email && <span className="break-all text-dim">{r.email}</span>}
            </div>
          </div>
          <ReviewStatusBadge status={r.status} />
        </header>
        <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-fg/90">{r.body}</p>
        <footer className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {r.status !== "approved" && (
            <ConfirmButton action={setReviewStatus.bind(null, r.id, "approved")} variant="primary">
              <Check className="size-3.5" /> Approve
            </ConfirmButton>
          )}
          {r.status !== "rejected" && (
            <ConfirmButton action={setReviewStatus.bind(null, r.id, "rejected")}>
              <X className="size-3.5" /> Reject
            </ConfirmButton>
          )}
          <ConfirmButton action={deleteReview.bind(null, r.id)} confirm={`Delete the review from ${r.name} permanently?`} variant="danger">
            <Trash2 className="size-3.5" /> Delete
          </ConfirmButton>
        </footer>
      </article>
    </Card>
  );
}
