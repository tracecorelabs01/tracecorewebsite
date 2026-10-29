import Link from "next/link";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ReviewForm } from "@/components/account/AccountForms";
import { AccountShell, Panel, Pill, shortDay } from "@/components/account/AccountShell";
import { listReviewable } from "@/lib/account";
import { requireCustomer } from "@/lib/auth/customer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your reviews", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

const STATUS = { pending: ["Waiting for approval", "warn"], approved: ["Published", "ok"], rejected: ["Not published", "dim"] } as const;

export default async function ReviewsPage() {
  const me = await requireCustomer();
  const products = await listReviewable(me.id);
  const defaultName = [me.firstName, me.lastName ? `${me.lastName.slice(0, 1)}.` : ""].filter(Boolean).join(" ");

  return (
    <AccountShell
      active="/account/reviews"
      title={
        <span>
          Your <span className="text-gradient">reviews.</span>
        </span>
      }
      description="Review the products you've bought. We read every review before it goes live."
    >
      {products.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-muted">
            Products from your paid orders show up here for you to review.{" "}
            <Link href="/account" className="text-fg underline-offset-4 hover:underline">
              See your orders
            </Link>
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => {
            const r = p.review;
            return (
              <Panel key={p.productId} title={p.name} action={r && <Pill tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Pill>}>
                {r ? (
                  <div>
                    <span className="flex gap-0.5" role="img" aria-label={`${r.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn("size-4", n <= r.rating ? "fill-blaze text-blaze" : "text-white/20")} aria-hidden />
                      ))}
                    </span>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg/90">{r.body}</p>
                    <p className="mt-3 text-xs text-dim">Sent {shortDay(r.createdAt)}</p>
                  </div>
                ) : (
                  <ReviewForm productId={p.productId} defaultName={defaultName} />
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
