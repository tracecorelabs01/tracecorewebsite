import type { Metadata } from "next";
import { saveLegalDoc } from "@/actions/admin/legal";
import { ActionForm, SubmitButton, Textarea } from "@/components/admin/forms";
import { Card, FilterTabs, LinkButton, PageHeader } from "@/components/admin/ui";
import { dateTime } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { isLegalSlug, LEGAL_DOCS, placeholdersIn, readLegalDoc, type LegalSlug } from "@/lib/legal";

export const metadata: Metadata = { title: "Legal pages" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function LegalPagesPage({ searchParams }: PageProps<"/admin/legal">) {
  await requireAdmin("admin");
  const doc = String((await searchParams).doc ?? "");
  const slug: LegalSlug = isLegalSlug(doc) ? doc : "terms";
  const { body, updatedAt } = await readLegalDoc(slug);
  const blanks = placeholdersIn(body);

  return (
    <>
      <PageHeader
        title="Legal pages"
        description="The policies linked in the store's footer and at checkout. Payment providers like Razorpay check these before approving the store."
      />
      <div className="space-y-4">
        <FilterTabs items={(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((s) => ({ label: LEGAL_DOCS[s], href: `/admin/legal?doc=${s}`, active: s === slug }))} />
        <Card
          title={LEGAL_DOCS[slug]}
          description={updatedAt ? `Last saved ${dateTime(updatedAt)}` : "Not saved yet: the store shows this draft. Review it, fill in the blanks and save."}
          actions={
            <LinkButton href={`/legal/${slug}`} target="_blank" variant="secondary" size="sm" prefetch={false}>
              View on the store
            </LinkButton>
          }
        >
          {blanks.length > 0 && (
            <p className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-sm text-fg/85">
              Replace these before going live: {blanks.join(", ")}
            </p>
          )}
          <ActionForm key={slug} action={saveLegalDoc.bind(null, slug)} className="space-y-3">
            <Textarea name="body" defaultValue={body} rows={28} spellCheck className="font-mono text-[13px] leading-relaxed" aria-label={LEGAL_DOCS[slug]} />
            <p className="text-xs text-dim">
              <code>## Title</code> starts a section · <code>- </code> starts a bullet · a blank line starts a new paragraph · <code>**bold**</code> ·{" "}
              <code>[text](https://link)</code> · <code>{"{{supportEmail}}"}</code>, <code>{"{{freeShippingThreshold}}"}</code> and <code>{"{{flatShipping}}"}</code> show the values from Settings.
            </p>
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
