"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured, orders } from "@/db";
import { site } from "@/lib/site";
import { capturePayment, checkoutSignatureValid, fetchPayment, isRazorpayConfigured, razorpayOrderFor, settlePayment } from "@/lib/razorpay";

export type PaymentStart =
  | { ok: true; keyId: string; razorpayOrderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string; contact: string } }
  | { ok: false; error: string; paid?: boolean };

const ORDER_NUMBER = /^TCL-[A-Z0-9]{6}$/;

/** Open (or reopen) card payment for an unpaid order. The order number and email together prove it's theirs. */
export async function startPayment(number: string, email: string): Promise<PaymentStart> {
  if (!isDbConfigured() || !isRazorpayConfigured()) return { ok: false, error: "Card payments aren't available right now. Please contact us to pay for your order." };
  if (!ORDER_NUMBER.test(number) || typeof email !== "string") return { ok: false, error: "We couldn't find that order." };
  const [order] = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.email, email.trim().toLowerCase())))
    .limit(1);
  if (!order) return { ok: false, error: "We couldn't find that order." };
  if (order.paymentStatus === "paid") return { ok: false, error: "This order is already paid.", paid: true };
  if (order.status === "cancelled" || order.status === "refunded") return { ok: false, error: "This order was cancelled. Please place a new order." };

  try {
    const razorpayOrderId = await razorpayOrderFor(order);
    return {
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID!,
      razorpayOrderId,
      amount: order.totalCents,
      currency: order.currency,
      name: site.name,
      description: `Order ${order.number}`,
      prefill: { name: `${order.firstName} ${order.lastName}`.trim(), email: order.email, contact: order.phone ?? "" },
    };
  } catch (err) {
    console.error("[razorpay] start payment", err);
    return { ok: false, error: "We couldn't reach the payment provider. Please try again in a moment." };
  }
}

const UNVERIFIED = "We couldn't verify that payment. If you were charged, contact us with your order number and we'll sort it out.";

/** Checkout's success callback. Verifies Razorpay's signature, captures if needed and marks the order paid. */
export async function confirmPayment(input: { number: string; razorpayOrderId: string; paymentId: string; signature: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { number, razorpayOrderId, paymentId, signature } = input ?? {};
  if (!isDbConfigured() || !isRazorpayConfigured()) return { ok: false, error: UNVERIFIED };
  if (!ORDER_NUMBER.test(String(number)) || !/^order_\w+$/.test(String(razorpayOrderId)) || !/^pay_\w+$/.test(String(paymentId)) || !/^[a-f0-9]{64}$/.test(String(signature))) {
    return { ok: false, error: UNVERIFIED };
  }
  if (!checkoutSignatureValid(razorpayOrderId, paymentId, signature)) return { ok: false, error: UNVERIFIED };
  const [order] = await getDb().select({ razorpayOrderId: orders.razorpayOrderId }).from(orders).where(eq(orders.number, number)).limit(1);
  if (order?.razorpayOrderId !== razorpayOrderId) return { ok: false, error: UNVERIFIED };

  try {
    let payment = await fetchPayment(paymentId);
    if (payment.order_id !== razorpayOrderId) return { ok: false, error: UNVERIFIED };
    // Accounts on manual capture: take the money now. If that races automatic capture, read it again.
    if (payment.status === "authorized") payment = await capturePayment(payment).catch(() => fetchPayment(paymentId));
    if (payment.status !== "captured") return { ok: false, error: "Your payment hasn't gone through yet. If you were charged, it will show on your order within a few minutes." };
    const outcome = await settlePayment(payment);
    return outcome === "paid" || outcome === "already-paid" ? { ok: true } : { ok: false, error: UNVERIFIED };
  } catch (err) {
    console.error("[razorpay] confirm payment", err);
    return { ok: false, error: "We couldn't confirm your payment just now. If you were charged, it will show on your order within a few minutes." };
  }
}
