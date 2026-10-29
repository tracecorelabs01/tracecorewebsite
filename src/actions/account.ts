"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { customers, getDb, isDbConfigured, orders, products, reviews } from "@/db";
import { hasBought } from "@/lib/account";
import { createCustomerSession, destroyCustomerSession, requireCustomer, revokeCustomerSessions } from "@/lib/auth/customer";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/auth/session";
import { redeemOffer } from "@/lib/loyalty";
import { getClientIp } from "@/lib/request";

export type AccountFormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const NO_DB: AccountFormState = { ok: false, message: "Accounts aren't available on this store yet." };
const BLOCKED: AccountFormState = { ok: false, message: "Too many attempts. Please wait 15 minutes and try again." };

/** Only send people back to account pages after signing in. */
function nextPath(value: FormDataEntryValue | null) {
  const next = str(value);
  return /^\/account(\/[\w-]*)*$/.test(next) ? next : "/account";
}

export async function login(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!isEmail(email) || !password) return { ok: false, message: "Enter your email and password." };

  // Login attempts share the admin table; the prefix keeps customer and staff counts apart.
  const key = `account:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  const db = getDb();
  const [c] = await db.select({ id: customers.id, passwordHash: customers.passwordHash }).from(customers).where(eq(customers.email, email)).limit(1);
  const valid = Boolean(c?.passwordHash) && (await verifyPassword(password, c!.passwordHash!));
  await recordLoginAttempt(key, ip, valid);
  if (!valid) return { ok: false, message: "That email and password don't match. First time here? Open your account with your order number below." };

  await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, c!.id));
  await createCustomerSession(c!.id);
  redirect(nextPath(fd.get("next")));
}

/**
 * Open an account, or set a new password: proof is the email and number of a paid order. Accounts only
 * exist for customers who have paid for something, and this works without store emails being set up.
 */
export async function openAccount(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  if (!isDbConfigured()) return NO_DB;
  const email = str(fd.get("email")).toLowerCase();
  const number = str(fd.get("order")).toUpperCase();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Enter the email you ordered with.";
  if (!/^TCL-[A-Z0-9]{6}$/.test(number)) fieldErrors.order = "Enter your order number, e.g. TCL-AB12CD.";
  if (password.length < PASSWORD_MIN) fieldErrors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (password.length > 200) fieldErrors.password = "Use 200 characters or fewer.";
  else if (confirm !== password) fieldErrors.confirm = "The passwords don't match.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please check the highlighted fields.", fieldErrors };

  const key = `open:${email}`;
  const ip = await getClientIp();
  if (await isLoginBlocked(key, ip)) return BLOCKED;
  const db = getDb();
  const [order] = await db
    .select({ customerId: orders.customerId, paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.email, email)))
    .limit(1);
  if (!order?.customerId) {
    await recordLoginAttempt(key, ip, false);
    return { ok: false, message: "We couldn't find that order for this email. Check both match your order confirmation." };
  }
  if (order.paymentStatus !== "paid") {
    return { ok: false, message: "This order isn't paid yet. You can open your account as soon as its payment is confirmed." };
  }
  await recordLoginAttempt(key, ip, true);

  const now = new Date();
  await db
    .update(customers)
    .set({ passwordHash: await hashPassword(password), accountCreatedAt: sql`coalesce(${customers.accountCreatedAt}, ${now})`, lastLoginAt: now })
    .where(eq(customers.id, order.customerId));
  // A new password signs out every other browser.
  await revokeCustomerSessions(order.customerId);
  await createCustomerSession(order.customerId);
  redirect("/account?welcome=1");
}

export async function logout() {
  await destroyCustomerSession();
  redirect("/account/login?out=1");
}

export async function redeem(offerId: number): Promise<{ ok: boolean; message: string }> {
  const me = await requireCustomer();
  if (!Number.isInteger(offerId)) return { ok: false, message: "That offer isn't available any more." };
  const result = await redeemOffer(me.id, offerId);
  if (!result.ok) return result;
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
