import "server-only";
import { activityLog, getDb } from "@/db";
import type { AdminUser } from "@/lib/auth/session";

/** Append to the activity log. Never throws — auditing must not break the action. */
export async function logActivity(user: AdminUser | null, action: string, entity: string, entityId: string | number | null, summary: string) {
  try {
    await getDb()
      .insert(activityLog)
      .values({ adminId: user?.id ?? null, action, entity, entityId: entityId == null ? null : String(entityId), summary: summary.slice(0, 255) });
  } catch (err) {
    console.error("[audit]", err);
  }
}
