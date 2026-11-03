"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import type { ActionState } from "@/components/admin/forms";
import { getDb, guides } from "@/db";
import { GUIDE_KINDS, GUIDE_SECTIONS } from "@/db/schema";
import { logActivity } from "@/lib/admin/audit";
import { slugify } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { getCatalog, getTokenContext, TAGS } from "@/lib/catalog/server";
import { guideProblems } from "@/lib/guide-checks";
import { getGuideForEdit, getGuideRevision, isGuideSlugTaken, markGuideReviewed, saveGuide, type GuideInput } from "@/lib/guides";
import { newKey, putObject } from "@/lib/storage";

const str = (v: FormDataEntryValue | null) => String(v ?? "");
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const guideSchema = z.object({
  title: z.string().transform(oneLine).pipe(z.string().min(1, "Give the guide a title.").max(200, "Keep the title under 200 characters.")),
  slug: z
    .string()
    .max(160, "Keep the slug under 160 characters.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens, e.g. install-a-pcie-dma-card."),
  seoTitle: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(160, "Keep the SEO title under 160 characters."))
    .transform((s) => s || null),
  description: z.string().transform(oneLine).pipe(z.string().min(1, "Write one or two sentences: they show in search results and on the guide card.").max(320, "Keep it under 320 characters.")),
  section: z.enum(GUIDE_SECTIONS, { error: "Choose a section." }),
  kind: z.enum(GUIDE_KINDS, { error: "Choose a kind." }),
  body: z
    .string()
    .transform((s) => s.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1, "Write the guide.").max(100_000, "Keep the guide under 100,000 characters.")),
  coverUrl: z
    .string()
    .trim()
    // An upload: /media/... (database storage) or the bucket's https URL (STORAGE_DRIVER=s3).
    .refine((s) => !s || /^\/media\/[\w/.-]+$/.test(s) || /^https:\/\/\S+$/.test(s), "Upload the cover image here.")
    .transform((s) => s || null),
  coverAlt: z.string().transform(oneLine).pipe(z.string().max(255, "Keep the description under 255 characters.")),
  relatedProducts: z.array(z.string()).max(8, "Pick up to 8 products."),
  status: z.enum(["draft", "published"], { error: "Choose a status." }),
  sortOrder: z.coerce.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(-9999).max(9999),
});

/** Creates (`guideId` null) or updates a guide from the editor. Publishing makes it live at /guides/<slug>. */
export async function saveGuideAction(guideId: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  const title = str(fd.get("title"));
  const parsed = guideSchema.safeParse({
    title,
    slug: str(fd.get("slug")).trim() || slugify(title),
    seoTitle: str(fd.get("seoTitle")),
    description: str(fd.get("description")),
    section: str(fd.get("section")),
    kind: str(fd.get("kind")),
    body: str(fd.get("body")),
    coverUrl: str(fd.get("coverUrl")),
    coverAlt: str(fd.get("coverAlt")),
    relatedProducts: [...new Set(fd.getAll("relatedProducts").map(String))],
    status: str(fd.get("status")),
    sortOrder: str(fd.get("sortOrder")).trim() || "0",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = guideId ? await getGuideForEdit(guideId) : null;
  if (guideId && !existing) return { ok: false, message: "This guide no longer exists." };
  const [{ products }, tokens, slugTaken] = await Promise.all([getCatalog(), getTokenContext(), isGuideSlugTaken(data.slug, guideId ?? undefined)]);
  const fieldErrors = guideProblems(data, { products, tokens });
  if (slugTaken) fieldErrors.slug = "Another guide already uses this slug.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const input: GuideInput = {
    ...data,
    // "Last reviewed" is kept as it is; whoever first publishes a guide is its first reviewer.
    reviewedBy: existing?.reviewedBy ?? (data.status === "published" ? user.name : null),
  };
  const saved = await saveGuide(guideId, input, user.id);
  updateTag(TAGS.guides);
  const renamed = existing && existing.slug !== saved.slug && existing.publishedAt ? ` (renamed from ${existing.slug})` : "";
  await logActivity(user, guideId ? "update" : "create", "guide", saved.id, `${guideId ? "Updated" : "Created"} guide ${data.title}${renamed}`);
  if (!guideId) redirect(`/admin/guides/${saved.id}?created=1`);
  return {
    ok: true,
    message: data.status === "published" ? `Saved. It's live at /guides/${saved.slug}${renamed ? "; the old URL redirects there" : ""}.` : "Saved as a draft.",
  };
}

export async function deleteGuide(guideId: number) {
  const user = await requireAdmin("admin");
  const guide = await getGuideForEdit(guideId);
  if (!guide) return;
  // Its revisions go with it (ON DELETE CASCADE).
  await getDb().delete(guides).where(eq(guides.id, guideId));
  updateTag(TAGS.guides);
  await logActivity(user, "delete", "guide", guideId, `Deleted guide ${guide.title}`);
  redirect("/admin/guides?deleted=1");
}

/**
 * An earlier revision's title and body, for the editor to load. Nothing changes until the admin saves it, so a
 * restored revision goes through the same checks as any other save.
 */
export async function restoreRevision(guideId: number, revisionId: number): Promise<{ ok: true; title: string; body: string; createdAt: string } | { ok: false; message: string }> {
  await requireAdmin("admin");
  const revision = await getGuideRevision(revisionId);
  if (!revision || revision.guideId !== guideId) return { ok: false, message: "That revision no longer exists." };
  return { ok: true, title: revision.title, body: revision.body, createdAt: revision.createdAt };
}

/** Records that the guide was checked against the hardware today; its next review is due in 6 months. */
export async function markReviewed(guideId: number) {
  const user = await requireAdmin("admin");
  const guide = await getGuideForEdit(guideId);
  if (!guide) return;
  await markGuideReviewed(guideId, user.name);
  updateTag(TAGS.guides);
  await logActivity(user, "update", "guide", guideId, `Marked guide ${guide.title} as reviewed`);
  refresh();
}

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Uploads an image for a guide (cover or body), as WebP at most 2000 px across. Its pixel size goes in the file
 * name (…/<id>.<width>x<height>.webp), which the guide page reads to render it with next/image.
 */
export async function uploadGuideImage(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const user = await requireAdmin("admin");
  const file = fd.get("image");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { ok: false, message: `${file.name} isn't an image.` };
  if (file.size > MAX_BYTES) return { ok: false, message: `${file.name} is larger than 10 MB.` };
  try {
    // Respect EXIF rotation, strip metadata, cap the size, encode WebP.
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    const url = await putObject(newKey("guides", `${info.width}x${info.height}.webp`), data, "image/webp");
    await logActivity(user, "upload", "guide", null, `Uploaded guide image ${url}`);
    return { ok: true, url };
  } catch (err) {
    console.error("[upload]", err);
    return { ok: false, message: "The image couldn't be processed. Try a JPG, PNG or WebP." };
  }
}
