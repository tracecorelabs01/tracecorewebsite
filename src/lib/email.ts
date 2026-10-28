import "server-only";
import { site } from "@/lib/site";

// Transactional email via Resend's HTTP API (no SDK). Disabled unless
// RESEND_API_KEY and EMAIL_FROM are set — order flow never depends on it.

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
    });
    if (!res.ok) console.error("[email] send failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export interface OrderEmailData {
  number: string;
  email: string;
  firstName: string;
  lines: { name: string; option?: string | null; qty: number; lineTotalCents: number }[];
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  note: string;
}

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0607;font-family:Helvetica,Arial,sans-serif;color:#f7f2ef">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#140d0e;border:1px solid #2a1f20;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#ff0f0f,#ff7300)"></td></tr>
<tr><td style="padding:28px 28px 8px"><div style="font-size:22px;font-weight:800;letter-spacing:.5px"><span style="color:#ff3a00">TRACECORE</span><span style="color:#dcdddf">LAB</span></div>
<h1 style="font-size:22px;margin:20px 0 4px">${title}</h1></td></tr>
<tr><td style="padding:0 28px 28px;font-size:14px;line-height:1.6;color:#d8cfcc">${body}</td></tr>
</table><p style="color:#857b79;font-size:12px;margin-top:16px">${escapeHtml(site.name)} · ${escapeHtml(site.domain)}</p></td></tr></table></body></html>`;
}

function summary(o: OrderEmailData) {
  const rows = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0">${l.qty} × ${escapeHtml(l.name)}${l.option ? ` <span style="color:#857b79">· ${escapeHtml(l.option)}</span>` : ""}</td><td align="right">${money(l.lineTotalCents)}</td></tr>`,
    )
    .join("");
  return `<table width="100%" style="border-top:1px solid #2a1f20;border-bottom:1px solid #2a1f20;margin:16px 0;font-size:14px">${rows}
<tr><td style="padding-top:10px;color:#857b79">Subtotal</td><td align="right" style="padding-top:10px">${money(o.subtotalCents)}</td></tr>
${o.discountCents ? `<tr><td style="color:#857b79">Discount</td><td align="right">−${money(o.discountCents)}</td></tr>` : ""}
<tr><td style="color:#857b79">Shipping</td><td align="right">${o.shippingCents ? money(o.shippingCents) : "Free"}</td></tr>
<tr><td style="padding:8px 0;font-weight:700">Total</td><td align="right" style="font-weight:700">${money(o.totalCents)}</td></tr></table>`;
}

export async function sendOrderEmails(order: OrderEmailData) {
  const customer = sendEmail({
    to: order.email,
    subject: `Order ${order.number} received`,
    html: layout(
      `Thanks, ${escapeHtml(order.firstName)} — we've got your order`,
      `<p>Order <strong>${escapeHtml(order.number)}</strong></p>${summary(order)}<p>${escapeHtml(order.note)}</p>`,
    ),
  });
  const alertTo = process.env.ORDER_ALERT_EMAIL;
  const alert = alertTo
    ? sendEmail({
        to: alertTo,
        replyTo: order.email,
        subject: `New order ${order.number} — ${money(order.totalCents)}`,
        html: layout(`New order ${escapeHtml(order.number)}`, `<p>${escapeHtml(order.email)} · ${escapeHtml(order.paymentMethod)}</p>${summary(order)}`),
      })
    : Promise.resolve(false);
  await Promise.allSettled([customer, alert]);
}

export interface ShippingEmailData {
  number: string;
  email: string;
  firstName: string;
  carrier: string | null;
  trackingNumber: string | null;
  lines: { name: string; option?: string | null; qty: number }[];
  /** Ship-to address, one line per entry. */
  shipTo: string[];
}

/** "Your order has shipped". Resolves true only when the email was actually sent. */
export async function sendShippingEmail(o: ShippingEmailData) {
  const items = o.lines
    .map((l) => `<tr><td style="padding:6px 0">${l.qty} × ${escapeHtml(l.name)}${l.option ? ` <span style="color:#857b79">· ${escapeHtml(l.option)}</span>` : ""}</td></tr>`)
    .join("");
  const tracking = o.trackingNumber
    ? `<p style="margin:16px 0 0;padding:12px 14px;border:1px solid #2a1f20;border-radius:10px"><span style="color:#857b79">${o.carrier ? `${escapeHtml(o.carrier)} tracking number` : "Tracking number"}</span><br><strong style="font-family:Menlo,Consolas,monospace;font-size:15px;color:#f7f2ef">${escapeHtml(o.trackingNumber)}</strong></p>`
    : o.carrier
      ? `<p>Carrier: ${escapeHtml(o.carrier)}</p>`
      : "";
  const shipTo = o.shipTo.length ? `<p style="margin:0;color:#857b79">Shipping to</p><p style="margin:4px 0 0">${o.shipTo.map(escapeHtml).join("<br>")}</p>` : "";
  return sendEmail({
    to: o.email,
    subject: `Order ${o.number} has shipped`,
    html: layout(
      `Good news, ${escapeHtml(o.firstName)} — your order is on its way`,
      `<p>Order <strong>${escapeHtml(o.number)}</strong> has shipped.</p>${tracking}<table width="100%" style="border-top:1px solid #2a1f20;border-bottom:1px solid #2a1f20;margin:16px 0;font-size:14px">${items}</table>${shipTo}`,
    ),
  });
}
