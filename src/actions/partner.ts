"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { affiliates, customers, getDb, isDbConfigured } from "@/db";
import {
  currentPartner,
  defaultGroupId,
  freeCode,
  getProgram,
  partnerByCode,
  partnerForCustomer,
  partnerPriceMap,
  recordClick,
  rememberPartner,
  requestPayout,
} from "@/lib/affiliates";
import { getLinkedAccounts } from "@/lib/account";
import { getCurrentCustomer, requireCustomer } from "@/lib/auth/customer";
import { cookieIsSecure } from "@/lib/auth/session";
import { sendApplicationAlert, sendApplicationReceived, sendPayoutRequestAlert, sendStoreCredit } from "@/lib/emails/partners";

export type PartnerFormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;
export type PartnerPricing = { name: string; prices: Record<string, number> } | null;

/** One click per visitor, partner and day. */
const SEEN_COOKIE = "tcl_ref_seen";

/** A visit through a partner's link: remember them (their prices from now on) and count the click. */
export async function trackReferral(code: string): Promise<PartnerPricing> {
  if (!isDbConfigured() || !/^[A-Za-z0-9_-]{2,32}$/.test(code)) return null;
  const partner = await partnerByCode(code);
  const me = partner && (await getCurrentCustomer());
  if (!partner || (me && me.email.toLowerCase() === partner.email.toLowerCase())) return null;
  await rememberPartner(partner.id, "link", (await getProgram()).cookieDays);
  const jar = await cookies();
  const seen = `${partner.id}:${new Date().toISOString().slice(0, 10)}`;
  if (jar.get(SEEN_COOKIE)?.value !== seen) {
    jar.set(SEEN_COOKIE, seen, { httpOnly: true, sameSite: "lax", secure: await cookieIsSecure(), path: "/", maxAge: 86_400 });
    await recordClick(partner.id);
  }
  return { name: partner.name, prices: await partnerPriceMap(partner.id) };
}

/** The prices of the partner who referred this visitor, for the storefront to show. */
export async function referralPricing(): Promise<PartnerPricing> {
  const me = await getCurrentCustomer();
  const partner = await currentPartner({ buyerEmail: me?.email });
  return partner ? { name: partner.name, prices: await partnerPriceMap(partner.id) } : null;
}

const applySchema = z.object({
  name: z.string().trim().min(2, "Enter your channel, shop or display name.").max(120),
  website: z.union([z.literal(""), z.url("Enter a full link starting with https://").max(255)]),
  audience: z.string().trim().min(20, "Tell us a little more (at least 20 characters).").max(2000),
  paypalEmail: z.union([z.literal(""), z.email("Enter a valid email.").max(191)]),
});

export async function applyAsPartner(_prev: PartnerFormState, fd: FormData): Promise<PartnerFormState> {
  const me = await requireCustomer();
  if (!(await getProgram()).enabled) return { ok: false, message: "The partner program isn't taking applications right now." };
  if (await partnerForCustomer(me.id)) return { ok: false, message: "You've already applied." };
  if (!(await getLinkedAccounts(me.id)).discord) return { ok: false, message: "Connect your Discord account first. Partners sign up through Discord." };
  const parsed = applySchema.safeParse({ name: fd.get("name") ?? "", website: String(fd.get("website") ?? "").trim(), audience: fd.get("audience") ?? "", paypalEmail: String(fd.get("paypalEmail") ?? "").trim() });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  if (fd.get("terms") !== "on") fieldErrors.terms = "Please accept the partner terms.";
  if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, message: "Please check the highlighted fields.", fieldErrors };

  const db = getDb();
  const { name, website, audience, paypalEmail } = parsed.data;
  const [{ id }] = await db
    .insert(affiliates)
    .values({ customerId: me.id, name, website: website || null, audience, paypalEmail: paypalEmail || null, code: await freeCode(name, db), groupId: await defaultGroupId(db) })
    .$returningId();
  await Promise.all([sendApplicationReceived(me.email, me.firstName || null, name), sendApplicationAlert({ id, name, email: me.email, website: website || null, audience })]);
  refresh();
  return { ok: true, message: "Application sent. We'll email you once it's reviewed." };
}

/** The signed-in customer's approved partner profile, or null. */
async function myPartner() {
  const me = await requireCustomer();
  const partner = await partnerForCustomer(me.id);
  return partner?.status === "approved" ? { me, partner } : null;
}

export async function savePayoutEmail(_prev: PartnerFormState, fd: FormData): Promise<PartnerFormState> {
  const mine = await myPartner();
  if (!mine) return { ok: false, message: "Your partner account isn't active." };
  const email = z.email().max(191).safeParse(String(fd.get("paypalEmail") ?? "").trim());
  if (!email.success) return { ok: false, message: "Enter a valid PayPal email.", fieldErrors: { paypalEmail: "Enter a valid email." } };
  await getDb().update(affiliates).set({ paypalEmail: email.data }).where(eq(affiliates.id, mine.partner.id));
  refresh();
  return { ok: true, message: "PayPal email saved." };
}

export async function requestPartnerPayout(method: "paypal" | "store_credit"): Promise<{ ok: boolean; message: string }> {
  const mine = await myPartner();
  if (!mine) return { ok: false, message: "Your partner account isn't active." };
  if (method !== "paypal" && method !== "store_credit") return { ok: false, message: "Choose PayPal or store credit." };
  const result = await requestPayout(mine.partner.id, method);
  if (!result.ok) return result;
  const amount = `$${(result.amountCents / 100).toFixed(2)}`;
  if (result.code) {
    const [c] = await getDb().select({ firstName: customers.firstName }).from(customers).where(eq(customers.id, mine.me.id)).limit(1);
    await sendStoreCredit(mine.me.email, c?.firstName || null, result.amountCents, result.code);
    refresh();
    return { ok: true, message: `Your store credit code is ${result.code}: ${amount} off an order of ${amount} or more. We've emailed it to you too.` };
  }
  await sendPayoutRequestAlert({ partnerId: mine.partner.id, partnerName: mine.partner.name, amountCents: result.amountCents, paypalEmail: mine.partner.paypalEmail ?? "" });
  refresh();
  return { ok: true, message: `Payout of ${amount} requested. We'll send it to ${mine.partner.paypalEmail} and email you when it's paid.` };
}
