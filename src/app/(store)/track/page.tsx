import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { endTracking } from "@/actions/account";
import { TrackForm } from "@/components/account/AccountForms";
import { Panel, StatusPills, shortDay } from "@/components/account/AccountShell";
import { PageHero } from "@/components/ui/PageHero";
import { param } from "@/lib/admin/format";
import { getMyOrder, listMyOrders } from "@/lib/account";
import { getCurrentCustomer, getTrackViewer } from "@/lib/auth/customer";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

const usd = (cents: number) => formatPrice(cents / 100);

/** Guests see their orders here after a code sent to the email they ordered with. No account is involved. */
export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const [me, viewer, sp] = await Promise.all([getCurrentCustomer(), getTrackViewer(), searchParams]);
  if (me) redirect("/account"); // an account shows every order already

  return (
    <>
      <PageHero
        kicker="Track your order"
        crumbs={[{ label: "Home", href: "/" }, { label: "Track your order" }]}
        lines={[
          <span key="a">
            Where&apos;s my <span className="text-gradient">order?</span>
          </span>,
        ]}
        description="Status, tracking and everything in it. No account needed: we email you a code."
      />
      <section className="container-x pb-28">
        {viewer ? (
          <Orders customerId={viewer.id} email={viewer.email} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
              <h2 className="font-display text-3xl uppercase">Find your orders</h2>
              <div className="mt-6">
                <TrackForm email={param(sp.email)} />
              </div>
            </div>
            <div className="rounded-3xl border border-line bg-ink-900/30 p-6 md:p-8">
              <h2 className="font-display text-3xl uppercase">How it works</h2>
              <p className="mt-3 text-muted">
                Enter the email you ordered with and we&apos;ll send it a 6-digit code. It works once, for 10 minutes, and shows every order placed with that email.
              </p>
              <p className="mt-3 text-muted">
                Have an account?{" "}
                <Link href="/account/login" className="text-fg underline-offset-4 hover:underline">
                  Log in
                </Link>{" "}
                to see your orders, loyalty points and reviews together.
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

async function Orders({ customerId, email }: { customerId: number; email: string }) {
  const list = await listMyOrders(customerId);
  const orders = (await Promise.all(list.map((o) => getMyOrder(customerId, o.number)))).filter((o) => o !== null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          Orders for <span className="text-fg">{email}</span>
        </p>
        <form action={endTracking}>
          <button type="submit" className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Done
          </button>
        </form>
      </div>
      {orders.map(({ order: o, items }) => (
        <Panel key={o.id} title={<span className="font-mono">{o.number}</span>} action={<StatusPills status={o.status} paymentStatus={o.paymentStatus} />}>
          <p className="text-xs text-dim">
            Placed {shortDay(o.createdAt)}
            {o.shippedAt && ` · shipped ${shortDay(o.shippedAt)}`}
            {o.deliveredAt && ` · delivered ${shortDay(o.deliveredAt)}`}
          </p>
          <ul className="mt-3 divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p>{i.productName}</p>
                  <p className="text-xs text-dim">
                    {i.optionValue ? `${i.optionValue} · ` : ""}
                    {i.quantity} × {usd(i.unitPriceCents)}
                  </p>
                </div>
                <span className="font-mono text-sm">{usd(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-dim">Total</dt>
              <dd className="font-mono">{usd(o.totalCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Shipping to</dt>
              <dd>{[o.city, o.country].filter(Boolean).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Tracking</dt>
              <dd className="font-mono">{o.trackingNumber ? [o.trackingCarrier, o.trackingNumber].filter(Boolean).join(" · ") : "Not shipped yet"}</dd>
            </div>
          </dl>
        </Panel>
      ))}
    </div>
  );
}
