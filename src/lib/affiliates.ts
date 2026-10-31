import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, inArray, isNull, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import {
  affiliateClicks,
  affiliateCommissions,
  affiliateGroups,
  affiliatePayouts,
  affiliateRules,
  affiliates,
  COMMISSION_KINDS,
  customers,
  discountCodes,
  getDb,
  isDbConfigured,
  orderItems,
  orders,
  products,
  settings,
  type CommissionLine,
} from "@/db";
import type { Tx } from "@/lib/admin/order-stock";
import { commissionLabel } from "@/lib/affiliate-labels";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { cookieIsSecure } from "@/lib/auth/session";

// The affiliate program. Partners refer orders with their link (a cookie) or their code at checkout. What a partner
// may promote, the commission they earn and the price their customers pay are set per product at three levels,
// each overriding the one below: the partner, their group, the program. Commissions follow their order the way
// loyalty points do: pending once it's paid, approved a hold period after delivery, paid with a payout, and
// reversed if it's cancelled or refunded first (taken back from the next payout if it was already paid).

export { commissionLabel };

type Db = Tx | ReturnType<typeof getDb>;
export type CommissionKind = (typeof COMMISSION_KINDS)[number];
export type Commission = { kind: CommissionKind; value: number };

/* ───────────── program settings ───────────── */

export const AFFILIATE_SETTINGS_KEY = "affiliate";

export const programSchema = z.object({
  /** Off: referral links and partner codes are ignored and applications are closed. */
  enabled: z.boolean(),
  cookieDays: z.number().int().min(1).max(365),
  /** Days after delivery before a commission can be paid out. */
  holdDays: z.number().int().min(0).max(365),
  minPayoutCents: z.number().int().min(0).max(1_000_000),
  /** For products in the program without their own commission. */
  commissionKind: z.enum(COMMISSION_KINDS),
  commissionValue: z.number().int().min(0).max(1_000_000),
});
export type Program = z.infer<typeof programSchema>;

export const DEFAULT_PROGRAM: Program = { enabled: true, cookieDays: 30, holdDays: 14, minPayoutCents: 5000, commissionKind: "percent", commissionValue: 1000 };

export async function getProgram(db: Db = getDb()): Promise<Program> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, AFFILIATE_SETTINGS_KEY)).limit(1);
  const parsed = programSchema.safeParse({ ...DEFAULT_PROGRAM, ...(row?.value && typeof row.value === "object" ? row.value : {}) });
  return parsed.success ? parsed.data : DEFAULT_PROGRAM;
}


/* ───────────── rules: what a partner sees, earns and sells at ───────────── */

export type Scope = { level: "program" } | { level: "group"; id: number } | { level: "partner"; id: number };
export const scopeKey = (s: Scope) => (s.level === "program" ? "program" : `${s.level}:${s.id}`);

export type Rule = { visible: boolean | null; commissionKind: CommissionKind | null; commissionValue: number | null; priceCents: number | null };
export type Terms = { productId: number; slug: string; name: string; regularCents: number; visible: boolean; commission: Commission; priceCents: number };

/** The product's terms through the given rule layers (most specific first), down to the program defaults. */
export function resolveTerms(product: { id: number; slug: string; name: string; priceCents: number }, layers: (Rule | undefined)[], program: Program): Terms {
  const pick = <K extends keyof Rule>(k: K) => layers.find((r) => r?.[k] != null)?.[k] ?? null;
  const ruleWithCommission = layers.find((r) => r?.commissionKind != null && r.commissionValue != null);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    regularCents: product.priceCents,
    visible: pick("visible") ?? false,
    commission: ruleWithCommission ? { kind: ruleWithCommission.commissionKind!, value: ruleWithCommission.commissionValue! } : { kind: program.commissionKind, value: program.commissionValue },
    priceCents: pick("priceCents") ?? product.priceCents,
  };
}

export async function defaultGroupId(db: Db = getDb()) {
  const [g] = await db.select({ id: affiliateGroups.id }).from(affiliateGroups).where(eq(affiliateGroups.isDefault, true)).limit(1);
  return g?.id ?? null;
}

/** The rule layers for a scope: its own, then those it inherits from. */
async function layerScopes(scope: Scope, db: Db) {
  if (scope.level === "program") return ["program"];
  if (scope.level === "group") return [`group:${scope.id}`, "program"];
  const [a] = await db.select({ groupId: affiliates.groupId }).from(affiliates).where(eq(affiliates.id, scope.id)).limit(1);
  const groupId = a?.groupId ?? (await defaultGroupId(db));
  return [`partner:${scope.id}`, ...(groupId ? [`group:${groupId}`] : []), "program"];
}

/** Every active product with its own rule at this scope and the terms it would get without it. For the admin. */
export async function rulesFor(scope: Scope, db: Db = getDb()) {
  const keys = await layerScopes(scope, db);
  const [program, rows, rules] = await Promise.all([
    getProgram(db),
    db.select({ id: products.id, slug: products.slug, name: products.name, priceCents: products.priceCents }).from(products).where(eq(products.status, "active")).orderBy(products.sortOrder, products.name),
    db.select().from(affiliateRules).where(inArray(affiliateRules.scope, keys)),
  ]);
  const by = (key: string) => new Map(rules.filter((r) => r.scope === key).map((r) => [r.productId, r]));
  const [own, ...inherited] = keys.map(by);
  return rows.map((p) => ({ product: p, rule: own.get(p.id) ?? null, inherited: resolveTerms(p, inherited.map((m) => m.get(p.id)), program) }));
}

/** A partner's terms for every active product (including ones they can't promote: visible false). */
export async function partnerTerms(affiliateId: number, db: Db = getDb()) {
  const keys = await layerScopes({ level: "partner", id: affiliateId }, db);
  const [program, rows, rules] = await Promise.all([
    getProgram(db),
    db.select({ id: products.id, slug: products.slug, name: products.name, priceCents: products.priceCents }).from(products).where(eq(products.status, "active")),
    db.select().from(affiliateRules).where(inArray(affiliateRules.scope, keys)),
  ]);
  const layers = keys.map((key) => new Map(rules.filter((r) => r.scope === key).map((r) => [r.productId, r])));
  return new Map(rows.map((p) => [p.id, resolveTerms(p, layers.map((m) => m.get(p.id)), program)]));
}

/* ───────────── referrals ───────────── */

/** "<partner id>.<l|c>": who referred this visitor, by link or by code. httpOnly. */
export const REF_COOKIE = "tcl_ref";
/** Readable by the page: there are partner prices to show. */
export const PARTNER_FLAG_COOKIE = "tcl_partner";

export type Partner = { id: number; name: string; code: string; customerId: number; email: string; source: "link" | "code" };

async function approvedPartner(where: ReturnType<typeof eq>, db: Db) {
  const [a] = await db
    .select({ id: affiliates.id, name: affiliates.name, code: affiliates.code, customerId: affiliates.customerId, email: customers.email })
    .from(affiliates)
    .innerJoin(customers, eq(affiliates.customerId, customers.id))
    .where(and(where, eq(affiliates.status, "approved")))
    .limit(1);
  return a;
}

export const normaliseCode = (code: string) => code.trim().toUpperCase();

/** An approved partner by their code, if the program is on. */
export async function partnerByCode(code: string, db: Db = getDb()) {
  if (!isDbConfigured() || !(await getProgram(db)).enabled) return null;
  return (await approvedPartner(eq(affiliates.code, normaliseCode(code)), db)) ?? null;
}

/**
 * Who referred this request: a partner code typed at checkout wins over the referral cookie. Never the buyer
 * themselves (`buyerEmail`), so partners don't get their own prices or earn on their own orders.
 */
export async function currentPartner(opts: { code?: string; buyerEmail?: string } = {}): Promise<Partner | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  if (!(await getProgram(db)).enabled) return null;
  let found: Omit<Partner, "source"> | undefined;
  let source: Partner["source"] = "link";
  if (opts.code) {
    found = await approvedPartner(eq(affiliates.code, normaliseCode(opts.code)), db);
    source = "code";
  }
  if (!found) {
    const [id, how] = ((await cookies()).get(REF_COOKIE)?.value ?? "").split(".");
    if (Number(id) > 0) {
      found = await approvedPartner(eq(affiliates.id, Number(id)), db);
      source = how === "c" ? "code" : "link";
    }
  }
  if (!found || (opts.buyerEmail && found.email.toLowerCase() === opts.buyerEmail.toLowerCase())) return null;
  return { ...found, source };
}

/** Remembers the partner for the cookie window (the last one wins). */
export async function rememberPartner(partnerId: number, source: Partner["source"], cookieDays: number) {
  const jar = await cookies();
  const opts = { sameSite: "lax" as const, secure: await cookieIsSecure(), path: "/", maxAge: cookieDays * 86_400 };
  jar.set(REF_COOKIE, `${partnerId}.${source === "code" ? "c" : "l"}`, { ...opts, httpOnly: true });
  jar.set(PARTNER_FLAG_COOKIE, "1", opts);
}

export async function recordClick(partnerId: number) {
  const day = new Date().toISOString().slice(0, 10);
  await getDb()
    .insert(affiliateClicks)
    .values({ affiliateId: partnerId, day, clicks: 1 })
    .onDuplicateKeyUpdate({ set: { clicks: sql`${affiliateClicks.clicks} + 1` } });
}

/** Partner prices for products the partner promotes that differ from the regular price, by slug, in dollars. */
export async function partnerPriceMap(partnerId: number) {
  const prices: Record<string, number> = {};
  for (const t of (await partnerTerms(partnerId)).values()) if (t.visible && t.priceCents !== t.regularCents) prices[t.slug] = t.priceCents / 100;
  return prices;
}

/* ───────────── commissions ───────────── */

/** Each line's commission on its price after its share of the order discount. Fixed amounts never exceed that. */
export function commissionLines(items: { productId: number | null; name: string; qty: number; lineCents: number }[], subtotalCents: number, discountCents: number, terms: Map<number, Terms>): CommissionLine[] {
  return items.flatMap((i) => {
    const t = i.productId != null ? terms.get(i.productId) : undefined;
    if (!t?.visible) return [];
    const baseCents = Math.max(0, i.lineCents - (subtotalCents > 0 ? Math.round((discountCents * i.lineCents) / subtotalCents) : 0));
    const cents = t.commission.kind === "percent" ? Math.round((baseCents * t.commission.value) / 10_000) : Math.min(t.commission.value * i.qty, baseCents);
    return cents > 0 ? [{ productId: i.productId, name: i.name, qty: i.qty, baseCents, kind: t.commission.kind, value: t.commission.value, cents }] : [];
  });
}

/**
 * Makes an order's commission match its state, inside the transaction that changed it (like syncOrderPoints):
 * earned at the partner's terms when it's paid, reversed if it's then cancelled or refunded, and taken back from
 * the next payout if it had already been paid out.
 */
export async function syncOrderCommission(tx: Tx, orderId: number) {
  const [o] = await tx
    .select({ number: orders.number, affiliateId: orders.affiliateId, status: orders.status, paymentStatus: orders.paymentStatus, subtotalCents: orders.subtotalCents, discountCents: orders.discountCents })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o?.affiliateId) return;
  const [row] = await tx.select().from(affiliateCommissions).where(eq(affiliateCommissions.orderId, orderId)).limit(1);
  const earning = o.paymentStatus === "paid" && o.status !== "cancelled" && o.status !== "refunded";

  if (earning) {
    if (row?.status === "reversed") await tx.update(affiliateCommissions).set({ status: "pending" }).where(eq(affiliateCommissions.id, row.id));
    if (row) return;
    const items = await tx
      .select({ productId: orderItems.productId, name: orderItems.productName, qty: orderItems.quantity, lineCents: orderItems.lineTotalCents })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    const lines = commissionLines(items, o.subtotalCents, o.discountCents, await partnerTerms(o.affiliateId, tx));
    const amountCents = lines.reduce((n, l) => n + l.cents, 0);
    if (amountCents > 0) await tx.insert(affiliateCommissions).values({ affiliateId: o.affiliateId, orderId, amountCents, lines, note: `Order ${o.number}` });
    return;
  }
  if (!row || row.status === "reversed") return;
  if (row.status === "pending" || (row.status === "approved" && !row.payoutId)) {
    await tx.update(affiliateCommissions).set({ status: "reversed" }).where(eq(affiliateCommissions.id, row.id));
  } else if (!row.clawedBackAt) {
    // Already paid out, or in a payout being paid: take it back from the next one.
    await tx.insert(affiliateCommissions).values({ affiliateId: row.affiliateId, kind: "adjustment", amountCents: -row.amountCents, status: "approved", approvedAt: new Date(), note: `Order ${o.number} ${o.status === "cancelled" ? "cancelled" : "refunded"} after payout` });
    await tx.update(affiliateCommissions).set({ clawedBackAt: new Date() }).where(eq(affiliateCommissions.id, row.id));
  }
}

/** Approves pending order commissions once their order has been delivered (or shipped) for the hold period. */
export async function approveDueCommissions() {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const { holdDays } = await getProgram(db);
  const [res] = await db.execute(sql`
    UPDATE ${affiliateCommissions} c JOIN ${orders} o ON o.id = c.order_id
    SET c.status = 'approved', c.approved_at = UTC_TIMESTAMP()
    WHERE c.status = 'pending' AND c.kind = 'order' AND o.payment_status = 'paid'
      AND COALESCE(o.delivered_at, o.shipped_at) IS NOT NULL
      AND COALESCE(o.delivered_at, o.shipped_at) <= UTC_TIMESTAMP() - INTERVAL ${holdDays} DAY`);
  return (res as unknown as { affectedRows?: number }).affectedRows ?? 0;
}

/** Totals by state. `availableCents` can be paid out now; `requestedCents` is in a PayPal payout being paid. */
export async function partnerBalance(affiliateId: number, db: Db = getDb()) {
  const rows = await db
    .select({ status: affiliateCommissions.status, inPayout: sql<number>`${affiliateCommissions.payoutId} IS NOT NULL`, n: sum(affiliateCommissions.amountCents) })
    .from(affiliateCommissions)
    .where(eq(affiliateCommissions.affiliateId, affiliateId))
    .groupBy(affiliateCommissions.status, sql`${affiliateCommissions.payoutId} IS NOT NULL`);
  const total = (status: string, inPayout?: boolean) => rows.filter((r) => r.status === status && (inPayout === undefined || Boolean(Number(r.inPayout)) === inPayout)).reduce((n, r) => n + Number(r.n ?? 0), 0);
  return { pendingCents: total("pending"), availableCents: total("approved", false), requestedCents: total("approved", true), paidCents: total("paid") };
}

function creditCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "AFF-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type PayoutResult = { ok: true; amountCents: number; code?: string } | { ok: false; message: string };

/**
 * Pays out the partner's whole available balance. PayPal: a request the team pays and marks paid (needs the
 * minimum). Store credit: straight away, as a single-use code worth the balance on an order of at least that much.
 */
export async function requestPayout(affiliateId: number, method: "paypal" | "store_credit"): Promise<PayoutResult> {
  const db = getDb();
  const program = await getProgram(db);
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(affiliates).where(eq(affiliates.id, affiliateId)).for("update").limit(1);
    if (!a || a.status !== "approved") return { ok: false, message: "Your partner account isn't active." };
    const rows = await tx
      .select({ id: affiliateCommissions.id, amountCents: affiliateCommissions.amountCents })
      .from(affiliateCommissions)
      .where(and(eq(affiliateCommissions.affiliateId, affiliateId), eq(affiliateCommissions.status, "approved"), isNull(affiliateCommissions.payoutId)))
      .for("update");
    const amountCents = rows.reduce((n, r) => n + r.amountCents, 0);
    if (amountCents <= 0) return { ok: false, message: "You have no approved earnings to pay out yet." };
    if (method === "paypal") {
      if (!a.paypalEmail) return { ok: false, message: "Add your PayPal email first." };
      if (amountCents < program.minPayoutCents) return { ok: false, message: `PayPal payouts start at $${(program.minPayoutCents / 100).toFixed(2)}. Take it as store credit, or wait until you've earned more.` };
    }
    const code = method === "store_credit" ? creditCode() : undefined;
    const [{ id: payoutId }] = await tx
      .insert(affiliatePayouts)
      .values({ affiliateId, method, amountCents, status: code ? "paid" : "requested", paypalEmail: code ? null : a.paypalEmail, reference: code ?? null, paidAt: code ? new Date() : null })
      .$returningId();
    await tx
      .update(affiliateCommissions)
      .set({ payoutId, ...(code ? { status: "paid" as const } : {}) })
      .where(inArray(affiliateCommissions.id, rows.map((r) => r.id)));
    if (code) await tx.insert(discountCodes).values({ code, kind: "fixed", value: amountCents, minSubtotalCents: amountCents, maxUses: 1, customerId: a.customerId });
    return { ok: true, amountCents, code };
  });
}

/** The team paid a PayPal payout: it and its commissions are paid. */
export async function markPayoutPaid(payoutId: number, reference: string, adminId: number) {
  return getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(affiliatePayouts).where(eq(affiliatePayouts.id, payoutId)).for("update").limit(1);
    if (!p || p.status !== "requested") return null;
    await tx.update(affiliatePayouts).set({ status: "paid", reference, paidAt: new Date(), processedBy: adminId }).where(eq(affiliatePayouts.id, payoutId));
    await tx.update(affiliateCommissions).set({ status: "paid" }).where(eq(affiliateCommissions.payoutId, payoutId));
    return p;
  });
}

/** The team won't pay a payout request: its commissions go back to the available balance. */
export async function rejectPayout(payoutId: number, note: string, adminId: number) {
  return getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(affiliatePayouts).where(eq(affiliatePayouts.id, payoutId)).for("update").limit(1);
    if (!p || p.status !== "requested") return null;
    await tx.update(affiliatePayouts).set({ status: "rejected", note, processedBy: adminId }).where(eq(affiliatePayouts.id, payoutId));
    await tx.update(affiliateCommissions).set({ payoutId: null }).where(eq(affiliateCommissions.payoutId, payoutId));
    return p;
  });
}

/* ───────────── stats ───────────── */

/** Clicks, referred paid orders and earnings over the last `days`. */
export async function partnerStats(affiliateId: number, days = 30, db: Db = getDb()) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [[clicks], [ordersRow], [earned]] = await Promise.all([
    db.select({ n: sum(affiliateClicks.clicks) }).from(affiliateClicks).where(and(eq(affiliateClicks.affiliateId, affiliateId), gte(affiliateClicks.day, since.toISOString().slice(0, 10)))),
    db.select({ n: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.affiliateId, affiliateId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since))),
    db
      .select({ n: sum(affiliateCommissions.amountCents) })
      .from(affiliateCommissions)
      .where(and(eq(affiliateCommissions.affiliateId, affiliateId), eq(affiliateCommissions.kind, "order"), or(eq(affiliateCommissions.status, "pending"), eq(affiliateCommissions.status, "approved"), eq(affiliateCommissions.status, "paid")), gte(affiliateCommissions.createdAt, since))),
  ]);
  const c = Number(clicks?.n ?? 0);
  const o = Number(ordersRow?.n ?? 0);
  return { clicks: c, orders: o, conversion: c > 0 ? o / c : 0, earnedCents: Number(earned?.n ?? 0) };
}

/** A partner's commissions with their order, newest first. No customer details. */
export function partnerCommissions(affiliateId: number, limit = 100, db: Db = getDb()) {
  return db
    .select({
      id: affiliateCommissions.id,
      kind: affiliateCommissions.kind,
      amountCents: affiliateCommissions.amountCents,
      status: affiliateCommissions.status,
      lines: affiliateCommissions.lines,
      note: affiliateCommissions.note,
      payoutId: affiliateCommissions.payoutId,
      createdAt: affiliateCommissions.createdAt,
      approvedAt: affiliateCommissions.approvedAt,
      orderNumber: orders.number,
      orderStatus: orders.status,
      source: orders.affiliateSource,
    })
    .from(affiliateCommissions)
    .leftJoin(orders, eq(affiliateCommissions.orderId, orders.id))
    .where(eq(affiliateCommissions.affiliateId, affiliateId))
    .orderBy(desc(affiliateCommissions.createdAt), desc(affiliateCommissions.id))
    .limit(limit);
}

export function partnerPayouts(affiliateId: number, db: Db = getDb()) {
  return db.select().from(affiliatePayouts).where(eq(affiliatePayouts.affiliateId, affiliateId)).orderBy(desc(affiliatePayouts.createdAt), desc(affiliatePayouts.id));
}

/* ───────────── partner accounts ───────────── */

/** For the partner portal pages: the signed-in, approved partner (anyone else is sent to sign in, or to /partners). */
export async function requirePartner(path: string) {
  const me = await getCurrentCustomer();
  if (!me) redirect(`/account/login?${new URLSearchParams({ next: path })}`);
  const partner = await partnerForCustomer(me.id);
  if (partner?.status !== "approved") redirect("/partners");
  return { me, partner };
}

/** The signed-in customer's partner profile, if they have one. */
export async function partnerForCustomer(customerId: number) {
  const [a] = await getDb().select().from(affiliates).where(eq(affiliates.customerId, customerId)).limit(1);
  return a ?? null;
}

/** A code from the partner's name, unused by any partner or discount code. */
export async function freeCode(name: string, db: Db = getDb()) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "PARTNER";
  for (let n = 0; n < 50; n++) {
    const code = n === 0 && base.length >= 3 ? base : `${base.slice(0, 10)}${Math.floor(10 + Math.random() * 990)}`;
    if (!(await codeTaken(code, null, db))) return code;
  }
  return `P${Date.now().toString(36).toUpperCase()}`;
}

/** Partner codes share the checkout code box with discount codes, so they must never clash. */
export async function codeTaken(code: string, exceptAffiliateId: number | null, db: Db = getDb()) {
  const [[a], [d]] = await Promise.all([
    db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.code, code)).limit(1),
    db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code)).limit(1),
  ]);
  return Boolean(d || (a && a.id !== exceptAffiliateId));
}
