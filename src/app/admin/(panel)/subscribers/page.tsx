import type { Metadata } from "next";
import { BellOff, BellRing, Download, Mail, MailCheck, MailX, Trash2 } from "lucide-react";
import { deleteSubscriber, setSubscribed } from "@/actions/admin/subscribers";
import { SubscriberBadge } from "@/components/admin/community/badges";
import { ConfirmButton } from "@/components/admin/forms";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, qs, SearchBox, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { pageParam, param, shortDate } from "@/lib/admin/format";
import { listSubscribers } from "@/lib/admin/subscribers";
import { hasRole, requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Subscribers" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  const user = await requireAdmin("staff");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const page = pageParam(sp.page);
  const { rows, total, pageCount, stats } = await listSubscribers({ q, page });
  const canDelete = hasRole(user, "admin");

  return (
    <>
      <PageHeader
        title="Subscribers"
        description="People who joined the mailing list on the storefront. Only email active subscribers."
        actions={
          // A plain download: `download` stops client-side routing and prefetching would run the export early.
          <LinkButton href="/api/admin/export/subscribers" prefetch={false} download variant="secondary">
            <Download className="size-4" /> Export CSV
          </LinkButton>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={stats.active.toLocaleString("en-US")} hint="Receiving emails" icon={<MailCheck className="size-4" />} tone="brand" />
        <StatCard label="Unsubscribed" value={stats.unsubscribed.toLocaleString("en-US")} hint="Opted out — don't email" icon={<MailX className="size-4" />} />
        <StatCard label="Total" value={stats.total.toLocaleString("en-US")} hint="All sign-ups" icon={<Mail className="size-4" />} />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">{q ? `${total} matching “${q}”` : `${total} subscriber${total === 1 ? "" : "s"}`}</p>
        <SearchBox action="/admin/subscribers" defaultValue={q} placeholder="Search email or source" />
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-5" />}
            title={q ? "No subscribers match your search" : "No subscribers yet"}
            description={q ? "Try a different search." : "Sign-ups from the newsletter form in the storefront footer appear here."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Subscribed</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td className="break-all font-medium text-fg/90">{s.email}</Td>
                    <Td className="font-mono text-xs text-muted">{s.source}</Td>
                    <Td className="whitespace-nowrap text-muted">{shortDate(s.createdAt)}</Td>
                    <Td className="whitespace-nowrap">
                      <SubscriberBadge unsubscribedAt={s.unsubscribedAt} />
                      {s.unsubscribedAt && <div className="mt-1 text-[11px] text-dim">since {shortDate(s.unsubscribedAt)}</div>}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {s.unsubscribedAt ? (
                          <ConfirmButton
                            action={setSubscribed.bind(null, s.id, true)}
                            confirm={`Resubscribe ${s.email}? Only do this if they asked to be added back to the list.`}
                          >
                            <BellRing className="size-3.5" /> Resubscribe
                          </ConfirmButton>
                        ) : (
                          <ConfirmButton action={setSubscribed.bind(null, s.id, false)}>
                            <BellOff className="size-3.5" /> Unsubscribe
                          </ConfirmButton>
                        )}
                        {canDelete && (
                          <ConfirmButton
                            action={deleteSubscriber.bind(null, s.id)}
                            confirm={`Delete ${s.email} permanently? Use this for data-deletion requests — to stop emails, unsubscribe instead.`}
                            variant="danger"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </ConfirmButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/subscribers${qs({ q, page: n })}`} />
          </>
        )}
      </Card>
    </>
  );
}
