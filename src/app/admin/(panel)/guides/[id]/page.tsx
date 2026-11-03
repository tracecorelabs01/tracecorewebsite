import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, CheckCircle2, ExternalLink, Trash2 } from "lucide-react";
import { deleteGuide, markReviewed, saveGuideAction } from "@/actions/admin/guides";
import { ConfirmButton } from "@/components/admin/forms";
import { GuideForm } from "@/components/admin/guides/GuideForm";
import { PageHeader } from "@/components/admin/ui";
import { param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { getCatalog, getTokenContext } from "@/lib/catalog/server";
import { getGuideForEdit, listGuideRevisions } from "@/lib/guides";

export const metadata: Metadata = { title: "Edit guide" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function EditGuidePage({ params, searchParams }: PageProps<"/admin/guides/[id]">) {
  await requireAdmin("admin");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const guideId = Number(id);
  if (!Number.isInteger(guideId)) notFound();
  const [guide, revisions, { products }, { settings }] = await Promise.all([getGuideForEdit(guideId), listGuideRevisions(guideId), getCatalog(), getTokenContext()]);
  if (!guide) notFound();

  return (
    <>
      <PageHeader
        title={guide.title}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-mono text-xs">/guides/{guide.slug}</span>
            {guide.reviewedAt && <span>Last reviewed {shortDate(guide.reviewedAt)}{guide.reviewedBy ? ` by ${guide.reviewedBy}` : ""}</span>}
            {guide.reviewDue && <span>Review due {shortDate(guide.reviewDue)}</span>}
          </span>
        }
        back={{ href: "/admin/guides", label: "Guides" }}
        actions={
          <>
            {guide.status === "published" && (
              <a href={`/guides/${guide.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-muted hover:bg-white/5 hover:text-fg">
                View in store <ExternalLink className="size-3.5" />
              </a>
            )}
            {guide.status === "published" && (
              <ConfirmButton action={markReviewed.bind(null, guide.id)} confirm="Mark this guide as checked against the hardware today? Its next review moves 6 months on.">
                <CalendarCheck className="size-3.5" /> Mark reviewed
              </ConfirmButton>
            )}
            <ConfirmButton action={deleteGuide.bind(null, guide.id)} confirm={`Delete “${guide.title}” and its revisions permanently? Its URL will stop working.`} variant="danger">
              <Trash2 className="size-3.5" /> Delete
            </ConfirmButton>
          </>
        }
      />
      {param(sp.created) && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-ok" /> Guide created.
        </p>
      )}
      <GuideForm
        action={saveGuideAction.bind(null, guide.id)}
        guide={guide}
        products={products.map(({ slug, name, category, price, status }) => ({ slug, name, category, price, status }))}
        revisions={revisions}
        settings={{ freeShippingThreshold: settings.freeShippingThreshold, flatShipping: settings.flatShipping, supportEmail: settings.supportEmail }}
      />
    </>
  );
}
