import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { customerSessions, customers, getDb, isDbConfigured, loginCodes } from "@/db";
import { cookieIsSecure, hashToken } from "./session";

// Customer accounts on the storefront. Separate cookie and table from the admin console's sessions.
// No passwords: customers sign in with a 6-digit code emailed to them, or with Discord or Google (oauth.ts).
// Guests get no account: on /track they prove their email with the same kind of code and see their orders only.

export const CUSTOMER_COOKIE = "tcl_account";
const TRACK_COOKIE = "tcl_track";
const SCOPES = {
  account: { cookie: CUSTOMER_COOKIE, ttlMs: 30 * 86_400_000 },
  orders: { cookie: TRACK_COOKIE, ttlMs: 2 * 3_600_000 },
} as const;
type Scope = keyof typeof SCOPES;
const CODE_TTL_MINUTES = 10;

export interface Customer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export async function createCustomerSession(customerId: number, scope: Scope = "account") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SCOPES[scope].ttlMs);
  const db = getDb();
  await db.insert(customerSessions).values({ id: hashToken(token), customerId, scope, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(customerSessions).where(lt(customerSessions.expiresAt, sql`UTC_TIMESTAMP()`));
  (await cookies()).set(SCOPES[scope].cookie, token, { httpOnly: true, secure: await cookieIsSecure(), sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroyCustomerSession(scope: Scope = "account") {
  const jar = await cookies();
  const token = jar.get(SCOPES[scope].cookie)?.value;
  if (token && isDbConfigured()) await getDb().delete(customerSessions).where(eq(customerSessions.id, hashToken(token)));
  jar.delete(SCOPES[scope].cookie);
}

/** Who this request's session belongs to, for one scope. */
async function sessionCustomer(scope: Scope) {
  // The cookie is read first, always: that's what makes every page calling this render per request. Checking the
  // database first let a build without DATABASE_URL pre-render the account pages as a redirect to the sign-in page.
  const token = (await cookies()).get(SCOPES[scope].cookie)?.value;
  if (!token || !isDbConfigured()) return null;
  const [row] = await getDb()
    .select({ id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName, accountCreatedAt: customers.accountCreatedAt })
    .from(customerSessions)
    .innerJoin(customers, eq(customerSessions.customerId, customers.id))
    .where(and(eq(customerSessions.id, hashToken(token)), eq(customerSessions.scope, scope), gt(customerSessions.expiresAt, sql`UTC_TIMESTAMP()`)))
    .limit(1);
  return row ?? null;
}

/** A guest looking at their orders on /track after an email code, or null. Deduped per request. */
export const getTrackViewer = cache(async (): Promise<Customer | null> => {
  const row = await sessionCustomer("orders");
  return row && { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName };
});

/** Sign out everywhere. */
export async function revokeCustomerSessions(customerId: number) {
  await getDb().delete(customerSessions).where(eq(customerSessions.customerId, customerId));
}

/** The signed-in customer for this request, or null. Deduped per request. */
export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  const row = await sessionCustomer("account");
  return row?.accountCreatedAt ? { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName } : null;
});

/** Use at the top of every account page and action. */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");
  return customer;
}

/** Only send people back to account or partner pages after signing in. */
export function accountPath(next: unknown) {
  const path = String(next ?? "");
  return /^\/(account|partners)(\/[\w-]*)*$/.test(path) ? path : "/account";
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
