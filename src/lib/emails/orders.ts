// Order emails: received, paid (with invoice), shipped, tracking update, delivered, cancelled, refunded,
// plus the staff alert. Every trigger calls emailOrder(orderId, kind); each send is noted on the order timeline.

import "server-only";
import { and, asc, eq, sum } from "drizzle-orm";
import { customers, getDb, loyaltyLedger, orderEvents, orderItems, orders } from "@/db";
import { addressLines } from "@/lib/admin/orders";
import { button, C, code, customerReplyTo, escapeHtml, label, layout, p, panel, pill, sendEmail, small, staffInbox, strong, url } from "@/lib/email";
import { warrantyEnds, warrantyMonths } from "@/lib/warranty";

export type OrderEmail = "received" | "paid" | "shipped" | "tracking" | "delivered" | "cancelled" | "refunded";

type Order = typeof orders.$inferSelect;
type Item = { name: string; option: string | null; qty: number; unitCents: number; lineCents: number; slug: string };
type Data = { o: Order; items: Item[]; points: number; hasAccount: boolean };

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const day = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const first = (o: Order) => o.firstName || "there";

async function load(orderId: number): Promise<Data | null> {
  const db = getDb();
  const [[o], items, [pts]] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, orderId)).limit(1),
    db
      .select({ name: orderItems.productName, option: orderItems.optionValue, qty: orderItems.quantity, unitCents: orderItems.unitPriceCents, lineCents: orderItems.lineTotalCents, slug: orderItems.productSlug })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id)),
    db.select({ n: sum(loyaltyLedger.points) }).from(loyaltyLedger).where(and(eq(loyaltyLedger.orderId, orderId), eq(loyaltyLedger.kind, "order"))),
  ]);
  if (!o) return null;
  const [c] = o.customerId ? await db.select({ hash: customers.passwordHash }).from(customers).where(eq(customers.id, o.customerId)).limit(1) : [];
  return { o, items, points: Number(pts?.n ?? 0), hasAccount: Boolean(c?.hash) };
}

/* ───────────── building blocks ───────────── */

const STEPS = ["Received", "Paid", "Shipped", "Delivered"];

/** Received → Paid → Shipped → Delivered, lit up to `reached`. */
function progress(reached: number) {
  const cells = STEPS.map((step, i) => {
    const on = i <= reached;
    return `<td width="25%" style="padding:0 3px;vertical-align:top">
<div style="height:4px;line-height:4px;font-size:0;border-radius:4px;background:${on ? C.brand : C.line};${on ? `background-image:linear-gradient(90deg,${C.ember},${C.blaze})` : ""}">&nbsp;</div>
<div style="padding-top:8px;font-family:${FONT};font-size:11px;font-weight:${i === reached ? 700 : 500};letter-spacing:.06em;text-transform:uppercase;color:${on ? C.fg : C.dim}">${step}</div></td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px"><tr>${cells}</tr></table>`;
}

function itemRows(items: Item[], currency: string, prices: boolean) {
  return items
    .map(
      (i) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.fg}">${escapeHtml(i.name)}${i.option ? `<br><span style="font-size:12px;color:${C.muted}">${escapeHtml(i.option)}</span>` : ""}</td>
<td align="${prices ? "center" : "right"}" style="padding:10px ${prices ? 8 : 0}px;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.text};white-space:nowrap">× ${i.qty}</td>
${prices ? `<td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.fg};white-space:nowrap">${money(i.lineCents, currency)}</td>` : ""}
</tr>`,
    )
    .join("");
}

function items(d: Data) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${itemRows(d.items, d.o.currency, false)}</table>`;
}

function totals(o: Order) {
  const row = (name: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-family:${FONT};font-size:${bold ? 16 : 14}px;color:${bold ? C.fg : C.muted};font-weight:${bold ? 800 : 400}">${name}</td><td align="right" style="padding:4px 0;font-family:${FONT};font-size:${bold ? 16 : 14}px;color:${C.fg};font-weight:${bold ? 800 : 400}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
${row("Subtotal", money(o.subtotalCents, o.currency))}
${o.discountCents ? row(`Discount${o.discountCode ? ` (${escapeHtml(o.discountCode)})` : ""}`, `−${money(o.discountCents, o.currency)}`) : ""}
${row("Shipping", o.shippingCents ? money(o.shippingCents, o.currency) : "Free")}
<tr><td colspan="2" style="padding-top:6px;border-top:1px solid ${C.line};font-size:0;line-height:0">&nbsp;</td></tr>
${row("Total", money(o.totalCents, o.currency), true)}
</table>`;
}

const paymentLabel = (o: Order) =>
  o.paymentMethod === "card" ? (o.paymentRef?.startsWith("pay_") ? "Card · Razorpay" : "Card") : o.paymentMethod === "paypal" ? "PayPal" : o.paymentMethod === "crypto" ? "Crypto" : o.paymentMethod;

function address(o: Order) {
  return [...addressLines(o).map(escapeHtml), escapeHtml(o.email), o.phone ? escapeHtml(o.phone) : ""].filter(Boolean).join("<br>");
}

/** The invoice: seller, number and dates, who it's for, every line and the totals. */
function invoice({ o, items: list }: Data) {
  const status = o.paymentStatus === "paid" ? pill("Paid", C.ok) : o.paymentStatus === "refunded" ? pill("Refunded", C.muted) : pill("Amount due", C.warn);
  const meta = (name: string, value: string) =>
    `<td style="padding:0 16px 0 0;vertical-align:top">${label(name)}<div style="font-family:${FONT};font-size:13px;color:${C.fg};white-space:nowrap">${value}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;background:${C.panel};border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:22px 22px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top">${label("Invoice")}${code(`INV-${o.number}`, 17)}</td>
<td align="right" style="vertical-align:top">${status}</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
${meta("Issued", day(o.paidAt ?? o.createdAt))}${meta("Order", escapeHtml(o.number))}${meta("Payment", escapeHtml(paymentLabel(o)))}
</tr></table>
<div style="margin-top:18px;font-size:0">
<div style="display:inline-block;width:48%;min-width:220px;vertical-align:top;margin:0 2% 12px 0">${label("Billed and shipped to")}<div style="font-family:${FONT};font-size:13px;line-height:1.6;color:${C.text}">${address(o)}</div></div>
<div style="display:inline-block;width:48%;min-width:220px;vertical-align:top;margin:0 0 12px">${label("From")}<div style="font-family:${FONT};font-size:13px;line-height:1.6;color:${C.text}">TraceCore Lab<br>tracecorelab.com</div></div>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
<tr><td style="padding-bottom:6px;border-bottom:1px solid ${C.line}">${label("Item")}</td><td align="center" style="padding-bottom:6px;border-bottom:1px solid ${C.line}">${label("Qty")}</td><td align="right" style="padding-bottom:6px;border-bottom:1px solid ${C.line}">${label("Amount")}</td></tr>
${itemRows(list, o.currency, true)}
</table>
${totals(o)}
</td></tr></table>`;
}

function tracking(o: Order) {
  if (!o.trackingNumber) return p("The carrier hasn't given us a tracking number yet. We'll email it to you as soon as we have it.");
  const track = `https://t.17track.net/en#nums=${encodeURIComponent(o.trackingNumber)}`;
  return panel(`${label(o.trackingCarrier ? `${o.trackingCarrier} tracking number` : "Tracking number")}${code(o.trackingNumber)}${button("Track your package", track)}`, C.brand);
}

function accountCta(d: Data, signedInLabel: string, path: string) {
  return d.hasAccount
    ? button(signedInLabel, url(path))
    : `${button("Open your account", url(`/account/activate?${new URLSearchParams({ email: d.o.email, order: d.o.number })}`))}${small("Your account shows every order and its tracking, collects your loyalty points and lets you review what you bought.")}`;
}

/* ───────────── templates ───────────── */

type Rendered = { subject: string; preheader: string; heading: string; body: string };

function render(kind: OrderEmail, d: Data, note?: string): Rendered {
  const { o } = d;
  const total = money(o.totalCents, o.currency);
  switch (kind) {
    case "received":
      return {
        subject: `We've got your order ${o.number}`,
        preheader: `Order ${o.number} for ${total} is reserved for you. Here's how to pay.`,
        heading: `Thanks, ${first(o)}. We've got your order.`,
        body:
          progress(0) +
          p(`Your order ${strong(o.number)} is reserved for you. ${note ? escapeHtml(note) : "We'll email you payment details shortly."}`) +
          invoice(d) +
          small("Your items are held while we wait for payment. Your invoice is updated and sent again once it's paid."),
      };
    case "paid":
      return {
        subject: `Payment received · order ${o.number} is confirmed`,
        preheader: `We've received ${total}. Your invoice is inside.`,
        heading: `You're all set, ${first(o)}.`,
        body:
          progress(1) +
          p(`We've received your payment of ${strong(total)} and your order is confirmed. Every unit is tested in our lab before it ships, and we'll email you the moment it's on its way.`) +
          (d.points > 0 ? panel(`${label("Loyalty points")}<div style="font-family:${FONT};font-size:15px;color:${C.fg}"><strong style="color:${C.blaze}">+${d.points.toLocaleString("en-US")} points</strong> added for this order</div>`) : "") +
          invoice(d) +
          accountCta(d, "View your order", `/account/orders/${o.number}`),
      };
    case "shipped":
      return {
        subject: `Your order ${o.number} has shipped`,
        preheader: o.trackingNumber ? `Tracking number ${o.trackingNumber}. Here's where it is.` : "It's on its way to you.",
        heading: `It's on the way, ${first(o)}.`,
        body: progress(2) + p(`Your order ${strong(o.number)} has left the lab.`) + tracking(o) + items(d) + panel(`${label("Shipping to")}<div style="font-size:13px;line-height:1.6;color:${C.text}">${address(o)}</div>`),
      };
    case "tracking":
      return {
        subject: `Tracking for order ${o.number}`,
        preheader: `Tracking number ${o.trackingNumber ?? ""}`,
        heading: "Here's your tracking number.",
        body: progress(o.status === "delivered" ? 3 : 2) + p(`We've updated the tracking details for order ${strong(o.number)}.`) + tracking(o),
      };
    case "delivered": {
      const start = o.deliveredAt ?? new Date();
      const warranty = d.items
        .map((i) => `<div style="padding:4px 0;font-size:13px;color:${C.text}">${escapeHtml(i.name)} · ${warrantyMonths(i.slug)}-month warranty, until ${day(warrantyEnds(start, warrantyMonths(i.slug)))}</div>`)
        .join("");
      return {
        subject: `Order ${o.number} was delivered`,
        preheader: "Enjoy your new gear. Your warranty dates are inside.",
        heading: `Delivered. Enjoy it, ${first(o)}.`,
        body:
          progress(3) +
          p(`Order ${strong(o.number)} has been delivered. If anything isn't right, just reply to this email and we'll sort it out.`) +
          panel(`${label("Your warranty")}${warranty}`) +
          p("Got a minute? A short review helps other players choose, and it's from a verified buyer.", "margin-top:8px") +
          accountCta(d, "Write a review", "/account/reviews"),
      };
    }
    case "cancelled":
      return {
        subject: `Order ${o.number} has been cancelled`,
        preheader: o.paymentStatus === "paid" ? `Your payment of ${total} will be refunded.` : "No payment was taken.",
        heading: "Your order has been cancelled.",
        body:
          p(`Order ${strong(o.number)} has been cancelled.`) +
          (o.paymentStatus === "paid"
            ? p(`Your payment of ${strong(total)} will be refunded to the way you paid. We'll email you once the refund has been issued.`)
            : p("No payment was taken. If you still want these items, you're welcome to place a new order, or reply to this email if this is a surprise.")) +
          items(d) +
          button("Back to the shop", url("/shop")),
      };
    case "refunded":
      return {
        subject: `Refund for order ${o.number}`,
        preheader: `${total} is on its way back to you.`,
        heading: "Your refund is on its way.",
        body:
          p(`We've refunded ${strong(total)} for order ${strong(o.number)} to the way you paid. Banks usually take 5 to 10 business days to show it.`) +
          invoice(d) +
          (d.hasAccount ? small("Loyalty points earned on this order have been removed from your balance.") : ""),
      };
  }
}

/** The new-order alert for staff: who, what, and a link to it in the admin. */
async function staffAlert(d: Data) {
  const to = staffInbox();
  if (!to) return;
  const { o } = d;
  const paid = o.paymentStatus === "paid";
  await sendEmail({
    to,
    replyTo: o.email,
    subject: `New order ${o.number} · ${money(o.totalCents, o.currency)}${paid ? " · paid" : " · awaiting payment"}`,
    html: await layout({
      audience: "staff",
      preheader: `${o.firstName} ${o.lastName} · ${o.country} · ${paymentLabel(o)}`,
      kicker: "New order",
      heading: `${o.number} · ${money(o.totalCents, o.currency)}`,
      body: `${invoice(d)}${button("Open in the lab console", url(`/admin/orders/${o.id}`))}`,
      reason: "Sent to the store's order alert address.",
    }),
    idempotencyKey: `order-alert/${o.number}`,
  });
}

const EVENT_LABEL: Record<OrderEmail, string> = {
  received: "Order confirmation",
  paid: "Payment receipt and invoice",
  shipped: "Shipping confirmation",
  tracking: "Tracking update",
  delivered: "Delivery confirmation",
  cancelled: "Cancellation notice",
  refunded: "Refund notice",
};

/**
 * Emails the customer about their order (and staff about new ones). Resolves true when the customer
 * email went out, which is also noted on the order's timeline. Never throws.
 */
export async function emailOrder(orderId: number, kind: OrderEmail, options: { note?: string } = {}) {
  try {
    const d = await load(orderId);
    if (!d) return false;
    const r = render(kind, d, options.note);
    const sent = await sendEmail({
      to: d.o.email,
      subject: r.subject,
      html: await layout({ preheader: r.preheader, kicker: `Order ${d.o.number}`, heading: r.heading, body: r.body, reason: `You're getting this because you ordered from tracecorelab.com.` }),
      replyTo: customerReplyTo(),
      // One per order and event; tracking emails also per tracking number, so a corrected number still goes out.
      idempotencyKey: `order-${kind}/${d.o.number}${kind === "shipped" || kind === "tracking" ? `/${d.o.trackingNumber ?? ""}` : ""}`,
    });
    // Staff hear about manual-payment orders when they're placed, and card orders once Razorpay has the money.
    if (kind === "received" || (kind === "paid" && d.o.razorpayOrderId)) await staffAlert(d);
    if (sent) await getDb().insert(orderEvents).values({ orderId, type: "email", message: `${EVENT_LABEL[kind]} emailed to ${d.o.email}`.slice(0, 500) });
    return sent;
  } catch (err) {
    console.error(`[email] order ${kind}`, err);
    return false;
  }
}
