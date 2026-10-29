// Account and community emails: welcome, password reset (customers and staff), password changed,
// reward codes, newsletter welcome, and the contact-form alert for staff.

import "server-only";
import { button, C, code, customerReplyTo, escapeHtml, label, layout, p, panel, sendEmail, small, staffInbox, strong, url } from "@/lib/email";

const hello = (name: string | null | undefined) => (name ? `, ${name}` : "");

/** Account ready. With `setPasswordUrl`, it asks them to choose a password (accounts created by the team). */
export async function sendWelcome(to: string, name: string | null, setPasswordUrl?: string) {
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
        (setPasswordUrl
          ? p("Our team created it for you. Choose your own password to get started.") + button("Set your password", setPasswordUrl) + small("The link works for 3 days. After that, use “Forgot password” on the login page.")
          : button("Go to your account", url("/account"))),
      reason: "You're getting this because an account was opened with this email at tracecorelab.com.",
    }),
    idempotencyKey: `welcome/${to.toLowerCase()}`,
  });
}

/** A link to set a new password. `newAccount`: they've ordered but never set one, so this opens their account. */
export async function sendPasswordReset({ to, name, resetUrl, audience, newAccount = false, key }: { to: string; name: string | null; resetUrl: string; audience: "customer" | "staff"; newAccount?: boolean; key: string }) {
  const staff = audience === "staff";
  return sendEmail({
    to,
    replyTo: staff ? undefined : customerReplyTo(),
    subject: staff ? "Reset your Lab console password" : newAccount ? "Set your TraceCore Lab password" : "Reset your TraceCore Lab password",
    html: await layout({
      audience,
      preheader: "This link works for one hour.",
      kicker: staff ? "Lab console" : "Your account",
      heading: newAccount ? "Choose your password." : "Reset your password.",
      body:
        p(`Hi${hello(name)}. ${newAccount ? "Set a password to open your account and see your orders." : `Someone asked to reset the password for ${strong(to)}.`}`) +
        button(newAccount ? "Set your password" : "Choose a new password", resetUrl) +
        small("The link works once, for one hour. If you didn't ask for this, you can ignore this email: your password stays the same."),
      reason: staff ? "Sent because a password reset was requested on the Lab console." : "Sent because a password reset was requested at tracecorelab.com.",
    }),
    idempotencyKey: `reset/${key}`,
  });
}

/** Security notice after any password change. */
export async function sendPasswordChanged(to: string, name: string | null, audience: "customer" | "staff") {
  const staff = audience === "staff";
  const when = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  return sendEmail({
    to,
    replyTo: staff ? undefined : customerReplyTo(),
    subject: staff ? "Your Lab console password was changed" : "Your TraceCore Lab password was changed",
    html: await layout({
      audience,
      preheader: `Changed on ${when} UTC.`,
      kicker: "Security",
      heading: "Your password was changed.",
      body:
        p(`Hi${hello(name)}. The password for ${strong(to)} was changed on ${escapeHtml(when)} UTC, and other devices were signed out.`) +
        p(staff ? "If this wasn't you, tell the store owner right away." : "If this wasn't you, reset your password now and reply to this email so we can help.") +
        (staff ? "" : button("Reset password", url("/account/forgot"))),
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
