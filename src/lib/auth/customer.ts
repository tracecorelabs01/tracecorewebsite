import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { customerSessions, customers, getDb, isDbConfigured } from "@/db";
import { cookieIsSecure, hashToken } from "./session";

// Customer accounts on the storefront. Separate cookie and table from the admin console's sessions.

export const CUSTOMER_COOKIE = "tcl_account";
const SESSION_TTL_DAYS = 30;

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

/** Sign out everywhere (after a password reset). */
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
    .where(and(eq(customerSessions.id, hashToken(token)), gt(customerSessions.expiresAt, sql`UTC_TIMESTAMP()`), isNotNull(customers.passwordHash)))
    .limit(1);
  return row ?? null;
});

/** Use at the top of every account page and action. */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");
  return customer;
}
