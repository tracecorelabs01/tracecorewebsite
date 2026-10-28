import Link from "next/link";
import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { MessageStatusBadge } from "@/components/admin/community/badges";
import { Card, EmptyState, FilterTabs, PageHeader, Pagination, qs, SearchBox, Table, Td, Th } from "@/components/admin/ui";
import { dateTime, pageParam, param } from "@/lib/admin/format";
import { listMessages, type MessageFilter } from "@/lib/admin/messages";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Messages" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireAdmin("staff");
  const sp = await searchParams;
  const q = param(sp.q)?.trim() || undefined;
  const raw = param(sp.status);
  // Open conversations are the inbox, so they're the default view.
  const status: MessageFilter = raw === "closed" || raw === "all" ? raw : "open";
  const page = pageParam(sp.page);
  const { rows, total, pageCount, counts } = await listMessages({ q, status, page });

  const statusParam = status === "open" ? undefined : status;
  const tab = (label: string, value: MessageFilter) => ({
    label,
    href: `/admin/messages${qs({ status: value === "open" ? undefined : value, q })}`,
    active: status === value,
    count: counts[value] ?? 0,
  });

  return (
    <>
      <PageHeader
        title="Messages"
        description={q ? `${total} message${total === 1 ? "" : "s"} matching “${q}”` : "Contact-form messages from the support page. Reply by email, then close the conversation."}
      />
      {param(sp.deleted) && <p className="mb-4 rounded-xl border border-line bg-ink-900/70 px-4 py-3 text-sm text-muted">Message deleted.</p>}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterTabs items={[tab("Open", "open"), tab("Closed", "closed"), tab("All", "all")]} />
        <SearchBox action="/admin/messages" defaultValue={q} placeholder="Search name, email, topic, order" keep={{ status: statusParam }} />
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title={q ? "No messages match your search" : status === "open" ? "No open messages" : "No messages here"}
            description={q ? "Try a different search, or check the other tabs." : status === "open" ? "You're all caught up. New contact-form messages land here." : undefined}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th>Topic</Th>
                  <Th>Order</Th>
                  <Th>Received</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/admin/messages/${m.id}`} className="font-medium text-fg hover:text-amber">
                        {m.name}
                      </Link>
                      <div className="text-xs text-dim">{m.email}</div>
                    </Td>
                    <Td>
                      <Link href={`/admin/messages/${m.id}`} className="text-fg/90 hover:text-amber">
                        {m.topic}
                      </Link>
                      <div className="max-w-md truncate text-xs text-dim">{m.preview}</div>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-muted">{m.orderNumber || "—"}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted">{dateTime(m.createdAt)}</Td>
                    <Td>
                      <MessageStatusBadge status={m.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/messages${qs({ status: statusParam, q, page: n })}`} />
          </>
        )}
      </Card>
    </>
  );
}
