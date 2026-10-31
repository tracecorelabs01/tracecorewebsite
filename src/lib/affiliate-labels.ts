// Display labels for affiliate commission and payout states, shared by the partner portal and the admin.

export const COMMISSION_STATUS: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "dim" }> = {
  pending: { label: "Pending", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  paid: { label: "Paid", tone: "neutral" },
  reversed: { label: "Reversed", tone: "dim" },
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "dim" }> = {
  requested: { label: "Requested", tone: "warn" },
  paid: { label: "Paid", tone: "ok" },
  rejected: { label: "Rejected", tone: "dim" },
};

export const PAYOUT_METHOD: Record<string, string> = { paypal: "PayPal", store_credit: "Store credit" };

/** "10%" or "$12.50 each". Percent values are hundredths of a percent; fixed values are cents. */
export function commissionLabel(c: { kind: "percent" | "fixed"; value: number }) {
  return c.kind === "percent" ? `${(c.value / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : `$${(c.value / 100).toFixed(2)} each`;
}
