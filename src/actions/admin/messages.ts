"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, messages } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/session";

export async function setMessageStatus(messageId: number, status: "open" | "closed") {
  const user = await requireAdmin("staff");
  if (!Number.isInteger(messageId) || (status !== "open" && status !== "closed")) return;
  const db = getDb();
  const [m] = await db.select({ name: messages.name, topic: messages.topic }).from(messages).where(eq(messages.id, messageId)).limit(1);
  if (m) {
    await db.update(messages).set({ status }).where(eq(messages.id, messageId));
    await logActivity(user, status === "closed" ? "close" : "reopen", "message", messageId, `${status === "closed" ? "Closed" : "Reopened"} message from ${m.name} (${m.topic})`);
  }
  refresh();
}

export async function deleteMessage(messageId: number) {
  const user = await requireAdmin("staff");
  if (!Number.isInteger(messageId)) return;
  const db = getDb();
  const [m] = await db.select({ name: messages.name, topic: messages.topic }).from(messages).where(eq(messages.id, messageId)).limit(1);
  if (m) {
    await db.delete(messages).where(eq(messages.id, messageId));
    await logActivity(user, "delete", "message", messageId, `Deleted message from ${m.name} (${m.topic})`);
  }
  redirect("/admin/messages?deleted=1");
}
