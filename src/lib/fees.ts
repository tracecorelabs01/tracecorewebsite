// Checkout fees (Settings > Checkout & payments): charges added to every order, each a set amount or a percent.
// Checkout shows them with this and the server prices every order with it too, so both always agree. No zod or
// server code here: client components import it.

export type CheckoutFee = {
  name: string;
  kind: "amount" | "percent";
  /** Dollars for an amount, or a percent such as 1.85. */
  value: number;
};

/** A fee as charged on one order, kept with the order. */
export type FeeLine = { name: string; cents: number };

export const MAX_CHECKOUT_FEES = 6;

/**
 * The fees on an order. A percent is taken of `baseCents` (the items after discounts, plus shipping), so fees never
 * stack on each other. Fees that come to nothing are left out.
 */
export function orderFees(fees: CheckoutFee[], baseCents: number): FeeLine[] {
  return fees
    .map((f) => (f.kind === "percent" ? { name: `${f.name} (${f.value}%)`, cents: Math.round((baseCents * f.value) / 100) } : { name: f.name, cents: Math.round(f.value * 100) }))
    .filter((f) => f.cents > 0);
}

export const feesTotal = (fees: FeeLine[] | null | undefined) => (fees ?? []).reduce((n, f) => n + f.cents, 0);
