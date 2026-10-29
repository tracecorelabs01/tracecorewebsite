// Card payments through Razorpay: a Razorpay order per store order, Standard Checkout in the browser,
// and the result confirmed twice over (the checkout's signed response and the webhook), either of which
// marks the order paid. Without RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, card orders get payment
// instructions like the other methods.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, isNull, like } from "drizzle-orm";
import { getDb, orderEvents, orderItems, orders } from "@/db";
import { money } from "@/lib/admin/format";
import type { NewEvent, Tx } from "@/lib/admin/order-stock";
import { sendOrderEmails } from "@/lib/email";
import { syncOrderPoints } from "@/lib/loyalty";

const API = "https://api.razorpay.com/v1";

/** Shown after a successful payment and in its confirmation email. */
export const PAID_NOTE = "Payment received. We'll email you tracking as soon as it ships.";

export const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  /** Smallest currency unit (cents for USD). */
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  amount_refunded?: number;
  error_description?: string | null;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Razorpay ${path} failed: ${res.status} ${data?.error?.description ?? ""}`.trim());
  return data as T;
}

function sameHmac(payload: string, secret: string, signature: string) {
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The signature Standard Checkout hands back after a successful payment. */
export const checkoutSignatureValid = (razorpayOrderId: string, paymentId: string, signature: string) =>
  sameHmac(`${razorpayOrderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET ?? "", signature);

/** X-Razorpay-Signature on a webhook: HMAC of the raw body with the webhook secret. */
export function webhookSignatureValid(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return Boolean(secret && signature) && sameHmac(body, secret!, signature);
}

export const fetchPayment = (id: string) => api<RazorpayPayment>(`/payments/${encodeURIComponent(id)}`);

/** For accounts set to capture manually; with automatic capture payments arrive captured already. */
export const capturePayment = (p: RazorpayPayment) => api<RazorpayPayment>(`/payments/${encodeURIComponent(p.id)}/capture`, { amount: p.amount, currency: p.currency });

/** The Razorpay order a store order is paid through, created on first use. Retries after a failed or abandoned payment reuse it. */
export async function razorpayOrderFor(order: { id: number; number: string; email: string; totalCents: number; currency: string; razorpayOrderId: string | null }) {
  if (order.razorpayOrderId) return order.razorpayOrderId;
  const created = await api<{ id: string }>("/orders", {
    amount: order.totalCents,
    currency: order.currency,
    receipt: order.number,
    notes: { order: order.number, email: order.email },
  });
  const db = getDb();
  // Two tabs paying at once: keep whichever Razorpay order was saved first.
  const [res] = await db
    .update(orders)
    .set({ razorpayOrderId: created.id })
    .where(and(eq(orders.id, order.id), isNull(orders.razorpayOrderId)));
  if (res.affectedRows) return created.id;
  const [row] = await db.select({ razorpayOrderId: orders.razorpayOrderId }).from(orders).where(eq(orders.id, order.id)).limit(1);
  return row!.razorpayOrderId!;
}

/** The store order a Razorpay order belongs to, locked for the rest of the transaction. */
async function lockOrder(tx: Tx, razorpayOrderId: string | null) {
  if (!razorpayOrderId) return undefined;
  const [order] = await tx.select().from(orders).where(eq(orders.razorpayOrderId, razorpayOrderId)).limit(1).for("update");
  return order;
}

/** Webhooks are retried and race the checkout confirmation, so events about a Razorpay id are written once. */
async function onTimeline(tx: Tx, orderId: number, razorpayId: string) {
  const [row] = await tx
    .select({ id: orderEvents.id })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), like(orderEvents.message, `%${razorpayId}%`)))
    .limit(1);
  return Boolean(row);
}

async function addEvents(tx: Tx, orderId: number, events: NewEvent[]) {
  if (events.length) await tx.insert(orderEvents).values(events.map((e) => ({ orderId, type: e.type, message: e.message.slice(0, 500) })));
}

const methodLabel = (p: RazorpayPayment) => (p.method === "card" || !p.method ? "Card" : p.method.toUpperCase() === "UPI" ? "UPI" : p.method[0].toUpperCase() + p.method.slice(1));

export type SettleOutcome = "paid" | "already-paid" | "unknown" | "mismatch";

/**
 * Mark the order a captured payment belongs to as paid: payment details, pending → processing,
 * loyalty points, timeline, then the order emails. Safe to call any number of times.
 */
export async function settlePayment(p: RazorpayPayment): Promise<SettleOutcome> {
  if (p.status !== "captured" || !p.order_id) return "unknown";
  const result = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, p.order_id);
    if (!order) return { outcome: "unknown" as const };
    if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
      if (order.paymentRef !== p.id && !(await onTimeline(tx, order.id, p.id))) {
        await addEvents(tx, order.id, [{ type: "payment", message: `A second payment (${p.id}, ${money(p.amount, p.currency)}) was captured for this order. Refund it in Razorpay.` }]);
      }
      return { outcome: "already-paid" as const };
    }
    if (p.amount !== order.totalCents || p.currency !== order.currency) {
      if (!(await onTimeline(tx, order.id, p.id))) {
        await addEvents(tx, order.id, [{ type: "payment", message: `Razorpay payment ${p.id} of ${money(p.amount, p.currency)} doesn't match the order total. Check it in Razorpay.` }]);
      }
      return { outcome: "mismatch" as const };
    }

    const events: NewEvent[] = [{ type: "payment", message: `Payment changed: ${order.paymentStatus} → paid · ${methodLabel(p)} through Razorpay · ref ${p.id}` }];
    const patch: Partial<typeof orders.$inferInsert> = { paymentStatus: "paid", paidAt: new Date(), paymentRef: p.id };
    if (order.status === "pending") {
      patch.status = "processing";
      events.push({ type: "status", message: "Status changed: pending → processing" });
    } else if (order.status === "cancelled") {
      events.push({ type: "payment", message: "This order was cancelled before the payment arrived. Reinstate it, or refund the payment in Razorpay." });
    }
    await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    const points = await syncOrderPoints(tx, order.id);
    if (points > 0) events.push({ type: "payment", message: `Customer earned ${points.toLocaleString("en-US")} loyalty points` });
    await addEvents(tx, order.id, events);
    return { outcome: "paid" as const, order };
  });

  if (result.outcome === "paid") await emailPaidOrder(result.order);
  return result.outcome;
}

/** Card orders paid online get their confirmation once the money is in, not when they're placed. */
async function emailPaidOrder(order: typeof orders.$inferSelect) {
  try {
    const lines = await getDb()
      .select({ name: orderItems.productName, option: orderItems.optionValue, qty: orderItems.quantity, lineTotalCents: orderItems.lineTotalCents })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.id));
    await sendOrderEmails({ ...order, lines, paymentMethod: `${order.paymentMethod} (paid through Razorpay)`, note: PAID_NOTE });
  } catch (err) {
    console.error("[razorpay] order email", err);
  }
}

/** A failed attempt goes on the timeline only; the customer can still pay. */
export async function recordFailedPayment(p: RazorpayPayment) {
  await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, p.order_id);
    if (!order || order.paymentStatus === "paid" || (await onTimeline(tx, order.id, p.id))) return;
    await addEvents(tx, order.id, [{ type: "payment", message: `Card payment attempt failed${p.error_description ? `: ${p.error_description}` : ""} · ${p.id}` }]);
  });
}

/** Refunds are issued in the Razorpay dashboard; a full refund marks the payment refunded (and takes back its points). */
export async function recordRefund(refund: RazorpayRefund, payment: RazorpayPayment) {
  await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, payment.order_id);
    if (!order || (await onTimeline(tx, order.id, refund.id))) return;
    const events: NewEvent[] = [{ type: "payment", message: `Refund of ${money(refund.amount, payment.currency)} processed in Razorpay · ${refund.id}` }];
    if ((payment.amount_refunded ?? 0) >= payment.amount && order.paymentStatus === "paid") {
      await tx.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, order.id));
      events.push({ type: "payment", message: "Payment changed: paid → refunded" });
      const points = await syncOrderPoints(tx, order.id);
      if (points < 0) events.push({ type: "payment", message: `${(-points).toLocaleString("en-US")} loyalty points taken back` });
    }
    await addEvents(tx, order.id, events);
  });
}
