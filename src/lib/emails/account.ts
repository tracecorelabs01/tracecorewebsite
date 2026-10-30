// Account and community emails: sign-in code, welcome, staff password reset and changed, reward codes,
// newsletter welcome, and the contact-form alert for staff.

import "server-only";
import { button, C, code, customerReplyTo, escapeHtml, label, layout, p, panel, sendEmail, small, staffInbox, strong, url } from "@/lib/email";

const hello = (name: string | null | undefined) => (name ? `, ${name}` : "");

/** The 6-digit code that signs a customer in, or (for "tracking") shows a guest their orders on /track. */
export async function sendLoginCode(to: string, name: string | null, loginCode: string, purpose: "sign-in" | "tracking" = "sign-in") {
  const tracking = purpose === "tracking";
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: `${loginCode} is your TraceCore Lab ${tracking ? "order tracking" : "sign-in"} code`,
    html: await layout({
      preheader: "It works once, for 10 minutes.",
      kicker: tracking ? "Track your order" : "Your account",
      heading: `Your ${tracking ? "tracking" : "sign-in"} code${hello(name)}.`,
      body:
        p(tracking ? "Enter this code on the order tracking page to see your orders:" : "Enter this code on the sign-in page:") +
        panel(`${label(tracking ? "Tracking code" : "Sign-in code")}${code(loginCode, 32)}`, C.brand) +
        small(
          `It works once, for 10 minutes. If you didn't ask for it, ignore this email: no one can see your ${tracking ? "orders" : "account"} without this code.`,
        ),
      reason: `Sent because someone asked to ${tracking ? "track the orders for" : "sign in with"} this email at tracecorelab.com.`,
    }),
  });
}

/** Account ready: for accounts staff open. Customers who open their own (at checkout, or with Discord or Google) don't get this email. */
export async function sendWelcome(to: string, name: string | null) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: "Your TraceCore Lab account is ready",
    html: await layout({
      preheader: "Track your orders, collect loyalty points and review what you bought.",
      kicker: "Welcome",
      heading: `Your account is ready${hello(name)}.`,
      body:
        p("From your account you can follow every order and its tracking, see your warranty dates, collect loyalty points on every purchase and spend them on rewards.") +
        p(`There's no password: sign in with ${strong(to)} and we'll email you a code.`) +
        button("Sign in", url(`/account/login?${new URLSearchParams({ email: to })}`)),
      reason: "You're getting this because an account was opened with this email at tracecorelab.com.",
    }),
    idempotencyKey: `welcome/${to.toLowerCase()}`,
  });
}

/** A link for staff to set a new Lab console password. */
export async function sendPasswordReset({ to, name, resetUrl, key }: { to: string; name: string | null; resetUrl: string; key: string }) {
  return sendEmail({
    to,
    subject: "Reset your Lab console password",
    html: await layout({
      audience: "staff",
      preheader: "This link works for one hour.",
      kicker: "Lab console",
      heading: "Reset your password.",
      body:
        p(`Hi${hello(name)}. Someone asked to reset the password for ${strong(to)}.`) +
        button("Choose a new password", resetUrl) +
        small("The link works once, for one hour. If you didn't ask for this, you can ignore this email: your password stays the same."),
      reason: "Sent because a password reset was requested on the Lab console.",
    }),
    idempotencyKey: `reset/${key}`,
  });
}

/** Security notice after a staff password change. */
export async function sendPasswordChanged(to: string, name: string | null) {
  const when = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  return sendEmail({
    to,
    subject: "Your Lab console password was changed",
    html: await layout({
      audience: "staff",
      preheader: `Changed on ${when} UTC.`,
      kicker: "Security",
      heading: "Your password was changed.",
      body:
        p(`Hi${hello(name)}. The password for ${strong(to)} was changed on ${escapeHtml(when)} UTC, and other devices were signed out.`) +
        p("If this wasn't you, tell the store owner right away."),
    }),
    idempotencyKey: `password-changed/${to.toLowerCase()}/${when}`,
  });
}

/** The single-use code a customer got for their points. */
export async function sendRewardCode(to: string, name: string | null, rewardCode: string, reward: string, title: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: `Your reward code: ${reward}`,
    html: await layout({
      preheader: `${rewardCode} · ${reward}. Enter it at checkout.`,
      kicker: "Loyalty reward",
      heading: `Enjoy your reward${hello(name)}.`,
      body:
        p(`You spent your points on ${strong(title)}. Here's your code:`) +
        panel(`${label(reward)}${code(rewardCode, 26)}`, C.brand) +
        p("Enter it in the discount box at checkout. It works once.") +
        button("Shop now", url("/shop")),
      reason: "Sent because you redeemed loyalty points at tracecorelab.com.",
    }),
    idempotencyKey: `reward/${rewardCode}`,
  });
}

/** Confirmation for a footer newsletter sign-up. */
export async function sendNewsletterWelcome(to: string) {
  return sendEmail({
    to,
    replyTo: customerReplyTo(),
    subject: "You're on the TraceCore Lab list",
    html: await layout({
      preheader: "Drops, restocks and lab notes. No spam.",
      kicker: "Newsletter",
      heading: "You're on the list.",
      body:
        p("We'll email you when new hardware drops, when sold-out items are back, and when there's something genuinely worth knowing. Nothing else.") +
        button("See what's in stock", url("/shop")) +
        small("Changed your mind? Reply with “unsubscribe” and we'll take you off the list."),
      reason: "You signed up for the newsletter at tracecorelab.com.",
    }),
    idempotencyKey: `newsletter-welcome/${to.toLowerCase()}`,
  });
}

/** Contact-form message, for staff. Replying goes straight to the customer. */
export async function sendContactAlert(m: { id: number; name: string; email: string; topic: string; body: string; orderNumber?: string | null }) {
  const to = staffInbox();
  if (!to) return false;
  return sendEmail({
    to,
    replyTo: m.email,
    subject: `Support message: ${m.topic} · ${m.name}`,
    html: await layout({
      audience: "staff",
      preheader: m.body.slice(0, 120),
      kicker: "Contact form",
      heading: `${m.topic} from ${m.name}`,
      body:
        p(`${strong(m.name)} · ${escapeHtml(m.email)}${m.orderNumber ? ` · order ${strong(m.orderNumber)}` : ""}`) +
        panel(`<div style="font-size:14px;line-height:1.65;color:${C.text};white-space:pre-wrap">${escapeHtml(m.body)}</div>`) +
        p("Reply to this email to answer them directly.") +
        button("Open in the inbox", url("/admin/messages")),
      reason: "Sent to the store's alert address.",
    }),
    idempotencyKey: `contact/${m.id}`,
  });
}
