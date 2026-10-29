// Razorpay webhook (Dashboard → Webhooks): payment.captured, order.paid, payment.failed, refund.processed.
// The backstop for card payments: settles orders whose checkout tab closed before it could confirm.

import { isDbConfigured } from "@/db";
import { fetchPayment, recordFailedPayment, recordRefund, settlePayment, webhookSignatureValid, type RazorpayPayment, type RazorpayRefund } from "@/lib/razorpay";

type WebhookEvent = {
  event: string;
  payload: { payment?: { entity: RazorpayPayment }; refund?: { entity: RazorpayRefund } };
};

export async function POST(req: Request) {
  const body = await req.text();
  if (!webhookSignatureValid(body, req.headers.get("x-razorpay-signature") ?? "")) return new Response("Invalid signature", { status: 400 });
  if (!isDbConfigured()) return new Response("No database", { status: 503 });

  let event: WebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  try {
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        if (payment) await settlePayment(payment);
        break;
      case "payment.failed":
        if (payment) await recordFailedPayment(payment);
        break;
      case "refund.processed": {
        const refund = event.payload?.refund?.entity;
        if (refund?.id && refund.payment_id) await recordRefund(refund, payment ?? (await fetchPayment(refund.payment_id)));
        break;
      }
    }
  } catch (err) {
    // A non-2xx answer makes Razorpay retry later.
    console.error(`[razorpay] webhook ${event.event}`, err);
    return new Response("Error", { status: 500 });
  }
  return Response.json({ ok: true });
}
