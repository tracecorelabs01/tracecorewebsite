import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CheckCircle2, Plus } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { wordCount } from "@/components/guides/GuideCard";
import { param, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { getCatalog, getTokenContext } from "@/lib/catalog/server";
import { guideProblems } from "@/lib/guide-checks";
import { GUIDE_SECTION_LABELS, listGuidesForAdmin, type AdminGuide } from "@/lib/guides";

export const metadata: Metadata = { title: "Guides" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function GuidesAdminPage({ searchParams }: PageProps<"/admin/guides">) {
  await requireAdmin("admin");
  const [sp, guides, { products }, tokens] = await Promise.all([searchParams, listGuidesForAdmin(), getCatalog(), getTokenContext()]);
  const now = new Date();

  /** The save checks, as warnings: guides from content patches skip the editor. */
  const warnings = (g: AdminGuide) => {
    const list = Object.values(guideProblems(g, { products, tokens }));
    if (g.section !== "reference" && !g.relatedProducts.length) list.push("No products picked.");
    return list;
  };

  return (
    <>
      <PageHeader
        title="Guides"
        description="Setup guides and explainers at /guides. Published guides are live within a minute of saving; each one is due for a review against the hardware every 6 months."
        actions={
          <LinkButton href="/admin/guides/new">
            <Plus className="size-4" /> New guide
          </LinkButton>
        }
      />
      {param(sp.deleted) && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-ok" /> Guide deleted.
        </p>
      )}
      <Card padded={false}>
        {guides.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="No guides yet"
            description="Write the first one, or deploy the content patch that seeds the guides."
            action={<LinkButton href="/admin/guides/new">New guide</LinkButton>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Guide</Th>
                <Th>Section</Th>
                <Th>Status</Th>
                <Th className="text-right">Words</Th>
                <Th>Last reviewed</Th>
                <Th>Review due</Th>
                <Th>Checks</Th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => {
                const problems = warnings(g);
                const overdue = g.status === "published" && g.reviewDue !== null && new Date(g.reviewDue) < now;
                return (
                  <tr key={g.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td className="max-w-[22rem]">
                      <Link href={`/admin/guides/${g.id}`} className="font-medium text-fg hover:text-blaze">
                        {g.title}
                      </Link>
                      <span className="block truncate font-mono text-[11px] text-dim">/guides/{g.slug}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{GUIDE_SECTION_LABELS[g.section]}</Td>
                    <Td>
                      <Badge tone={g.status === "published" ? "ok" : "neutral"}>{g.status}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-muted">{wordCount(g.body).toLocaleString("en-US")}</Td>
                    <Td className="whitespace-nowrap text-muted">{shortDate(g.reviewedAt)}</Td>
                    <Td className="whitespace-nowrap">
                      {overdue ? <Badge tone="warn">Overdue · {shortDate(g.reviewDue)}</Badge> : <span className="text-muted">{shortDate(g.reviewDue)}</span>}
                    </Td>
                    <Td className="max-w-[20rem]">
                      {problems.length ? (
                        <ul className="space-y-1 text-xs text-warn">
                          {problems.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-ok">OK</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
