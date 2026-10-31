import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, settings } from "@/db";
import { TAGS } from "@/lib/catalog/server";

// The store's policies (/legal/[slug]), edited in the admin under Legal pages. Each is a plain-text document saved
// in `settings` as legal:<slug>; until it's saved, the draft below is shown. Payment providers (Razorpay) ask for
// terms, a refund and cancellation policy, a privacy policy and a shipping policy before approving a site.
//
// Format: "## " starts a section, "- " a bullet, a blank line a new paragraph, **bold**, [text](https://link).
// {{supportEmail}}, {{freeShippingThreshold}} and {{flatShipping}} are filled in from Settings.

export const LEGAL_DOCS = {
  terms: "Terms of service",
  refunds: "Refund & cancellation policy",
  shipping: "Shipping & delivery policy",
  privacy: "Privacy policy",
} as const;
export type LegalSlug = keyof typeof LEGAL_DOCS;
export const isLegalSlug = (s: string): s is LegalSlug => Object.hasOwn(LEGAL_DOCS, s);
export const legalKey = (slug: LegalSlug) => `legal:${slug}`;

/** Bracketed text the owner must replace, e.g. "[Registered business name]" (links like [text](url) don't count). */
export const placeholdersIn = (body: string) => [...new Set(body.match(/\[[A-Z][^\]\n]*\](?!\()/g) ?? [])];

const CONTACT = `## Contact

Questions about this policy? Email {{supportEmail}}, use the form on our [support page](/support), or open a ticket in our Discord server. Please include your order number if it's about an order.`;

export const LEGAL_DRAFTS: Record<LegalSlug, string> = {
  terms: `## About us

TraceCoreLab ("we", "us") runs the online store at tracecorelab.com. The store is operated by [Registered business name], [Registered business address]. By placing an order or using this site, you agree to these terms.

## Products

We sell PCIe DMA cards, input devices, accessories and related hardware. Every unit is tested in our lab before it ships. We describe products as accurately as we can; small differences from the photos (colour, labels, packaging) can happen and don't affect how the product works.

## Acceptable use

You're responsible for using our products lawfully and in line with the terms of any software, game or service you use them with. We don't support using our products to break those terms, to access systems without permission, or to harm others, and we may refuse or cancel an order we believe is meant for that.

## Prices and payment

- Prices are shown in US dollars. Import duties, taxes and customs fees in your country aren't included and are paid by you.
- Card payments are processed securely by Razorpay. We never see or store your card number.
- An order is confirmed once it's paid. Unpaid orders are released after the reservation time shown at checkout.
- If a product is listed at a clearly wrong price, or turns out to be out of stock, we'll contact you and may cancel the order with a full refund.

## Orders and cancellations

You can cancel an order for a full refund until it ships: contact us with your order number. Once it has shipped, our refund policy applies.

## Shipping

How and when we ship is explained in our [shipping policy](/legal/shipping).

## Warranty

Our hardware has a 12-month warranty against manufacturing defects (24 months on the TraceCore 100T Pro), starting from delivery. If a product fails because of a defect, we'll repair or replace it. The warranty doesn't cover damage from accidents, liquid, misuse or physical modification. See our [refund policy](/legal/refunds) for how to make a claim.

## Accounts

You can sign in with a code we email you, or with Discord or Google. Keep access to that email or account secure: anyone who can read it can sign in. We may suspend accounts used for fraud or abuse.

## Limitation of liability

As far as the law allows, our total liability for any order is limited to the amount you paid for it. We aren't liable for indirect or consequential losses, including lost data, lost profits, or the suspension of accounts on third-party services. Nothing in these terms limits rights you have under consumer law that can't be excluded.

## Changes to these terms

We may update these terms from time to time. The version on this page when you place an order applies to that order.

## Governing law

These terms are governed by the laws of [Country and state whose laws apply], and disputes go to its courts.

${CONTACT}`,

  refunds: `## Cancelling an order

You can cancel any order before it ships and get a full refund. Contact us with your order number as soon as possible. Once an order has shipped it can't be cancelled, but it may be returned as described below.

## Returns

Unopened, unused items in their original packaging can be returned within 14 days of delivery.

- Contact us first with your order number and we'll send you return instructions. Parcels sent without asking us may not be accepted.
- You pay for return shipping, unless the item is faulty or we sent the wrong item.
- Once the return arrives and we've checked it, we refund the item price.

## Opened items

Opened items can't be returned because you changed your mind, but they're still covered by the warranty. Digital items, such as firmware or licence keys, can't be refunded once delivered unless they don't work as described.

## Faulty, damaged or wrong items

If something arrives damaged, faulty or isn't what you ordered, tell us within 7 days of delivery with your order number and a photo or short description. We'll replace it, or refund it if a replacement isn't possible, and we cover the shipping.

## Warranty claims

Hardware is covered for 12 months against manufacturing defects (24 months on the TraceCore 100T Pro). Contact us with your order number and a description of the problem. We'll help you troubleshoot first, then repair or replace the item. If neither is possible, we'll refund it.

## How refunds are paid

- Refunds go back to the payment method you used. Card refunds are made through Razorpay and usually appear within 5 to 7 business days after we approve them, depending on your bank.
- Shipping costs are refunded when the return is because of our mistake or a faulty item.
- You'll get an email when your refund is issued.

${CONTACT}`,

  shipping: `## Where we ship

We ship worldwide to the countries listed at checkout.

## When your order ships

Paid orders are tested and usually leave our lab within 1 business day. Orders placed on weekends or public holidays ship the next business day.

## Delivery times

Orders ship by tracked express courier and usually arrive within 3 to 7 business days, depending on the destination. Customs checks can add a few days, and we can't control those delays.

## Shipping costs

Shipping is free on orders over {{freeShippingThreshold}}. Below that, a flat rate of {{flatShipping}} applies. The exact cost is always shown at checkout before you pay.

## Customs and import duties

Orders shipped outside the country we ship from may be charged import duties, taxes or customs fees. These are set by your country, aren't included in our prices, and are paid by you when the parcel arrives.

## Tracking your order

We email you a tracking link as soon as your order ships. You can also follow it in your account, on our [track your order](/track) page, or with /track in our Discord server.

## Address changes

Please check your shipping address at checkout. To change it, contact us before your order ships. We can't redirect a parcel once it's with the courier.

## Lost or damaged parcels

If your tracking hasn't moved for 7 days, or your parcel arrives damaged, contact us. We'll open a claim with the courier and replace or refund your order if it's lost or damaged in transit.

${CONTACT}`,

  privacy: `## Who we are

This policy explains how TraceCoreLab, operated by [Registered business name], [Registered business address], handles your personal information when you use tracecorelab.com or our Discord server.

## What we collect

- **When you order:** your name, email, phone number (optional), shipping address and what you ordered.
- **When you sign in:** we email you a one-time code; we don't use passwords. If you sign in with Discord or Google, we store your Discord user ID and username, or your Google account ID, to recognise you.
- **When you contact us:** what you send us through the contact form, email or a support ticket in our Discord.
- **Technical information:** your IP address, to prevent fraud and limit repeated sign-in attempts.
- **Payments:** card payments are handled by Razorpay. We receive the payment status and a payment reference, never your card number.

## How we use it

- To process, ship and support your orders, and to email you order updates and sign-in codes.
- To run your account, loyalty points and reviews.
- To answer your questions and support tickets.
- To prevent fraud and keep the store secure.
- To send our newsletter, only if you subscribe. You can unsubscribe at any time.

## Who we share it with

We share only what each service needs to do its job:

- Razorpay, to take payments.
- Shipping couriers, to deliver your order.
- Our email provider, to send you emails.
- Our hosting provider, which stores the store's data.
- In our Discord server, the AI assistant sends your ticket messages and questions to our AI provider to write its answers.

We don't sell your information.

## Cookies

We use only the cookies the store needs to work: they keep you signed in. Your cart is saved in your browser. We don't use advertising or analytics cookies.

## How long we keep it

We keep order records for as long as we need them for accounting, tax and warranty purposes. You can ask us to delete your account at any time; we'll keep only what the law requires us to.

## Your rights

You can ask to see the information we hold about you, correct it, or have it deleted. Email us and we'll reply within 30 days.

## Changes to this policy

We may update this policy. The latest version is always on this page.

${CONTACT}`,
};

/** A policy as saved in the admin, or its draft. Cached for the storefront; saving refreshes it. */
export async function getLegalDoc(slug: LegalSlug): Promise<{ body: string; updatedAt: Date | null }> {
  if (!isDbConfigured()) return { body: LEGAL_DRAFTS[slug], updatedAt: null };
  return loadLegalDoc(slug);
}

async function loadLegalDoc(slug: LegalSlug) {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("minutes");
  return readLegalDoc(slug);
}

/** Uncached, for the editor. */
export async function readLegalDoc(slug: LegalSlug) {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, legalKey(slug))).limit(1);
  const body = (row?.value as { body?: unknown } | undefined)?.body;
  return { body: typeof body === "string" ? body : LEGAL_DRAFTS[slug], updatedAt: row?.updatedAt ?? null };
}
