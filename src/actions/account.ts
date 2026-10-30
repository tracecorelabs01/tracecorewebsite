"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { customers, discountCodes, getDb, isDbConfigured, products, reviews } from "@/db";
import { customerWithOrders, hasBought } from "@/lib/account";
import { accountPath, consumeLoginCode, createCustomerSession, createLoginCode, destroyCustomerSession, requireCustomer } from "@/lib/auth/customer";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/auth/session";
import { emailEnabled } from "@/lib/email";
import { sendLoginCode, sendRewardCode } from "@/lib/emails/account";
import { redeemOffer, rewardLabel, withProductNames } from "@/lib/loyalty";
import { getClientIp } from "@/lib/request";

// guest: the email has orders but no account, so the form offers to create one. create: a code for creating it.
export type AccountFormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string>; email?: string; guest?: boolean; create?: boolean } | null;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const NO_DB: AccountFormState = { ok: false, message: "Accounts aren't available on this store yet." };
const BLOCKED: AccountFormState = { ok: false, message: "Too many attempts. Please wait 15 minutes and try again." };

/** The customer with an open account for this email, if any. */
async function accountFor(email: string) {
  const [c] = await getDb()
    .select({ id: customers.id, firstName: customers.firstName })
    .from(customers)
    .where(and(eq(customers.email, email), isNotNull(customers.accountCreatedAt)))
    .limit(1);
  return c;
}

const SEND_FAILED: AccountFormState = { ok: false, message: "We couldn't send the email just now. Please try again in a minute." };

/**
 * Emails a 6-digit sign-in code, or says plainly that the email has no account. A guest (orders, no account) can
 * ask for a code that creates their account (`create`), which `login` opens once the code checks out.
 */
export async function requestCode(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  if (!isEmail(email)) return { ok: false, message: "Enter the email you ordered with.", fieldErrors: { email: "Enter a valid email address." } };
  if (!emailEnabled()) return { ok: false, message: "Signing in isn't available right now. Please contact us and we'll help." };

  // Every request counts towards the limit, so the form can't be used to flood someone's inbox.
  const key = `code-request:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  await recordLoginAttempt(key, ip, false);

  const c = await accountFor(email);
  if (c) {
    if (!(await sendLoginCode(email, c.firstName || null, await createLoginCode(c.id)))) return SEND_FAILED;
    return { ok: true, email, message: `We've emailed a 6-digit code to ${email}. It works once, for 10 minutes.` };
  }
  const guest = await customerWithOrders(email);
  if (!guest) {
    return { ok: false, email, message: "You don't have an account with us. You get one when you check out and choose Create an account.", fieldErrors: { email: "No account with this email." } };
  }
  if (fd.get("create") !== "1") return { ok: false, guest: true, email, message: `You don't have an account with us yet: your orders with ${email} were placed as a guest.` };
  if (!(await sendLoginCode(email, guest.firstName || null, await createLoginCode(guest.id)))) return SEND_FAILED;
  return { ok: true, create: true, email, message: `We've emailed a 6-digit code to ${email}. Enter it to create your account. It works once, for 10 minutes.` };
}

export async function login(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  const code = str(fd.get("code")).replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, message: "Enter the 6-digit code from the email.", fieldErrors: { code: "Enter all 6 digits." } };

  // Login attempts share the admin table; the prefix keeps customer and staff counts apart.
  // Six wrong codes lock the email for 15 minutes, longer than a code lives.
  const key = `account:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  // A guest creating their account: proving the email with the code is what opens it.
  const create = fd.get("create") === "1";
  const c = (await accountFor(email)) ?? (create ? await customerWithOrders(email) : undefined);
  const valid = Boolean(c) && (await consumeLoginCode(c!.id, code));
  await recordLoginAttempt(key, ip, valid);
  if (!valid) return { ok: false, message: "That code is wrong or has expired. Check the newest email, or send a new code.", fieldErrors: { code: "Wrong or expired code." } };

  await getDb()
    .update(customers)
    .set({ lastLoginAt: new Date(), accountCreatedAt: sql`coalesce(${customers.accountCreatedAt}, ${new Date()})` })
    .where(eq(customers.id, c!.id));
  await createCustomerSession(c!.id);
  redirect(accountPath(fd.get("next")));
}

export async function logout() {
  await destroyCustomerSession();
  redirect("/account/login?out=1");
}

/* ───────────── Order tracking for guests (/track): an email code shows that email's orders, no account ───────────── */

/** Emails a code that opens /track for this email's orders, or says plainly that it has none. */
export async function requestTrackCode(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  if (!isEmail(email)) return { ok: false, message: "Enter the email you ordered with.", fieldErrors: { email: "Enter a valid email address." } };
  if (!emailEnabled()) return { ok: false, message: "Order tracking isn't available right now. Please contact us and we'll help." };

  const key = `track-request:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  await recordLoginAttempt(key, ip, false);

  const c = await customerWithOrders(email);
  if (!c) return { ok: false, email, message: `We couldn't find any orders for ${email}. Check it's the email you ordered with.`, fieldErrors: { email: "No orders with this email." } };
  if (!(await sendLoginCode(email, c.firstName || null, await createLoginCode(c.id), "tracking"))) return SEND_FAILED;
  return { ok: true, email, message: `We've emailed a 6-digit code to ${email}. It works once, for 10 minutes.` };
}

export async function verifyTrackCode(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  const code = str(fd.get("code")).replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, message: "Enter the 6-digit code from the email.", fieldErrors: { code: "Enter all 6 digits." } };

  const key = `track:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  const c = await customerWithOrders(email);
  const valid = Boolean(c) && (await consumeLoginCode(c!.id, code));
  await recordLoginAttempt(key, ip, valid);
  if (!valid) return { ok: false, message: "That code is wrong or has expired. Check the newest email, or send a new code.", fieldErrors: { code: "Wrong or expired code." } };

  await createCustomerSession(c!.id, "orders");
  redirect("/track");
}

export async function endTracking() {
  await destroyCustomerSession("orders");
  redirect("/track");
}

export async function redeem(offerId: number): Promise<{ ok: boolean; message: string }> {
  const me = await requireCustomer();
  if (!Number.isInteger(offerId)) return { ok: false, message: "That offer isn't available any more." };
  const result = await redeemOffer(me.id, offerId);
  if (!result.ok) return result;
  // A copy of the code by email, so it isn't lost.
  const [issued] = await getDb()
    .select({ kind: discountCodes.kind, value: discountCodes.value, minSubtotalCents: discountCodes.minSubtotalCents, productIds: discountCodes.productIds })
    .from(discountCodes)
    .where(eq(discountCodes.code, result.code))
    .limit(1);
  if (issued) {
    const [named] = await withProductNames([issued]);
    await sendRewardCode(me.email, me.firstName, result.code, rewardLabel(named), result.title);
  }
  refresh();
  return { ok: true, message: `Your code is ${result.code}. Enter it at checkout. It works once.` };
}

export async function submitReview(productId: number, _prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const me = await requireCustomer();
  const rating = Number(fd.get("rating"));
  const body = str(fd.get("body"));
  const name = str(fd.get("name")) || [me.firstName, me.lastName.slice(0, 1) && `${me.lastName.slice(0, 1)}.`].filter(Boolean).join(" ") || "Customer";

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fieldErrors.rating = "Choose 1 to 5 stars.";
  if (body.length < 10) fieldErrors.body = "Tell us a little more (at least 10 characters).";
  else if (body.length > 2000) fieldErrors.body = "Keep it under 2,000 characters.";
  if (name.length > 80) fieldErrors.name = "Keep it under 80 characters.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please check the highlighted fields.", fieldErrors };

  const db = getDb();
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product || !(await hasBought(me.id, productId))) return { ok: false, message: "You can review products from your paid orders." };
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.customerId, me.id), eq(reviews.productId, productId)))
    .limit(1);
  if (existing) return { ok: false, message: "You've already reviewed this product." };

  await db.insert(reviews).values({ productId, name, email: me.email, rating, body, status: "pending", source: "account", customerId: me.id });
  refresh();
  return { ok: true, message: "Thanks! Your review will show on the store once we've checked it." };
}
