"use server";

import { updateTag } from "next/cache";
import type { ActionState } from "@/components/admin/forms";
import { getDb, settings } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { isLegalSlug, LEGAL_DOCS, legalKey } from "@/lib/legal";

/** Saves one of the store's policies; it's live on /legal/<slug> straight away. */
export async function saveLegalDoc(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("admin");
  if (!isLegalSlug(slug)) return { ok: false, message: "That page doesn't exist." };
  const body = String(fd.get("body") ?? "").replace(/\r\n?/g, "\n").trim();
  if (body.length < 50) return { ok: false, message: "This page needs more text than that." };
  if (body.length > 60_000) return { ok: false, message: "Keep it under 60,000 characters." };

  const key = legalKey(slug);
  await getDb()
    .insert(settings)
    .values({ key, value: { body } })
    .onDuplicateKeyUpdate({ set: { value: { body } } });
  updateTag(TAGS.settings);
  await logActivity(user, "update", "settings", key, `Updated the ${LEGAL_DOCS[slug].toLowerCase()}`);
  return { ok: true, message: "Saved. It's live on the store." };
}
