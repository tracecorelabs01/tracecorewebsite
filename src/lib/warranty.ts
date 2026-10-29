// Warranty terms, as the FAQ states them: 12 months on all hardware, 24 on the 100T Pro.
// Counted from delivery, or from payment while an order hasn't been marked delivered.

const MONTHS_BY_SLUG: Record<string, number> = { "tracecore-100t-pro": 24 };

export const warrantyMonths = (productSlug: string) => MONTHS_BY_SLUG[productSlug] ?? 12;

export function warrantyEnds(start: Date, months: number) {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}
