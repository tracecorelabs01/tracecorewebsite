"use server";

import { revalidateTag } from "next/cache";
import { and, count, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { categories, customers, discountCodes, getDb, isDbConfigured, messages, orderEvents, orderItems, orders, products, subscribers } from "@/db";
import { addressSchema, rememberAddress } from "@/lib/address";
import { currentPartner, getProgram, partnerByCode, partnerPriceMap, partnerTerms, rememberPartner, type Partner } from "@/lib/affiliates";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { getCatalog, getSetupBuilder, getStoreSettings, TAGS } from "@/lib/catalog/server";
import { MAX_QTY } from "@/lib/catalog/types";
import { isCompleteSetup, setupDiscountCode } from "@/lib/setup-builder";
import { sendContactAlert, sendNewsletterWelcome } from "@/lib/emails/account";
import { emailOrder } from "@/lib/emails/orders";
import { listNames, withProductNames } from "@/lib/loyalty";
import { isRazorpayConfigured, PAID_NOTE } from "@/lib/razorpay";
import { getClientIp } from "@/lib/request";

/* ───────────── shared ───────────── */

const lineSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  option: z.string().trim().max(80).optional(),
  qty: z.number().int().min(1).max(MAX_QTY),
});

type CartInput = z.infer<typeof lineSchema>[];

interface PricedLine {
  productId: number | null;
  slug: string;
  name: string;
  option?: string;
  qty: number;
  unitCents: number;
  lineTotalCents: number;
  /** Decrement with a guard (tracked, no backorder) / without guard (backorder) / not at all. */
  stock: "guarded" | "backorder" | "untracked";
}

interface CartIssue {
  slug: string;
  message: string;
  maxQty?: number;
}

interface Discount {
  id: number | null;
  code: string;
  cents: number;
}

type Priced = { ok: true; lines: PricedLine[]; subtotalCents: number; shippingCents: number; discount: Discount | null; totalCents: number } | { ok: false; error: string; cartIssues?: CartIssue[] };

const now = () => new Date();

function discountError(row: typeof discountCodes.$inferSelect | undefined, subtotalCents: number) {
  if (!row || !row.isActive) return "That code isn't valid.";
  const t = now();
  // Same answer as an unknown code, so scheduled promos can't be discovered early.
  if (row.startsAt && row.startsAt > t) return "That code isn't valid.";
  if (row.endsAt && row.endsAt <= t) return "That code has expired.";
  if (row.maxUses != null && row.usedCount >= row.maxUses) return "That code has been fully redeemed.";
  if (subtotalCents < row.minSubtotalCents) return `That code needs a subtotal of at least $${(row.minSubtotalCents / 100).toFixed(2)}.`;
  return null;
}

/** Re-prices the cart from the database (client prices are never trusted), at the referring partner's prices if any. */
async function priceCart(lines: CartInput, code?: string, partner?: Partner | null): Promise<Priced> {
  const settings = await getStoreSettings();

  if (!isDbConfigured()) {
    // Demo mode: price from the static catalogue so the flow still works.
    const { products: catalog } = await getCatalog();
    const priced: PricedLine[] = [];
    for (const l of lines) {
      const p = catalog.find((c) => c.slug === l.slug);
      if (!p) return { ok: false, error: "Some items are no longer available.", cartIssues: [{ slug: l.slug, message: "No longer available" }] };
      const unitCents = Math.round(p.price * 100);
      priced.push({ productId: null, slug: p.slug, name: p.name, option: l.option, qty: l.qty, unitCents, lineTotalCents: unitCents * l.qty, stock: "untracked" });
    }
    const subtotalCents = priced.reduce((n, l) => n + l.lineTotalCents, 0);
    const shippingCents = subtotalCents >= settings.freeShippingThreshold * 100 ? 0 : Math.round(settings.flatShipping * 100);
    if (code) return { ok: false, error: "Discount codes need a connected database." };
    return { ok: true, lines: priced, subtotalCents, shippingCents, discount: null, totalCents: subtotalCents + shippingCents };
  }

  const db = getDb();
  const slugs = [...new Set(lines.map((l) => l.slug))];
  const rows = await db.select().from(products).where(and(inArray(products.slug, slugs), eq(products.status, "active")));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const terms = partner ? await partnerTerms(partner.id, db) : null;
  const unitPrice = (p: (typeof rows)[number]) => {
    const t = terms?.get(p.id);
    return t?.visible ? t.priceCents : p.priceCents;
  };

  // Combine quantities per product for stock checks (same product, different options).
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.slug, (wanted.get(l.slug) ?? 0) + l.qty);

  const issues: CartIssue[] = [];
  const priced: PricedLine[] = [];
  for (const l of lines) {
    const p = bySlug.get(l.slug);
    if (!p) {
      issues.push({ slug: l.slug, message: "No longer available" });
      continue;
    }
    const values = p.optionValues ?? [];
    if (p.optionName && values.length && (!l.option || !values.includes(l.option))) {
      issues.push({ slug: l.slug, message: `Choose a ${p.optionName.toLowerCase()}` });
      continue;
    }
    if ((wanted.get(l.slug) ?? 0) > MAX_QTY) {
      issues.push({ slug: l.slug, message: `Limit ${MAX_QTY} per order`, maxQty: MAX_QTY });
      continue;
    }
    const guarded = p.trackInventory && !p.allowBackorder;
    if (guarded && (wanted.get(l.slug) ?? 0) > p.stockQty) {
      issues.push({ slug: l.slug, message: p.stockQty > 0 ? `Only ${p.stockQty} left` : "Sold out", maxQty: Math.max(0, p.stockQty) });
      continue;
    }
    priced.push({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      option: p.optionName && values.length ? l.option : undefined,
      qty: l.qty,
      unitCents: unitPrice(p),
      lineTotalCents: unitPrice(p) * l.qty,
      stock: guarded ? "guarded" : p.trackInventory ? "backorder" : "untracked",
    });
  }
  if (issues.length) return { ok: false, error: "Some items in your cart need attention.", cartIssues: issues };

  const subtotalCents = priced.reduce((n, l) => n + l.lineTotalCents, 0);
  let discount: Discount | null = null;
  if (code) {
    const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, code.toUpperCase())).limit(1);
    const err = discountError(row, subtotalCents);
    if (err) return { ok: false, error: err };
    // A code limited to some products only discounts those lines.
    const only = row!.productIds?.length ? new Set(row!.productIds) : null;
    const base = only ? priced.filter((l) => l.productId != null && only.has(l.productId)).reduce((n, l) => n + l.lineTotalCents, 0) : subtotalCents;
    if (only && base === 0) {
      const [{ productNames }] = await withProductNames([row!]);
      return { ok: false, error: productNames.length ? `That code only works on ${listNames(productNames)}. Add it to your cart to use it.` : "That code is for a product that's no longer sold." };
    }
    const cents = row!.kind === "percent" ? Math.round((base * Math.min(100, row!.value)) / 100) : Math.min(row!.value, base);
    discount = { id: row!.id, code: row!.code, cents };
  } else if (settings.setupDiscountPercent > 0) {
    // No code: a complete setup (a product from each category the Setup Builder requires) gets the automatic setup discount.
    const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((id): id is number => id != null))];
    const [cats, builder] = await Promise.all([
      categoryIds.length ? db.select({ slug: categories.slug }).from(categories).where(inArray(categories.id, categoryIds)) : [],
      getSetupBuilder(),
    ]);
    if (isCompleteSetup(cats.map((c) => c.slug), builder.discountCategories)) {
      discount = { id: null, code: setupDiscountCode(settings.setupDiscountPercent), cents: Math.round((subtotalCents * settings.setupDiscountPercent) / 100) };
    }
  }
  const shippingCents = subtotalCents >= settings.freeShippingThreshold * 100 ? 0 : Math.round(settings.flatShipping * 100);
  const totalCents = Math.max(0, subtotalCents - (discount?.cents ?? 0)) + shippingCents;
  return { ok: true, lines: priced, subtotalCents, shippingCents, discount, totalCents };
}

/* ───────────── discount preview ───────────── */

export type CodePreview =
  | { ok: true; code: string; discountCents: number }
  /** A partner's code: their prices from now on, no discount. */
  | { ok: true; partner: { name: string; prices: Record<string, number> } }
  | { ok: false; error: string };

export async function previewDiscount(code: string, lines: CartInput): Promise<CodePreview> {
  const parsedCode = z.string().trim().min(2).max(40).safeParse(code);
  const parsedLines = z.array(lineSchema).min(1).max(50).safeParse(lines);
  if (!parsedCode.success || !parsedLines.success) return { ok: false, error: "Enter a valid code." };
  const me = await getCurrentCustomer();
  const partner = await partnerByCode(parsedCode.data);
  if (partner) {
    if (me && me.email.toLowerCase() === partner.email.toLowerCase()) return { ok: false, error: "That's your own partner code: it doesn't apply to your orders." };
    await rememberPartner(partner.id, "code", (await getProgram()).cookieDays);
    return { ok: true, partner: { name: partner.name, prices: await partnerPriceMap(partner.id) } };
  }
  const priced = await priceCart(parsedLines.data, parsedCode.data, await currentPartner({ buyerEmail: me?.email }));
  if (!priced.ok) return { ok: false, error: priced.error };
  return { ok: true, code: priced.discount!.code, discountCents: priced.discount!.cents };
}

/** The automatic setup discount this cart earns, or null. Checkout shows it whenever no code is applied. */
export async function previewSetupDiscount(lines: CartInput): Promise<{ code: string; cents: number } | null> {
  const parsed = z.array(lineSchema).min(1).max(50).safeParse(lines);
  if (!parsed.success) return null;
  const me = await getCurrentCustomer();
  const priced = await priceCart(parsed.data, undefined, await currentPartner({ buyerEmail: me?.email }));
  return priced.ok && priced.discount ? { code: priced.discount.code, cents: priced.discount.cents } : null;
}

/* ───────────── place order ───────────── */

const orderSchema = addressSchema.extend({
  email: z.email("Enter a valid email").max(191),
  phone: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(["card", "paypal", "crypto"]),
  discountCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(1000).optional(),
  company: z.string().max(0).optional(), // honeypot — must stay empty
  // "Create an account and continue" at checkout. Guests (false) never get an account; they track orders with an email code.
  createAccount: z.boolean().optional(),
  lines: z.array(lineSchema).min(1, "Your cart is empty").max(50),
});

export type PlaceOrderInput = z.input<typeof orderSchema>;

export type PlaceOrderResult =
  | {
      ok: true;
      order: {
        number: string;
        email: string;
        lines: { name: string; option?: string; qty: number; lineTotalCents: number }[];
        subtotalCents: number;
        discountCents: number;
        shippingCents: number;
        totalCents: number;
        note: string;
        demo: boolean;
        /** Card through Razorpay: checkout opens payment next, and `note` is what shows once it's paid. */
        payOnline: boolean;
        /** The email has an account (just created, or already open); otherwise it's a guest order. */
        account: boolean;
      };
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; cartIssues?: CartIssue[] };

class CheckoutError extends Error {}

function orderNumber() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "TCL-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: fieldErrors.lines ?? "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const settings = await getStoreSettings();
  if (data.paymentMethod !== "card" && !settings.manualPayments[data.paymentMethod]) {
    return { ok: false, error: "That payment method isn't available any more. Please choose another." };
  }
  // The partner who referred the buyer (never the buyer themselves): their prices, and the order is theirs.
  const partner = await currentPartner({ buyerEmail: data.email });
  const priced = await priceCart(data.lines, data.discountCode || undefined, partner);
  if (!priced.ok) return { ok: false, error: priced.error, cartIssues: priced.cartIssues };

  const summary = {
    lines: priced.lines.map((l) => ({ name: l.name, option: l.option, qty: l.qty, lineTotalCents: l.lineTotalCents })),
    subtotalCents: priced.subtotalCents,
    discountCents: priced.discount?.cents ?? 0,
    shippingCents: priced.shippingCents,
    totalCents: priced.totalCents,
  };

  if (!isDbConfigured()) {
    return { ok: true, order: { number: orderNumber().replace("TCL", "DEMO"), email: data.email, ...summary, note: settings.orderNote, demo: true, payOnline: false, account: false } };
  }

  const db = getDb();
  const ip = await getClientIp();
  const [recent] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.ip, ip), gt(orders.createdAt, sql`UTC_TIMESTAMP() - INTERVAL 1 HOUR`)));
  if ((recent?.n ?? 0) >= 10) return { ok: false, error: "Too many orders from your network. Please try again later or contact support." };

  const email = data.email.toLowerCase();
  const me = await getCurrentCustomer();
  let number = "";
  let placedId = 0;
  let account = false;
  // The account whose address book keeps this address (0: none).
  let rememberFor = 0;
  try {
    await db.transaction(async (tx) => {
      for (const l of priced.lines) {
        if (l.stock === "guarded") {
          const [res] = await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} - ${l.qty}` })
            .where(and(eq(products.id, l.productId!), gte(products.stockQty, l.qty)));
          if (res.affectedRows === 0) throw new CheckoutError(`${l.name} just sold out. Please update your cart.`);
        } else if (l.stock === "backorder") {
          await tx.update(products).set({ stockQty: sql`${products.stockQty} - ${l.qty}` }).where(eq(products.id, l.productId!));
        }
      }

      if (priced.discount?.id) {
        const [res] = await tx
          .update(discountCodes)
          .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
          .where(and(eq(discountCodes.id, priced.discount.id), or(isNull(discountCodes.maxUses), lt(discountCodes.usedCount, discountCodes.maxUses))));
        if (res.affectedRows === 0) throw new CheckoutError("That discount code was just fully redeemed.");
      }

      const [existing] = await tx
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          country: customers.country,
          accountCreatedAt: customers.accountCreatedAt,
        })
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      let customerId: number;
      const profile = { firstName: data.firstName, lastName: data.lastName, phone: data.phone || null, country: data.country, lastOrderAt: now() };
      // Signing in still needs a code sent to this email, so an account opened here is only usable by its owner.
      const opened = data.createAccount ? { accountCreatedAt: existing?.accountCreatedAt ?? now() } : {};
      account = Boolean(data.createAccount || existing?.accountCreatedAt);
      if (existing) {
        customerId = existing.id;
        // Anyone can check out with any email, so only fill in blanks: never overwrite a customer's details.
        await tx
          .update(customers)
          .set({
            firstName: existing.firstName || profile.firstName,
            lastName: existing.lastName || profile.lastName,
            phone: existing.phone || profile.phone,
            country: existing.country || profile.country,
            lastOrderAt: profile.lastOrderAt,
            ordersCount: sql`${customers.ordersCount} + 1`,
            ...opened,
          })
          .where(eq(customers.id, customerId));
      } else {
        [{ id: customerId }] = await tx.insert(customers).values({ email, ...profile, ordersCount: 1, ...opened }).$returningId();
      }
      // Only the account's own order (signed in) or an account this checkout opens: typing someone else's email at
      // checkout mustn't add addresses to their account.
      if (me?.id === customerId || (data.createAccount && !existing?.accountCreatedAt)) rememberFor = customerId;

      let orderId = 0;
      for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
        number = orderNumber();
        const [dupe] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.number, number)).limit(1);
        if (dupe) continue;
        [{ id: orderId }] = await tx
          .insert(orders)
          .values({
            number,
            customerId,
            paymentMethod: data.paymentMethod,
            email,
            phone: data.phone || null,
            firstName: data.firstName,
            lastName: data.lastName,
            address1: data.address1,
            address2: data.address2 || null,
            city: data.city,
            region: data.region || null,
            postalCode: data.postalCode,
            country: data.country,
            subtotalCents: summary.subtotalCents,
            shippingCents: summary.shippingCents,
            discountCents: summary.discountCents,
            totalCents: summary.totalCents,
            discountCode: priced.discount?.code ?? null,
            customerNote: data.note || null,
            ip,
            affiliateId: partner?.id ?? null,
            affiliateSource: partner?.source ?? null,
          })
          .$returningId();
      }
      if (!orderId) throw new CheckoutError("Couldn't create your order. Please try again.");
      placedId = orderId;

      await tx.insert(orderItems).values(
        priced.lines.map((l) => ({
          orderId,
          productId: l.productId,
          productSlug: l.slug,
          productName: l.name,
          optionValue: l.option ?? null,
          unitPriceCents: l.unitCents,
          quantity: l.qty,
          lineTotalCents: l.lineTotalCents,
        })),
      );
      await tx.insert(orderEvents).values({ orderId, type: "created", message: `Order placed at checkout · ${data.paymentMethod}` });
    });
  } catch (err) {
    if (err instanceof CheckoutError) return { ok: false, error: err.message };
    console.error("[checkout] order failed", err);
    return { ok: false, error: "Something went wrong placing your order. You haven't been charged — please try again." };
  }

  // Stock changed: refresh the storefront catalogue in the background.
  revalidateTag(TAGS.catalog, "max");
  // Kept for next time; the order stands even if this fails.
  if (rememberFor) await rememberAddress(rememberFor, addressSchema.parse(data)).catch((err) => console.error("[checkout] saving the address failed", err));
  // Card orders paid online are confirmed by email once the payment is in (src/lib/razorpay.ts).
  const payOnline = data.paymentMethod === "card" && isRazorpayConfigured();
  if (!payOnline) await emailOrder(placedId, "received", { note: settings.orderNote });

  return { ok: true, order: { number, email, ...summary, note: payOnline ? PAID_NOTE : settings.orderNote, demo: false, payOnline, account } };
}

/* ───────────── newsletter ───────────── */

export type FormState = { ok: boolean; message: string } | null;

export async function subscribe(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("company")) return { ok: true, message: "You're on the list." };
  const parsed = z.email().max(191).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  if (isDbConfigured()) {
    try {
      await getDb().insert(subscribers).values({ email: parsed.data, source: "footer" });
      await sendNewsletterWelcome(parsed.data);
    } catch (err) {
      const dup = (err as { cause?: { code?: string }; code?: string }).cause?.code ?? (err as { code?: string }).code;
      if (dup !== "ER_DUP_ENTRY") {
        console.error("[subscribe]", err);
        return { ok: false, message: "Couldn't subscribe right now. Please try again." };
      }
    }
  }
  return { ok: true, message: "You're on the list. We'll only email for drops and restocks." };
}

/* ───────────── contact form ───────────── */

const messageSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: z.email("Enter a valid email").max(191),
  order: z.string().trim().max(40).optional(),
  topic: z.string().trim().min(1).max(60),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(5000),
});

export async function sendMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("company")) return { ok: true, message: "Message sent." };
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  if (isDbConfigured()) {
    const db = getDb();
    const ip = await getClientIp();
    const [recent] = await db
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.ip, ip), gt(messages.createdAt, sql`UTC_TIMESTAMP() - INTERVAL 1 HOUR`)));
    if ((recent?.n ?? 0) >= 5) return { ok: false, message: "You've sent several messages recently — we'll get back to you soon." };
    const d = parsed.data;
    const [{ id }] = await db.insert(messages).values({ name: d.name, email: d.email.toLowerCase(), orderNumber: d.order || null, topic: d.topic, body: d.message, ip }).$returningId();
    await sendContactAlert({ id, name: d.name, email: d.email.toLowerCase(), topic: d.topic, body: d.message, orderNumber: d.order || null });
  }
  return { ok: true, message: "Message sent." };
}
