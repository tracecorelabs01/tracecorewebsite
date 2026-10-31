// Sign in with Discord or Google: the OAuth 2 authorization code flow, run by /api/auth/[provider]/start and
// /callback. The provider only proves who someone is and that they own a verified email; the store keeps its own
// customer sessions (customer.ts). A linked Discord account also lets the bot show the customer their own orders.

import "server-only";
import { eq, sql } from "drizzle-orm";
import { customers, getDb } from "@/db";
import { url } from "@/lib/email";
import { createCustomerSession } from "./customer";

export type Provider = "discord" | "google";

/** Holds the sign-in's state, return path and intent between /start and /callback. */
export const OAUTH_COOKIE = "tcl_oauth";

// OAUTH_TEST_URL only exists so tests can point sign-in at a local stand-in for Discord and Google.
const endpoint = (provider: Provider, live: string, test: string) => (process.env.OAUTH_TEST_URL ? `${process.env.OAUTH_TEST_URL}/${provider}/${test}` : live);

const PROVIDERS = {
  discord: {
    name: "Discord",
    scope: "identify email",
    authorize: () => endpoint("discord", "https://discord.com/oauth2/authorize", "authorize"),
    token: () => endpoint("discord", "https://discord.com/api/oauth2/token", "token"),
    profile: () => endpoint("discord", "https://discord.com/api/users/@me", "me"),
    // Skips Discord's consent screen for someone who has already allowed it.
    extra: { prompt: "none" },
  },
  google: {
    name: "Google",
    scope: "openid email profile",
    authorize: () => endpoint("google", "https://accounts.google.com/o/oauth2/v2/auth", "authorize"),
    token: () => endpoint("google", "https://oauth2.googleapis.com/token", "token"),
    profile: () => endpoint("google", "https://openidconnect.googleapis.com/v1/userinfo", "me"),
    extra: { prompt: "select_account" },
  },
} as const;

const credentials = (p: Provider) => {
  const prefix = p.toUpperCase();
  return { id: process.env[`${prefix}_CLIENT_ID`] ?? "", secret: process.env[`${prefix}_CLIENT_SECRET`] ?? "" };
};

export const providerName = (p: Provider) => PROVIDERS[p].name;
export const isProvider = (p: string): p is Provider => p === "discord" || p === "google";
/** Shown only once its client ID and secret are set (Hostinger environment variables). */
export const oauthEnabled = (p: Provider) => Boolean(credentials(p).id && credentials(p).secret);
export const enabledProviders = (): Provider[] => (["google", "discord"] as const).filter(oauthEnabled);

const redirectUri = (p: Provider) => url(`/api/auth/${p}/callback`);

/** Where to go after signing in: checkout, an account page or a partner page, nowhere else. */
export function afterSignIn(next: unknown) {
  const path = String(next ?? "");
  return path === "/checkout" || /^\/(account|partners)(\/[\w-]*)*$/.test(path) ? path : "/account";
}

export function authorizeUrl(p: Provider, state: string) {
  const c = PROVIDERS[p];
  const q = new URLSearchParams({ client_id: credentials(p).id, redirect_uri: redirectUri(p), response_type: "code", scope: c.scope, state, ...c.extra });
  return `${c.authorize()}?${q}`;
}

export interface OAuthProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Discord only: shown on the account page. */
  username: string | null;
}

/** Trades the code from the callback for the person's profile. Only a verified email is accepted. */
export async function fetchProfile(p: Provider, code: string): Promise<{ ok: true; profile: OAuthProfile } | { ok: false; reason: "failed" | "unverified" }> {
  const c = PROVIDERS[p];
  try {
    const tokenRes = await fetch(c.token(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: credentials(p).id, client_secret: credentials(p).secret, grant_type: "authorization_code", code, redirect_uri: redirectUri(p) }),
      cache: "no-store",
    });
    if (!tokenRes.ok) return { ok: false, reason: "failed" };
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    const meRes = await fetch(c.profile(), { headers: { Authorization: `Bearer ${access_token}` }, cache: "no-store" });
    if (!access_token || !meRes.ok) return { ok: false, reason: "failed" };
    const me = (await meRes.json()) as Record<string, unknown>;
    const email = typeof me.email === "string" ? me.email.trim().toLowerCase() : "";
    if (p === "discord") {
      if (!me.id || !email || me.verified !== true) return { ok: false, reason: me.id ? "unverified" : "failed" };
      // Discord display names aren't real names, so checkout still asks for those.
      return { ok: true, profile: { id: String(me.id), email, firstName: "", lastName: "", username: typeof me.username === "string" ? me.username : null } };
    }
    if (!me.sub || !email || me.email_verified !== true) return { ok: false, reason: me.sub ? "unverified" : "failed" };
    return { ok: true, profile: { id: String(me.sub), email, firstName: String(me.given_name ?? ""), lastName: String(me.family_name ?? ""), username: null } };
  } catch (err) {
    console.error(`[oauth] ${p} sign-in failed`, err);
    return { ok: false, reason: "failed" };
  }
}

const linkColumns = (p: Provider, profile: OAuthProfile) =>
  p === "discord" ? { discordId: profile.id, discordUsername: profile.username } : { googleId: profile.id };

/**
 * Signs someone in with a provider profile: the customer it's linked to, else the customer with that verified
 * email (linked now), else a new customer. Choosing to sign in this way opens their account.
 */
export async function signInWithProfile(p: Provider, profile: OAuthProfile) {
  const db = getDb();
  const column = p === "discord" ? customers.discordId : customers.googleId;
  const find = async () => {
    const [linked] = await db.select({ id: customers.id, linkedId: column }).from(customers).where(eq(column, profile.id)).limit(1);
    if (linked) return linked;
    const [byEmail] = await db.select({ id: customers.id, linkedId: column }).from(customers).where(eq(customers.email, profile.email)).limit(1);
    return byEmail;
  };
  let customer = await find();
  if (!customer) {
    try {
      await db.insert(customers).values({ email: profile.email, firstName: profile.firstName, lastName: profile.lastName, ...linkColumns(p, profile), accountCreatedAt: new Date() });
    } catch {
      // Someone signed up with the same email at the same moment; use theirs.
    }
    customer = await find();
    if (!customer) throw new Error("Couldn't create the customer");
  }
  await db
    .update(customers)
    .set({
      // An email account already linked to a different Discord or Google account keeps that link.
      ...(customer.linkedId && customer.linkedId !== profile.id ? {} : linkColumns(p, profile)),
      accountCreatedAt: sql`coalesce(${customers.accountCreatedAt}, ${new Date()})`,
      lastLoginAt: new Date(),
    })
    .where(eq(customers.id, customer.id));
  await createCustomerSession(customer.id);
}

/** Links a provider account to a signed-in customer. False if it's already linked to someone else. */
export async function linkProfile(p: Provider, profile: OAuthProfile, customerId: number) {
  const db = getDb();
  const column = p === "discord" ? customers.discordId : customers.googleId;
  const [owner] = await db.select({ id: customers.id }).from(customers).where(eq(column, profile.id)).limit(1);
  if (owner && owner.id !== customerId) return false;
  await db.update(customers).set(linkColumns(p, profile)).where(eq(customers.id, customerId));
  return true;
}
