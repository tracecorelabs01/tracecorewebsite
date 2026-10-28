import type { Metadata } from "next";
import { History } from "lucide-react";
import { Badge, Card, EmptyState, FilterTabs, PageHeader, Pagination, qs, SearchBox, Table, Td, Th, type Tone } from "@/components/admin/ui";
import { ACTIVITY_ENTITIES, listActivity, type ActivityEntity } from "@/lib/admin/activity";
import { dateTime, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Activity" };
// Admin pages read the session and live data on every request.
export const instant = false;

const ENTITY_LABELS: Record<ActivityEntity, string> = {
  order: "Orders",
  product: "Products",
  category: "Categories",
  discount: "Discounts",
  review: "Reviews",
  message: "Messages",
  subscriber: "Subscribers",
  customer: "Customers",
  settings: "Settings",
  staff: "Staff",
  session: "Sessions",
};

const ACTION_TONE: Record<string, Tone> = {
  create: "ok",
  approve: "ok",
  enable: "ok",
  update: "info",
  status: "info",
  role: "brand",
  password: "brand",
  stock: "warn",
  disable: "warn",
  revoke: "warn",
  delete: "danger",
  reject: "danger",
  cancel: "danger",
  refund: "danger",
};

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const user = await requireAdmin("admin");
  const sp = await searchParams;
  const q = param(sp.q)?.trim().slice(0, 100) || undefined;
  const entity = ACTIVITY_ENTITIES.find((e) => e === param(sp.entity));
  const page = pageParam(sp.page);
  const { rows, total, pageCount, counts } = await listActivity({ entity, q, page });

  const tab = (label: string, value?: ActivityEntity) => ({ label, href: `/admin/activity${qs({ entity: value, q })}`, active: entity === value, count: counts[value ?? "all"] ?? 0 });

  return (
    <>
      <PageHeader
        title="Activity"
        description={`${total.toLocaleString("en-US")} ${total === 1 ? "entry" : "entries"}${q ? ` matching “${q}”` : ""} · what changed in the console and who did it, newest first.`}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <FilterTabs items={[tab("All"), ...ACTIVITY_ENTITIES.map((e) => tab(ENTITY_LABELS[e], e))]} />
        </div>
        <SearchBox action="/admin/activity" defaultValue={q} placeholder="Search summaries" keep={{ entity }} />
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={q || entity ? "No matching activity" : "No activity yet"}
            description={q || entity ? "Try another filter or search." : "Changes made in the console will be recorded here."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Admin</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Summary</Th>
                  <Th className="text-right">Time</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td className="whitespace-nowrap">
                      {r.adminName ? (
                        <span className="text-fg/90">
                          {r.adminName}
                          {r.adminId === user.id && <span className="text-dim"> (you)</span>}
                        </span>
                      ) : (
                        <span className="text-dim">System</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={ACTION_TONE[r.action] ?? "neutral"}>{r.action}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {r.entity}
                      {r.entityId && <span className="font-mono text-[11px] text-dim"> #{r.entityId}</span>}
                    </Td>
                    <Td className="min-w-[280px] text-fg/90">{r.summary}</Td>
                    <Td className="whitespace-nowrap text-right text-xs text-dim">{dateTime(r.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} href={(n) => `/admin/activity${qs({ entity, q, page: n })}`} />
          </>
        )}
      </Card>
    </>
  );
}
