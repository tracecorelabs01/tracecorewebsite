// The warranty on everything the store sells: 3 months from the purchase date. Defective or damaged items are
// replaced, not refunded, and returns are handled as warranty claims. The FAQ and the policies say the same.

export const WARRANTY_MONTHS = 3;

/** When the warranty on an order's items ends: WARRANTY_MONTHS after the order was placed. */
export function warrantyEnds(purchased: Date) {
  const end = new Date(purchased);
  end.setUTCMonth(end.getUTCMonth() + WARRANTY_MONTHS);
  return end;
}
