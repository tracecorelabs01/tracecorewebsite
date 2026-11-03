// Renamed products, categories and guides keep their old URLs working: the save actions record each rename here,
// and the pages send an old slug on to the current one (findSlugRedirect in src/lib/catalog/server.ts, then
// permanentRedirect). No server-only import, so scripts can use it too.

import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { slugRedirects } from "@/db/schema";

export type SlugKind = (typeof slugRedirects.$inferInsert)["kind"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Records that `oldSlug` now lives at `newSlug`. Earlier redirects to `oldSlug` are pointed straight at `newSlug`
 * (no chains), and any redirect away from `newSlug` is removed (that slug is live again). Pass the transaction
 * that saves the rename.
 */
export async function recordSlugRedirect(db: Database | Transaction, kind: SlugKind, oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  await db.delete(slugRedirects).where(and(eq(slugRedirects.kind, kind), eq(slugRedirects.oldSlug, newSlug)));
  await db.update(slugRedirects).set({ newSlug }).where(and(eq(slugRedirects.kind, kind), eq(slugRedirects.newSlug, oldSlug)));
  await db.insert(slugRedirects).values({ kind, oldSlug, newSlug }).onDuplicateKeyUpdate({ set: { newSlug } });
}
