import "server-only";
import { asc, inArray, ne } from "drizzle-orm";
import { costFields, getDb, orderCosts, orderItems, productCosts, products } from "@/db";
import { getStoreSettings } from "@/lib/catalog/server";
import { saleCosts, totalCost, type CostField, type CostLine, type CostValues } from "@/lib/costs";

export function listCostFields(): Promise<CostField[]> {
  return getDb().select({ id: costFields.id, name: costFields.name, kind: costFields.kind, defaultValue: costFields.defaultValue }).from(costFields).orderBy(asc(costFields.id));
}

/** Each product's own cost values, by product id: all products, or only the given ones. */
export async function productCostValues(productIds?: number[]) {
  const map = new Map<number, CostValues>();
  if (productIds && !productIds.length) return map;
  const rows = await getDb()
    .select()
    .from(productCosts)
    .where(productIds ? inArray(productCosts.productId, productIds) : undefined);
  for (const r of rows) map.set(r.productId, { ...map.get(r.productId), [r.costFieldId]: r.value });
  return map;
}

/** Shipping as checkout charges it, in cents: the flat rate, free from the threshold up. */
export async function storeShipping() {
  const s = await getStoreSettings();
  return { flatCents: Math.round(s.flatShipping * 100), freeOverCents: Math.round(s.freeShippingThreshold * 100) };
}

/** What the product form's Costs card needs: the cost fields, the product's own values and the store's shipping. */
export async function productCostSetup(productId?: number) {
  const [fields, values, shipping] = await Promise.all([listCostFields(), productCostValues(productId ? [productId] : []), storeShipping()]);
  return { fields, values: (productId && values.get(productId)) || {}, shipping };
}

/**
 * The Product costs page: the cost fields, how many products set their own value for each, and the profit on one of
 * each product (archived ones left out) ordered on its own.
 */
export async function getCostOverview() {
  const [fields, values, shipping, rows] = await Promise.all([
    listCostFields(),
    productCostValues(),
    storeShipping(),
    getDb()
      .select({ id: products.id, name: products.name, status: products.status, priceCents: products.priceCents })
      .from(products)
      .where(ne(products.status, "archived"))
      .orderBy(asc(products.sortOrder), asc(products.name)),
  ]);
  const usage = new Map<number, number>();
  for (const own of values.values()) for (const id of Object.keys(own)) usage.set(Number(id), (usage.get(Number(id)) ?? 0) + 1);
  const profits = rows.map((p) => {
    const paidCents = p.priceCents + (p.priceCents >= shipping.freeOverCents ? 0 : shipping.flatCents);
    const costCents = totalCost(saleCosts(fields, { totalCents: paidCents, lines: [{ values: values.get(p.id), qty: 1, lineTotalCents: p.priceCents }] }));
    return { ...p, paidCents, costCents, profitCents: paidCents - costCents, costsSet: Boolean(values.get(p.id)) };
  });
  return { fields, usage, profits };
}

/** What a new order costs, for checkout to record with it. Null while no cost fields are set up. */
export async function costsForSale(sale: { totalCents: number; lines: { productId: number | null; qty: number; lineTotalCents: number }[] }) {
  const fields = await listCostFields();
  if (!fields.length) return null;
  const values = await productCostValues(sale.lines.flatMap((l) => (l.productId ? [l.productId] : [])));
  return saleCosts(fields, { totalCents: sale.totalCents, lines: sale.lines.map((l) => ({ ...l, values: l.productId ? values.get(l.productId) : undefined })) });
}

/**
 * The costs of these orders, by order id: what each recorded when it was placed, or for orders placed before costs
 * were set up, what they come to at the products' current costs.
 */
export async function costsOfOrders(orders: { id: number; totalCents: number }[]) {
  const result = new Map<number, CostLine[]>();
  if (!orders.length) return result;
  const db = getDb();
  // ponytail: loads every order in the range in one go; fine for tens of thousands, aggregate in SQL beyond that.
  const recorded = await db
    .select()
    .from(orderCosts)
    .where(
      inArray(
        orderCosts.orderId,
        orders.map((o) => o.id),
      ),
    );
  for (const r of recorded) result.set(r.orderId, r.costs);
  const missing = orders.filter((o) => !result.has(o.id));
  const fields = missing.length ? await listCostFields() : [];
  if (!fields.length) return result;

  const [items, values] = await Promise.all([
    db
      .select({ orderId: orderItems.orderId, productId: orderItems.productId, qty: orderItems.quantity, lineTotalCents: orderItems.lineTotalCents })
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          missing.map((o) => o.id),
        ),
      ),
    productCostValues(),
  ]);
  const itemsBy = new Map<number, typeof items>();
  for (const i of items) itemsBy.set(i.orderId, [...(itemsBy.get(i.orderId) ?? []), i]);
  for (const o of missing) {
    const lines = (itemsBy.get(o.id) ?? []).map((i) => ({ ...i, values: i.productId ? values.get(i.productId) : undefined }));
    result.set(o.id, saleCosts(fields, { totalCents: o.totalCents, lines }));
  }
  return result;
}

/** Order costs added up by cost field, largest first. */
export function costsByField(costs: Iterable<CostLine[]>) {
  const by = new Map<string, number>();
  for (const lines of costs) for (const c of lines) by.set(c.name, (by.get(c.name) ?? 0) + c.cents);
  return [...by].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);
}
