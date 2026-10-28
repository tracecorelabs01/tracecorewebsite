import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Reply, RotateCcw, Trash2 } from "lucide-react";
import { deleteMessage, setMessageStatus } from "@/actions/admin/messages";
import { MessageStatusBadge } from "@/components/admin/community/badges";
import { ConfirmButton } from "@/components/admin/forms";
import { buttonClass, Card, DescriptionList, OrderStatusBadge, PageHeader } from "@/components/admin/ui";
import { dateTime } from "@/lib/admin/format";
import { getMessage } from "@/lib/admin/messages";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Message" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function MessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  await requireAdmin("staff");
  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId) || messageId < 1) notFound();
  const data = await getMessage(messageId);
  if (!data) notFound();
  const { message: m, order } = data;
  const mailto = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`;

  return (
    <>
      <PageHeader
        title={m.topic}
        description={`From ${m.name} · ${dateTime(m.createdAt)}`}
        back={{ href: "/admin/messages", label: "Messages" }}
        actions={
          <>
            <a href={mailto} className={buttonClass("primary", "sm")}>
              <Reply className="size-3.5" /> Reply by email
            </a>
            {m.status === "open" ? (
              <ConfirmButton action={setMessageStatus.bind(null, m.id, "closed")}>
                <CheckCircle2 className="size-3.5" /> Close
              </ConfirmButton>
            ) : (
              <ConfirmButton action={setMessageStatus.bind(null, m.id, "open")}>
                <RotateCcw className="size-3.5" /> Reopen
              </ConfirmButton>
            )}
            <ConfirmButton action={deleteMessage.bind(null, m.id)} confirm={`Delete this message from ${m.name} permanently?`} variant="danger">
              <Trash2 className="size-3.5" /> Delete
            </ConfirmButton>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Message" actions={<MessageStatusBadge status={m.status} />} className="xl:col-span-2">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90">{m.body}</p>
        </Card>
        <Card title="Sender" className="h-fit">
          <DescriptionList
            items={[
              { label: "Name", value: m.name },
              {
                label: "Email",
                value: (
                  <a href={mailto} className="break-all hover:text-amber">
                    {m.email}
                  </a>
                ),
              },
              {
                label: "Order",
                value: !m.orderNumber ? (
                  "—"
                ) : order ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-amber hover:underline">
                      {order.number}
                    </Link>
                    <OrderStatusBadge status={order.status} />
                  </span>
                ) : (
                  <span>
                    <span className="font-mono">{m.orderNumber}</span> <span className="text-xs text-dim">· no matching order</span>
                  </span>
                ),
              },
              { label: "Topic", value: m.topic },
              { label: "Received", value: dateTime(m.createdAt) },
              ...(m.ip ? [{ label: "IP address", value: <span className="font-mono text-xs">{m.ip}</span> }] : []),
            ]}
          />
        </Card>
      </div>
    </>
  );
}
