// Expense choices shared by the admin form (client) and its server action.

/** Suggested categories; admins can type their own. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Stock & inventory",
  "Shipping & postage",
  "Packaging",
  "Marketing & ads",
  "Software & subscriptions",
  "Website & hosting",
  "Payment fees",
  "Staff & contractors",
  "Rent & utilities",
  "Equipment",
  "Taxes & fees",
  "Other",
];

export const PAYMENT_METHODS = ["Card", "Bank transfer", "PayPal", "Crypto", "Cash", "Other"] as const;
