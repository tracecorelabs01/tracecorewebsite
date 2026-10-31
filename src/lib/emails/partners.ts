// Affiliate program emails: application received (partner and staff), approved, not approved, payout requested
// (staff), PayPal payout sent and store credit issued.

import "server-only";
import { button, C, code, customerReplyTo, escapeHtml, label, layout, p, panel, sendEmail, small, staffInbox, strong, url } from "@/lib/email";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const hello = (name: string | null | undefined) => (name ? `, ${name}` : "");

export async function sendApplicationReceived(to: string, firstName: string | null, partnerName: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: "We've got your partner application",
    html: await layout({
      preheader: "We'll email you when it's been reviewed.",
      kicker: "Partner program",
      heading: `Thanks for applying${hello(firstName)}.`,
      body: p(`We've received the partner application for ${strong(partnerName)}. The team reviews every application by hand and will email you the decision.`),
      reason: "Sent because you applied to the TraceCore Lab partner program.",
    }),
  });
}

export async function sendApplicationAlert(a: { id: number; name: string; email: string; website: string | null; audience: string }) {
  const to = staffInbox();
  if (!to) return false;
  return sendEmail({
    to,
    replyTo: a.email,
    subject: `Partner application: ${a.name}`,
    html: await layout({
      audience: "staff",
      preheader: a.audience.slice(0, 120),
      kicker: "Partner program",
      heading: `${a.name} wants to be a partner`,
      body:
        p(`${strong(a.name)} · ${escapeHtml(a.email)}${a.website ? ` · ${escapeHtml(a.website)}` : ""}`) +
        panel(`<div style="font-size:14px;line-height:1.65;color:${C.text};white-space:pre-wrap">${escapeHtml(a.audience)}</div>`) +
        button("Review the application", url(`/admin/affiliates/${a.id}`)),
      reason: "Sent to the store's alert address.",
    }),
    idempotencyKey: `partner-application/${a.id}`,
  });
}

export async function sendPartnerDecision(to: string, firstName: string | null, approved: boolean, partnerCode: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: approved ? "You're a TraceCore Lab partner" : "About your partner application",
    html: await layout({
      preheader: approved ? "Your partner portal is ready." : "Thanks for your interest in the partner program.",
      kicker: "Partner program",
      heading: approved ? `Welcome aboard${hello(firstName)}.` : `Thanks for applying${hello(firstName)}.`,
      body: approved
        ? p("Your application is approved. Your partner portal has your link, your code, the products you can promote and what you earn on each.") +
          panel(`${label("Your partner code")}${code(partnerCode, 24)}`, C.brand) +
          button("Open the partner portal", url("/partners"))
        : p("We've reviewed your application and can't approve it right now. If your channel or shop grows, you're welcome to apply again later. Reply to this email if you have any questions."),
      reason: "Sent about your application to the TraceCore Lab partner program.",
    }),
  });
}

export async function sendPayoutRequestAlert(r: { partnerId: number; partnerName: string; amountCents: number; paypalEmail: string }) {
  const to = staffInbox();
  if (!to) return false;
  return sendEmail({
    to,
    subject: `Partner payout request: ${money(r.amountCents)} to ${r.partnerName}`,
    html: await layout({
      audience: "staff",
      preheader: `${money(r.amountCents)} by PayPal to ${r.paypalEmail}`,
      kicker: "Partner program",
      heading: `${r.partnerName} asked for ${money(r.amountCents)}`,
      body:
        p(`Send ${strong(money(r.amountCents))} by PayPal to ${strong(r.paypalEmail)}, then mark the payout paid with the transaction ID.`) +
        button("Open payouts", url("/admin/affiliates?tab=payouts")),
      reason: "Sent to the store's alert address.",
    }),
  });
}

export async function sendPayoutPaid(to: string, firstName: string | null, amountCents: number, reference: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: `We've sent your ${money(amountCents)} partner payout`,
    html: await layout({
      preheader: "Sent by PayPal.",
      kicker: "Partner program",
      heading: `Your payout is on its way${hello(firstName)}.`,
      body: p(`We've sent ${strong(money(amountCents))} to your PayPal account.`) + panel(`${label("PayPal transaction")}${code(reference, 16)}`) + button("See your payouts", url("/partners/payouts")),
      reason: "Sent because you're a TraceCore Lab partner.",
    }),
    idempotencyKey: `partner-payout-paid/${reference}`,
  });
}

export async function sendStoreCredit(to: string, firstName: string | null, amountCents: number, creditCode: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: `Your ${money(amountCents)} store credit code`,
    html: await layout({
      preheader: "Use it at checkout.",
      kicker: "Partner program",
      heading: `Here's your store credit${hello(firstName)}.`,
      body:
        p(`Your partner earnings are now ${strong(money(amountCents))} of store credit.`) +
        panel(`${label("Store credit code")}${code(creditCode, 24)}`, C.brand) +
        small(`Enter it at checkout on an order of ${money(amountCents)} or more. It works once.`),
      reason: "Sent because you're a TraceCore Lab partner.",
    }),
    idempotencyKey: `partner-credit/${creditCode}`,
  });
}
