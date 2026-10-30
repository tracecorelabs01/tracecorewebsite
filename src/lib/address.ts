// Shipping addresses: the fields checkout and the account's address book check, and keeping an account's
// address book, where its first address is the default and the same place is never saved twice.

import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { customerAddresses, getDb } from "@/db";

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(80),
  lastName: z.string().trim().min(1, "Required").max(80),
  address1: z.string().trim().min(3, "Required").max(191),
  address2: z.string().trim().max(191).optional(),
  city: z.string().trim().min(1, "Required").max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(2, "Required").max(40),
  country: z.string().trim().min(2, "Select a country").max(80),
});
export type AddressInput = z.infer<typeof addressSchema>;
export type SavedAddress = Awaited<ReturnType<typeof listAddresses>>[number];

const row = (a: AddressInput) => ({ ...a, address2: a.address2 || null, region: a.region || null });

/** The same place whatever the letter case or spacing, so it isn't saved twice. */
const placeKey = (a: { address1: string; address2?: string | null; city: string; postalCode: string; country: string }) =>
  [a.address1, a.address2 ?? "", a.city, a.postalCode, a.country].map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()).join("|");

/** An account's addresses, the default first. */
export function listAddresses(customerId: number) {
  return getDb()
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt), asc(customerAddresses.id));
}

const MAX_ADDRESSES = 20;

/** Keeps an address an order shipped to, unless the account has it already (or is full). The first one becomes the default. */
export async function rememberAddress(customerId: number, a: AddressInput) {
  const saved = await listAddresses(customerId);
  if (saved.length >= MAX_ADDRESSES || saved.some((s) => placeKey(s) === placeKey(a))) return;
  await getDb().insert(customerAddresses).values({ customerId, ...row(a), isDefault: saved.length === 0 });
}

/** Adds (`id` null) or edits one of the account's addresses. Returns why it can't, or null once it's saved. */
export async function saveAddress(customerId: number, a: AddressInput, id: number | null, makeDefault: boolean) {
  const saved = await listAddresses(customerId);
  if (id !== null && !saved.some((s) => s.id === id)) return "That address isn't in your account any more.";
  if (saved.some((s) => s.id !== id && placeKey(s) === placeKey(a))) return "You already have this address saved.";
  if (id === null && saved.length >= MAX_ADDRESSES) return `You can keep up to ${MAX_ADDRESSES} addresses. Remove one to add another.`;
  const db = getDb();
  if (id === null) {
    const [{ id: newId }] = await db.insert(customerAddresses).values({ customerId, ...row(a), isDefault: saved.length === 0 }).$returningId();
    id = newId;
  } else {
    await db.update(customerAddresses).set(row(a)).where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)));
  }
  if (makeDefault) await setDefault(customerId, id);
  return null;
}

async function setDefault(customerId: number, id: number) {
  await getDb().transaction(async (tx) => {
    await tx.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.customerId, customerId), ne(customerAddresses.id, id)));
    await tx.update(customerAddresses).set({ isDefault: true }).where(and(eq(customerAddresses.customerId, customerId), eq(customerAddresses.id, id)));
  });
}

/** Makes one of the account's addresses the default. */
export async function makeDefaultAddress(customerId: number, id: number) {
  if ((await listAddresses(customerId)).some((s) => s.id === id)) await setDefault(customerId, id);
}

/** Removes one of the account's addresses; if it was the default, the next one takes over. */
export async function deleteAddress(customerId: number, id: number) {
  const saved = await listAddresses(customerId);
  const gone = saved.find((s) => s.id === id);
  if (!gone) return;
  await getDb().delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)));
  const next = saved.find((s) => s.id !== id);
  if (gone.isDefault && next) await setDefault(customerId, next.id);
}
