import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, settings } from "@/db";
import { STORE_SETTINGS_KEY } from "@/lib/admin/settings";
import { resolveSettings } from "@/lib/settings";
import { site } from "@/lib/site";

// Transactional email via Resend's HTTP API (no SDK). Disabled unless RESEND_API_KEY and EMAIL_FROM
// are set; nothing in the store waits on, or fails because of, email.
// Templates live in src/lib/emails/: they all use layout() below, so every email shares one look.

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Customer emails reply here: the sending address has no inbox. */
export const customerReplyTo = () => process.env.EMAIL_REPLY_TO || process.env.ORDER_ALERT_EMAIL || undefined;
/** Staff alerts (new orders, contact form) go here. */
export const staffInbox = () => process.env.ORDER_ALERT_EMAIL || undefined;

/** Plain-text version of an email, for clients that don't show HTML (and for spam filters, which like having one). */
function htmlToText(html: string) {
  return html
    .replace(/<(style|title|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<div[^>]*display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => `${label.replace(/<[^>]+>/g, "").trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|tr|div|table)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#8202;|&zwnj;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Names the event (e.g. "order-paid/TCL-AB12CD"): Resend sends it once even if the call is retried within 24 hours. */
  idempotencyKey?: string;
}

/** Whether the store can send email at all (customers can't sign in without it). */
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Resolves true only when Resend accepted the email. */
export async function sendEmail({ to, subject, html, replyTo, idempotencyKey }: Email) {
  if (!emailEnabled()) return false;
  try {
    // RESEND_API_URL only exists so tests can point this at a local stand-in.
    const res = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}) },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text: htmlToText(html), reply_to: replyTo }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[email] send failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}

/* ───────────── theme ───────────── */

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "Menlo,Consolas,'Courier New',monospace";
export const C = { page: "#060304", card: "#140d0e", panel: "#0e090a", line: "#2a1f20", fg: "#f7f2ef", text: "#d8cfcc", muted: "#9b908d", dim: "#6f6563", brand: "#ff3d00", ember: "#ff1408", blaze: "#ff6a00", ok: "#3ee08f", warn: "#ffb020" };

export const url = (path: string) => `${site.url}${path}`;

/** The store's Discord invite from Settings, when one is set. */
export async function discordLink() {
  try {
    if (!isDbConfigured()) return null;
    const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1);
    const discord = resolveSettings(row?.value).links.discord;
    return /^https:\/\/discord\.(gg|com)\/.+/.test(discord) ? discord : null;
  } catch {
    return null;
  }
}

export const p = (html: string, style = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.text};${style}">${html}</p>`;
export const small = (html: string) => `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${C.dim}">${html}</p>`;
export const strong = (text: string) => `<strong style="color:${C.fg}">${escapeHtml(text)}</strong>`;
export const link = (label: string, href: string) => `<a href="${escapeHtml(href)}" style="color:${C.blaze};text-decoration:underline">${escapeHtml(label)}</a>`;

export function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td bgcolor="${C.brand}" style="border-radius:10px;background:${C.brand};background-image:linear-gradient(90deg,${C.ember},${C.blaze})">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

/** A boxed panel, e.g. a tracking number or reward code. */
export function panel(html: string, accent: string = C.line) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="background:${C.panel};border:1px solid ${accent};border-radius:14px;padding:18px 20px;font-family:${FONT}">${html}</td></tr></table>`;
}

export const label = (text: string) => `<div style="font-family:${MONO};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${C.dim};margin-bottom:6px">${escapeHtml(text)}</div>`;
export const code = (text: string, size = 22) => `<div style="font-family:${MONO};font-size:${size}px;font-weight:700;letter-spacing:.08em;color:${C.fg}">${escapeHtml(text)}</div>`;

export function pill(text: string, color: string) {
  return `<span style="display:inline-block;padding:4px 10px;border:1px solid ${color};border-radius:999px;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${color}">${escapeHtml(text)}</span>`;
}

export interface Layout {
  /** Inbox preview text. */
  preheader: string;
  /** Small line above the heading, e.g. "Order TCL-AB12CD". */
  kicker?: string;
  heading: string;
  body: string;
  /** Who it's for: customer emails get the help line and store links; staff emails don't. */
  audience?: "customer" | "staff";
  /** Why they got it, for the footer. */
  reason?: string;
}

export async function layout({ preheader, kicker, heading, body, audience = "customer", reason }: Layout) {
  const discord = audience === "customer" ? await discordLink() : null;
  const help =
    audience === "customer"
      ? `<tr><td style="padding:22px 36px 30px;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted}">Questions? Reply to this email${discord ? ` or open a ticket on ${link("our Discord", discord)}` : ""}. We usually answer within a few hours.</td></tr>`
      : "";
  const nav =
    audience === "customer"
      ? [link("Shop", url("/shop")), link("Your account", url("/account")), discord && link("Discord", discord)].filter(Boolean).join(`<span style="color:${C.dim}"> &nbsp;·&nbsp; </span>`)
      : link("Lab console", url("/admin"));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${escapeHtml(preheader)}${"&#8202;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 6px 18px;font-family:${FONT}"><a href="${url("/")}" style="text-decoration:none;font-size:22px;font-weight:900;letter-spacing:.04em"><span style="color:${C.brand}">TRACECORE</span><span style="color:#dcdddf">LAB</span></a></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${C.brand};background-image:linear-gradient(90deg,${C.ember},${C.blaze})">&nbsp;</td></tr>
<tr><td style="padding:34px 36px 8px;font-family:${FONT}">
${kicker ? `<div style="font-family:${MONO};font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${C.blaze};margin-bottom:12px">${escapeHtml(kicker)}</div>` : ""}
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-.01em;color:${C.fg}">${escapeHtml(heading)}</h1>
</td></tr>
<tr><td style="padding:0 36px 30px;font-family:${FONT}">${body}</td></tr>
${help}
</table></td></tr>
<tr><td align="center" style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.dim}">
${nav}<br>${escapeHtml(site.name)} · Lab-tested DMA hardware · ${link(site.domain, url("/"))}${reason ? `<br>${escapeHtml(reason)}` : ""}
</td></tr>
</table></td></tr></table></body></html>`;
}
