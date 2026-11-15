// What a partner earns and what their customers pay, worked out from the program, group and partner settings.
// No server code here: the partner portal previews prices with the same maths the server prices orders with.

export type CommissionKind = "percent" | "fixed";
/** percent: hundredths of a percent (1000 = 10%); fixed: cents per unit. */
export type Commission = { kind: CommissionKind; value: number };

/** A group's or partner's general terms. null = use the level above. Discounts are hundredths of a percent. */
export type LevelTerms = { commissionKind: CommissionKind | null; commissionValue: number | null; maxDiscount: number | null };
/** One product's exception at one level. null = no exception. `priceCents` is the lowest price customers can pay. */
export type Rule = { visible: boolean | null; commissionKind: CommissionKind | null; commissionValue: number | null; priceCents: number | null };
export type ProgramTerms = { commissionKind: CommissionKind; commissionValue: number; maxDiscount: number };
/** One level's settings for a product: the product's own row and the level's general terms. */
export type Layer = { rule?: Rule | null; general?: LevelTerms | null };

export type Terms = {
  productId: number;
  slug: string;
  name: string;
  regularCents: number;
  visible: boolean;
  commission: Commission;
  /** The lowest price the partner's customers can pay. */
  floorCents: number;
  /** What the partner's customers pay now, at the discount the partner chose. */
  priceCents: number;
};

/** The biggest discount limit the team can set: 90%. */
export const MAX_DISCOUNT = 9000;

export const discounted = (cents: number, discount: number) => Math.round((cents * (10_000 - discount)) / 10_000);

/**
 * What a partner's customers pay: the regular price less the partner's discount, never under the floor. A partner
 * who hasn't chosen (null) gives the biggest discount allowed.
 */
export const customerPrice = (regularCents: number, floorCents: number, discount: number | null) => (discount == null ? floorCents : Math.max(floorCents, discounted(regularCents, discount)));

/** What a partner earns on one unit sold at `priceCents`. */
export const earnsPerUnit = (c: Commission, priceCents: number) => (c.kind === "percent" ? Math.round((priceCents * c.value) / 10_000) : Math.min(c.value, priceCents));

const commissionOf = (t: { commissionKind: CommissionKind | null; commissionValue: number | null } | null | undefined): Commission | null =>
  t?.commissionKind != null && t.commissionValue != null ? { kind: t.commissionKind, value: t.commissionValue } : null;

/** The commission and discount limit for products without their own row: the first level that sets each, else the program's. */
export function generalTerms(levels: (LevelTerms | null | undefined)[], program: ProgramTerms) {
  return {
    commission: levels.map(commissionOf).find(Boolean) ?? { kind: program.commissionKind, value: program.commissionValue },
    maxDiscount: levels.find((l) => l?.maxDiscount != null)?.maxDiscount ?? program.maxDiscount,
  };
}

/**
 * A product's terms for a partner. `layers` run from the most specific level (the partner) to the program. A row
 * for the product itself, at any level, beats every level's general terms, so a product's own commission or
 * lowest price holds whatever a group's or partner's general rates are; the most specific level wins among each.
 */
export function resolveTerms(product: { id: number; slug: string; name: string; priceCents: number }, layers: Layer[], program: ProgramTerms, discount: number | null): Terms {
  let visible: boolean | null = null;
  let commission: Commission | null = null;
  let floorCents: number | null = null;
  for (const { rule } of layers) {
    visible ??= rule?.visible ?? null;
    commission ??= commissionOf(rule);
    floorCents ??= rule?.priceCents != null ? Math.min(rule.priceCents, product.priceCents) : null;
  }
  const general = generalTerms(layers.map((l) => l.general), program);
  floorCents ??= discounted(product.priceCents, general.maxDiscount);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    regularCents: product.priceCents,
    visible: visible ?? false,
    commission: commission ?? general.commission,
    floorCents,
    priceCents: customerPrice(product.priceCents, floorCents, discount),
  };
}

/** How far a price is under the regular one, in hundredths of a percent, to the nearest 0.1% (prices are whole cents). */
export const discountOf = (regularCents: number, priceCents: number) => (regularCents > 0 && priceCents < regularCents ? Math.round(((regularCents - priceCents) * 1000) / regularCents) * 10 : 0);

/**
 * The discounts a partner can pick, in hundredths of a percent: whole percents up to the biggest any of their
 * products allows. The last stop is that biggest discount; it is saved as "the biggest allowed" (null), which
 * prices every product at its lowest price.
 */
export function discountStops(products: { regularCents: number; floorCents: number }[]) {
  const max = Math.max(0, ...products.map((p) => discountOf(p.regularCents, p.floorCents)));
  const stops: number[] = [];
  for (let d = 0; d < max; d += 100) stops.push(d);
  return [...stops, max];
}
