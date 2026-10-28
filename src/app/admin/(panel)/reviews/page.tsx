import type { Metadata } from "next";
import { Star } from "lucide-react";
import { bulkModerateReviews } from "@/actions/admin/reviews";
import { BulkForm, BulkSelectAll, type BulkAction } from "@/components/admin/BulkForm";
import { AddReviewForm } from "@/components/admin/community/AddReviewForm";
import { ReviewCard } from "@/components/admin/community/ReviewCard";
import { Card, EmptyState, FilterTabs, PageHeader, Pagination, qs } from "@/components/admin/ui";
import { pageParam, param } from "@/lib/admin/format";
import { listReviewProducts, listReviews, REVIEW_STATUSES, type ReviewStatus } from "@/lib/admin/reviews";
import { hasRole, requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };
// Admin pages read the session and live data on every request.
export const instant = false;

const EMPTY: Record<ReviewStatus | "all", { title: string; description: string }> = {
  pending: { title: "Nothing to moderate", description: "New reviews wait here until someone approves or rejects them." },
  approved: { title: "No approved reviews yet", description: "Approved reviews appear on the storefront and in product star ratings." },
  rejected: { title: "No rejected reviews", description: "Reviews you reject stay here, hidden from the storefront." },
  all: { title: "No reviews yet", description: "Reviews from customers will show up here." },
};

const bulkActions: BulkAction[] = [
  { value: "approved", label: "Approve (publish)" },
  { value: "rejected", label: "Reject (hide)" },
  { value: "delete", label: "Delete", confirm: "Delete {n}? This can't be undone." },
];

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const user = await requireAdmin("staff");
  const sp = await searchParams;
  const raw = param(sp.status);
  // Pending is the moderation queue, so it's the default view.
  const status: ReviewStatus | "all" = raw === "all" || (REVIEW_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ReviewStatus | "all") : "pending";
  const page = pageParam(sp.page);
  const canAdd = hasRole(user, "admin");
  const [{ rows, pageCount, counts }, products] = await Promise.all([listReviews({ status, page }), canAdd ? listReviewProducts() : []]);

  const statusParam = status === "pending" ? undefined : status;
  const tab = (label: string, value: ReviewStatus | "all") => ({
    label,
    href: `/admin/reviews${qs({ status: value === "pending" ? undefined : value })}`,
    active: status === value,
    count: counts[value] ?? 0,
  });
  const empty = EMPTY[status];

  return (
    <>
      <PageHeader title="Reviews" description="Approved reviews are published on the storefront and set each product's star rating." />
      <div className="mb-4">
        <FilterTabs items={[tab("Pending", "pending"), tab("Approved", "approved"), tab("Rejected", "rejected"), tab("All", "all")]} />
      </div>

      <div className={cn("grid gap-4", canAdd && "xl:grid-cols-3")}>
        <div className={cn("space-y-3", canAdd && "xl:col-span-2")}>
          <BulkForm key={`${status}|${page}`} ids={rows.map((r) => r.id)} actions={bulkActions} run={bulkModerateReviews} noun={["review", "reviews"]}>
            {rows.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Star className="size-5" />}
                  title={empty.title}
                  description={status === "all" && canAdd ? "Add genuine reviews from Trustpilot, Discord or email with the form." : empty.description}
                />
              </Card>
            ) : (
              <>
                <label className="mb-3 flex w-fit cursor-pointer items-center gap-2.5 px-1 text-sm text-muted">
                  <BulkSelectAll /> Select all on this page
                </label>
                <div className="space-y-3">
                  {rows.map((r) => (
                    <ReviewCard key={r.id} review={r} />
                  ))}
                </div>
                {pageCount > 1 && (
                  <Card padded={false} className="mt-3 [&_nav]:border-t-0">
                    <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/reviews${qs({ status: statusParam, page: n })}`} />
                  </Card>
                )}
              </>
            )}
          </BulkForm>
        </div>

        {canAdd && (
          <Card title="Add a review" description="Import a review a customer left on Trustpilot, Discord or by email. It's published straight away." className="h-fit">
            <AddReviewForm products={products} />
          </Card>
        )}
      </div>
    </>
  );
}
