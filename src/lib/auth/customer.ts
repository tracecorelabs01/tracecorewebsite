import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { customerSessions, customers, getDb, isDbConfigured, loginCodes } from "@/db";
import { cookieIsSecure, hashToken } from "./session";

// Customer accounts on the storefront. Separate cookie and table from the admin console's sessions.
// No passwords: customers sign in with a 6-digit code emailed to them.

export const CUSTOMER_COOKIE = "tcl_account";
const SESSION_TTL_DAYS = 30;
const CODE_TTL_MINUTES = 10;

export interface Customer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export async function createCustomerSession(customerId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const db = getDb();
  await db.insert(customerSessions).values({ id: hashToken(token), customerId, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(customerSessions).where(lt(customerSessions.expiresAt, sql`UTC_TIMESTAMP()`));
  (await cookies()).set(CUSTOMER_COOKIE, token, { httpOnly: true, secure: await cookieIsSecure(), sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroyCustomerSession() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token && isDbConfigured()) await getDb().delete(customerSessions).where(eq(customerSessions.id, hashToken(token)));
  jar.delete(CUSTOMER_COOKIE);
}

/** Sign out everywhere. */
export async function revokeCustomerSessions(customerId: number) {
  await getDb().delete(customerSessions).where(eq(customerSessions.customerId, customerId));
}

/** The signed-in customer for this request, or null. Deduped per request. */
export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  if (!isDbConfigured()) return null;
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName })
    .from(customerSessions)
    .innerJoin(customers, eq(customerSessions.customerId, customers.id))
    .where(and(eq(customerSessions.id, hashToken(token)), gt(customerSessions.expiresAt, sql`UTC_TIMESTAMP()`), isNotNull(customers.accountCreatedAt)))
    .limit(1);
  return row ?? null;
});

/** Use at the top of every account page and action. */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");
  return customer;
}

/** Only send people back to account pages after signing in. */
export function accountPath(next: unknown) {
  const path = String(next ?? "");
  return /^\/account(\/[\w-]*)*$/.test(path) ? path : "/account";
}

/** A new sign-in code for this customer. It replaces any earlier one, works once, for 10 minutes. */
export async function createLoginCode(customerId: number) {
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  const row = { codeHash: hashToken(code), expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) };
  await getDb()
    .insert(loginCodes)
    .values({ customerId, ...row })
    .onDuplicateKeyUpdate({ set: { ...row, createdAt: sql`CURRENT_TIMESTAMP` } });
  return code;
}

/** Uses up the customer's code if it matches and hasn't expired. Deleting it is what makes it single use. */
export async function consumeLoginCode(customerId: number, code: string) {
  const [res] = await getDb()
    .delete(loginCodes)
    .where(and(eq(loginCodes.customerId, customerId), eq(loginCodes.codeHash, hashToken(code)), gt(loginCodes.expiresAt, sql`UTC_TIMESTAMP()`)));
  return res.affectedRows === 1;
}
