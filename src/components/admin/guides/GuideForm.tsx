"use client";

import { useRef, useState } from "react";
import { Heading2, Heading3, ImagePlus, Link2, List, ListOrdered, Loader2, Lock, MessageSquareWarning, RotateCcw, Table, Trash2 } from "lucide-react";
import { restoreRevision, uploadGuideImage } from "@/actions/admin/guides";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, useActionForm, type ActionState } from "@/components/admin/forms";
import { SeoFields } from "@/components/admin/SeoFields";
import { buttonClass, Card } from "@/components/admin/ui";
import { Markdown } from "@/components/content/Markdown";
import { dateTime } from "@/lib/admin/format";
import { productFamily } from "@/lib/guide-checks";
import { GUIDE_KIND_LABELS, GUIDE_SECTION_LABELS, type GuideKind, type GuideSection } from "@/lib/guide-labels";
import type { Product } from "@/lib/catalog/types";
import type { AdminGuide } from "@/lib/guides";
import { fillTokens, type TokenContext } from "@/lib/tokens";
import { cn } from "@/lib/utils";

// The guide editor: Markdown with a small toolbar and a preview drawn by the storefront's own renderer, a cover
// image, the products the guide covers (one family), SEO fields and earlier revisions.

type Revision = { id: number; title: string; savedBy: string | null; createdAt: string };
type ProductChoice = Pick<Product, "slug" | "name" | "category" | "price" | "status">;

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Toolbar: `line` starts the cursor's line with it; `wrap` is [before, after, text when nothing is selected]. */
const TOOLS = [
  { label: "Heading", icon: Heading2, line: "## " },
  { label: "Subheading", icon: Heading3, line: "### " },
  { label: "Bulleted list", icon: List, line: "- " },
  { label: "Numbered steps", icon: ListOrdered, line: "1. " },
  { label: "Table", icon: Table, wrap: ["\n\n| Column | Column |\n| --- | --- |\n| ", " | Cell |\n\n", "Cell"] },
  { label: "Callout", icon: MessageSquareWarning, wrap: ["\n\n> [!NOTE]\n> ", "\n\n", "Callout text"] },
  { label: "Link", icon: Link2, wrap: ["[", "](https://)", "link text"] },
] as const;

/** A field error for inputs that aren't wrapped in a <Field> (the body, the product checkboxes). */
function FieldError({ name }: { name: string }) {
  const error = useActionForm().state?.fieldErrors?.[name];
  return error ? <p className="mt-1.5 text-xs text-[#ff6b5e]">{error}</p> : null;
}

/** Picks one image file and uploads it, then hands its URL on. */
async function pickAndUpload(input: HTMLInputElement | null) {
  const file = input?.files?.[0];
  if (!input || !file) return null;
  const fd = new FormData();
  fd.set("image", file);
  input.value = "";
  return uploadGuideImage(fd);
}

export function GuideForm({
  action,
  guide,
  products,
  revisions = [],
  settings,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  guide?: AdminGuide;
  /** Products on sale: the picker, and {{price:...}} / {{stock:...}} in the preview. */
  products: ProductChoice[];
  revisions?: Revision[];
  /** The settings tokens in the preview. */
  settings: TokenContext["settings"];
}) {
  const [title, setTitle] = useState(guide?.title ?? "");
  const [slug, setSlug] = useState(guide?.slug ?? "");
  // A published guide's URL may be linked from elsewhere: changing it is deliberate (the old URL then redirects).
  const [slugLocked, setSlugLocked] = useState(Boolean(guide?.publishedAt));
  const [section, setSection] = useState<GuideSection>(guide?.section ?? "dma");
  const [related, setRelated] = useState<string[]>(guide?.relatedProducts ?? []);
  const [body, setBody] = useState(guide?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [cover, setCover] = useState(guide?.coverUrl ?? "");
  const [busy, setBusy] = useState<"cover" | "image" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const bodyImage = useRef<HTMLInputElement>(null);
  const coverImage = useRef<HTMLInputElement>(null);

  const choices = products.filter((p) => productFamily(p.category) === section);

  /** Replaces the selection with before + (selection or fallback) + after, and selects the middle part. */
  function wrap(before: string, after = "", fallback = "") {
    const el = area.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const middle = body.slice(start, end) || fallback;
    setBody(body.slice(0, start) + before + middle + after + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + middle.length);
    });
  }

  /** Starts the line the cursor is on with `prefix` ("## ", "- "...). */
  function prefixLine(prefix: string) {
    const el = area.current;
    if (!el) return;
    const lineStart = body.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const caret = el.selectionStart + prefix.length;
    setBody(body.slice(0, lineStart) + prefix + body.slice(lineStart));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  async function upload(kind: "cover" | "image") {
    setBusy(kind);
    const result = await pickAndUpload(kind === "cover" ? coverImage.current : bodyImage.current);
    setBusy(null);
    if (!result) return;
    if (!result.ok) return setNote({ ok: false, text: result.message });
    setNote(null);
    // Body images go in with an empty alt text, the cursor inside it: the save asks for one.
    if (kind === "cover") setCover(result.url);
    else wrap("![", `](${result.url})`);
  }

  async function restore(rev: Revision) {
    if (!guide || !window.confirm(`Load the revision from ${dateTime(rev.createdAt)} into the editor? Nothing changes until you save.`)) return;
    const result = await restoreRevision(guide.id, rev.id);
    if (!result.ok) return setNote({ ok: false, text: result.message });
    setTitle(result.title);
    setBody(result.body);
    setTab("write");
    setNote({ ok: true, text: `Loaded the revision from ${dateTime(result.createdAt)}. Save to keep it.` });
  }

  return (
    <ActionForm action={action} className="grid gap-4 xl:grid-cols-3" showStatus={false}>
      <div className="min-w-0 space-y-4 xl:col-span-2">
        <Card title="Guide">
          <div className="space-y-4">
            <Field label="Title" name="title" hint="The page's H1. Name the hardware and the task, e.g. How to install a PCIe DMA card.">
              <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </Field>
            <Field
              label="URL slug"
              name="slug"
              hint={slugLocked ? "Locked because the guide has been published." : guide?.publishedAt ? "The old URL will redirect to the new one." : "Leave blank to generate it from the title."}
            >
              <span className="flex gap-2">
                <span className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-dim">/guides/</span>
                  <Input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} readOnly={slugLocked} placeholder="install-a-pcie-dma-card" className="pl-[4.6rem] font-mono" />
                </span>
                {slugLocked && (
                  <button
                    type="button"
                    className={buttonClass("secondary")}
                    onClick={() => window.confirm("Change the URL of a published guide? Links to the old URL will redirect to the new one.") && setSlugLocked(false)}
                  >
                    <Lock className="size-3.5" /> Change
                  </button>
                )}
              </span>
            </Field>
          </div>
        </Card>

        <Card
          title="Body"
          description="Markdown. ## starts a section (it goes in the table of contents)."
          actions={
            <div className="flex rounded-lg border border-line p-0.5 text-xs" role="tablist">
              {(["write", "preview"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 capitalize", tab === t ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}>
                  {t}
                </button>
              ))}
            </div>
          }
        >
          <div className={tab === "write" ? undefined : "hidden"}>
            <div className="mb-2 flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
              {TOOLS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => ("line" in t ? prefixLine(t.line) : wrap(t.wrap[0], t.wrap[1], t.wrap[2]))}
                  title={t.label}
                  aria-label={t.label}
                  className={buttonClass("ghost", "sm")}
                >
                  <t.icon className="size-4" />
                </button>
              ))}
              <button type="button" onClick={() => bodyImage.current?.click()} disabled={busy !== null} title="Image" aria-label="Upload an image" className={buttonClass("ghost", "sm")}>
                {busy === "image" ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              </button>
              <input ref={bodyImage} type="file" accept={ACCEPT} hidden onChange={() => upload("image")} />
            </div>
            <Textarea ref={area} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={30} spellCheck className="font-mono text-[13px] leading-relaxed" aria-label="Guide body" />
            <FieldError name="body" />
            <p className="mt-2 text-xs leading-relaxed text-dim">
              <code>## Section</code> · <code>1. </code> numbered steps · <code>- </code> bullets · <code>{"> [!TIP]"}</code> callouts (NOTE, TIP, IMPORTANT, WARNING, CAUTION) ·{" "}
              <code>```youtube</code> with <code>id:</code>, <code>title:</code> and <code>date:</code> lines for a video · <code>{"{{price:product-slug}}"}</code> for a price,{" "}
              <code>{"{{freeShippingThreshold}}"}</code> / <code>{"{{flatShipping}}"}</code> for shipping. Never type a $ amount.
            </p>
          </div>
          {tab === "preview" && (
            <div className="rounded-xl border border-line bg-ink-950 p-6 md:p-8">
              <h2 className="type-h3 mb-8">{title || "Untitled guide"}</h2>
              {body.trim() ? <Markdown source={fillTokens(body, { settings, products })} /> :<p className="text-sm text-dim">Nothing to preview yet.</p>}
            </div>
          )}
        </Card>

        {note && <p className={cn("rounded-xl border px-4 py-3 text-sm", note.ok ? "border-ok/30 bg-ok/10" : "border-ember/40 bg-ember/10 text-[#ff6b5e]")}>{note.text}</p>}
      </div>

      <div className="min-w-0 space-y-4">
        <Card title="Publishing">
          <div className="space-y-4">
            <Field label="Status" name="status">
              <Select name="status" defaultValue={guide?.status ?? "draft"}>
                <option value="draft">Draft: hidden</option>
                <option value="published">Published: live on /guides</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Section" name="section">
                <Select name="section" value={section} onChange={(e) => setSection(e.target.value as GuideSection)}>
                  {(Object.keys(GUIDE_SECTION_LABELS) as GuideSection[]).map((s) => (
                    <option key={s} value={s}>
                      {GUIDE_SECTION_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kind" name="kind">
                <Select name="kind" defaultValue={guide?.kind ?? "guide"}>
                  {(Object.keys(GUIDE_KIND_LABELS) as GuideKind[]).map((k) => (
                    <option key={k} value={k}>
                      {GUIDE_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Sort order" name="sortOrder" hint="Lower comes first in its section.">
              <Input name="sortOrder" type="number" defaultValue={guide?.sortOrder ?? 0} />
            </Field>
            <SubmitButton className="w-full" pendingText="Saving…">
              Save guide
            </SubmitButton>
            <FormStatus className="mt-0" />
          </div>
        </Card>

        <Card title="Cover image" description="Optional. Shown at the top of the guide. JPG, PNG or WebP up to 10 MB.">
          <input type="hidden" name="coverUrl" value={cover} />
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail
            <img src={cover} alt="" className="mb-3 aspect-video w-full rounded-lg border border-line object-cover" />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => coverImage.current?.click()} disabled={busy !== null} className={buttonClass("secondary", "sm")}>
              {busy === "cover" ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {cover ? "Replace" : "Upload"}
            </button>
            {cover && (
              <button type="button" onClick={() => setCover("")} className={buttonClass("danger", "sm")}>
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}
            <input ref={coverImage} type="file" accept={ACCEPT} hidden onChange={() => upload("cover")} />
          </div>
          <FieldError name="coverUrl" />
          <Field label="Cover description (alt text)" name="coverAlt" className="mt-4">
            <Input name="coverAlt" defaultValue={guide?.coverAlt ?? ""} maxLength={255} placeholder="A 75T DMA card in a PCIe x4 slot" />
          </Field>
        </Card>

        <Card title="Products covered" description="Shown as product cards under the guide. One product family only.">
          {section === "reference" ? (
            <p className="text-sm text-dim">Reference guides don&apos;t list products.</p>
          ) : choices.length ? (
            <ul className="space-y-2">
              {choices.map((p) => (
                <li key={p.slug}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="relatedProducts"
                      value={p.slug}
                      checked={related.includes(p.slug)}
                      onChange={(e) => setRelated((r) => (e.target.checked ? [...r, p.slug] : r.filter((s) => s !== p.slug)))}
                      className="accent-blaze"
                    />
                    <span className="flex-1 text-fg">{p.name}</span>
                    <span className="font-mono text-[11px] text-dim">{p.slug}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-dim">No {GUIDE_SECTION_LABELS[section].toLowerCase()} are on sale.</p>
          )}
          <FieldError name="relatedProducts" />
        </Card>

        <Card title="Search engines">
          <SeoFields
            title={guide?.seoTitle}
            description={guide?.description}
            titleFallback={title || "The guide title"}
            descriptionFallback="Required: one or two sentences for search results and the guide card."
            path={`/guides/${slug || "…"}`}
            descriptionName="description"
          />
        </Card>

        {revisions.length > 0 && (
          <Card title="Revisions" description="One per save that changed the title or body; the newest 20 are kept.">
            <ul className="divide-y divide-line/70 text-sm">
              {revisions.map((rev, i) => (
                <li key={rev.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-fg/90">{dateTime(rev.createdAt)}</span>
                    <span className="block truncate text-xs text-dim">
                      {i === 0 ? "Latest · " : ""}
                      {rev.savedBy ?? "Content patch"}
                    </span>
                  </span>
                  {i > 0 && (
                    <button type="button" onClick={() => restore(rev)} className={buttonClass("ghost", "sm")}>
                      <RotateCcw className="size-3.5" /> Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </ActionForm>
  );
}
