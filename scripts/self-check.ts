// Assertion checks for the content guard, the token filler, the product cost maths and partner terms. Run: npm run self-check
import assert from "node:assert/strict";
import { customerPrice, discountStops, earnsPerUnit, generalTerms, resolveTerms, type Layer, type Rule } from "../src/lib/affiliate-terms";
import { findBlocked, findLiteralPrices } from "../src/lib/content-guard";
import { parseCost, saleCosts, totalCost, type CostField } from "../src/lib/costs";
import { feesTotal, orderFees } from "../src/lib/fees";
import { fillTokens } from "../src/lib/tokens";

// Content guard: blocked wording is caught, ordinary hardware wording is not.
for (const bad of ["an undetected setup", "EAC support", "aimbot", "bypass the check", "spoof the EDID", "flash custom firmware", "a complete setup", "Valorant", "disable VT-d first"]) {
  assert.ok(findBlocked(bad).length > 0, `should block: ${bad}`);
}
for (const ok of [
  "ESP32-S3 microcontroller",
  "100-240 VAC power adapter",
  "Kernel DMA Protection is on: check it in msinfo32",
  "Use a DMA card only on computers you own or are authorized to examine.",
  "No game cheats, cheat software or anti-cheat bypass tools are sold on this website",
  "espresso",
]) {
  assert.deepEqual(findBlocked(ok), [], `should allow: ${ok}`);
}
assert.deepEqual(findLiteralPrices("costs $149.99 or {{price:ferrum}}"), ["$149.99"]);

// Tokens: settings amounts and prices are filled; unknown tokens stay as written.
const settings = { freeShippingThreshold: 600, flatShipping: 35, supportEmail: "support@example.com" };
const shipping = fillTokens("Free over {{freeShippingThreshold}}, else {{flatShipping}}.", { settings });
assert.match(shipping, /^Free over \$600(\.00)?, else \$35(\.00)?\.$/, shipping);
assert.equal(fillTokens("Mail {{supportEmail}}", { settings }), "Mail support@example.com");
assert.equal(fillTokens("{{nope}}", { settings }), "{{nope}}");

// Product costs: the owner's example. Ferrum at $149.99 + $35 shipping costs $120 + $20 + 1.85% of $184.99.
const fields: CostField[] = [
  { id: 1, name: "Supplier", kind: "per-item", defaultValue: null },
  { id: 2, name: "Shipping", kind: "per-order", defaultValue: null },
  { id: 3, name: "Payment fee", kind: "percent", defaultValue: 185 },
];
const ferrum = { 1: 12000, 2: 2000 };
const one = saleCosts(fields, { totalCents: 18499, lines: [{ values: ferrum, qty: 1, lineTotalCents: 14999 }] });
assert.deepEqual(one, [{ name: "Supplier", cents: 12000 }, { name: "Shipping", cents: 2000 }, { name: "Payment fee", cents: 342 }]);
assert.equal(18499 - totalCost(one), 4157);
// Two units and a $10 cable in one order: supplier per unit, shipping once at the highest value, the fee on the total.
const two = saleCosts(fields, { totalCents: 30998, lines: [{ values: ferrum, qty: 2, lineTotalCents: 29998 }, { values: { 1: 300, 2: 500 }, qty: 1, lineTotalCents: 1000 }] });
assert.deepEqual(two, [{ name: "Supplier", cents: 24300 }, { name: "Shipping", cents: 2000 }, { name: "Payment fee", cents: 573 }]);
assert.deepEqual(saleCosts(fields, { totalCents: 0, lines: [] }), []);
assert.equal(parseCost("percent", "1.85%"), 185);
assert.equal(parseCost("per-item", "$1,200.50"), 120050);
assert.equal(parseCost("per-item", " "), null);
assert.ok(Number.isNaN(parseCost("percent", "120")) && Number.isNaN(parseCost("per-item", "-5")) && Number.isNaN(parseCost("per-item", "abc")));

// Checkout fees: a set amount plus a percent of the items and shipping ($184.99), neither stacking on the other.
const charged = orderFees([{ name: "Handling", kind: "amount", value: 2.5 }, { name: "Processing", kind: "percent", value: 1.85 }, { name: "Off", kind: "amount", value: 0 }], 18499);
assert.deepEqual(charged, [{ name: "Handling", cents: 250 }, { name: "Processing (1.85%)", cents: 342 }]);
assert.equal(feesTotal(charged), 592);
assert.equal(feesTotal(null), 0);

// Partner terms: the owner's example. The program allows 20% off; the partner picks their customers' discount up to it.
const program = { commissionKind: "percent" as const, commissionValue: 1000, maxDiscount: 2000 };
const item = { id: 1, slug: "ferrum", name: "Ferrum", priceCents: 14999 };
const none: Rule = { visible: null, commissionKind: null, commissionValue: null, priceCents: null };
const inProgram: Layer = { rule: { ...none, visible: true } };
const price = (discount: number | null, layers: Layer[] = [inProgram]) => resolveTerms(item, layers, program, discount).priceCents;
assert.equal(price(null), 11999); // not chosen: the biggest discount allowed
assert.equal(price(1000), 13499);
assert.equal(price(0), 14999);
assert.equal(price(5000), 11999); // never more than the limit
// The partner's own limit beats the group's; a product's own row (lowest price, commission) beats any level's general terms.
assert.equal(price(null, [{ general: { commissionKind: null, commissionValue: null, maxDiscount: 3000 } }, { rule: { ...none, visible: true, priceCents: 12999 } }]), 12999);
assert.deepEqual(resolveTerms(item, [{ general: { commissionKind: "fixed", commissionValue: 1500, maxDiscount: null } }, { rule: { ...none, visible: true, commissionKind: "percent", commissionValue: 500 } }], program, null).commission, { kind: "percent", value: 500 });
const group: Layer = { general: { commissionKind: "fixed", commissionValue: 1500, maxDiscount: 3000 } };
const partner: Layer = { general: { commissionKind: null, commissionValue: null, maxDiscount: 500 } };
assert.equal(price(null, [group, inProgram]), 10499);
assert.equal(price(null, [partner, group, inProgram]), 14249);
assert.equal(price(null, [{ ...group, rule: { ...none, priceCents: 12999 } }, inProgram]), 12999);
assert.deepEqual(resolveTerms(item, [partner, group, inProgram], program, null).commission, { kind: "fixed", value: 1500 });
assert.equal(resolveTerms(item, [group], program, null).visible, false);
assert.deepEqual(generalTerms([partner.general, group.general], program), { commission: { kind: "fixed", value: 1500 }, maxDiscount: 500 });
assert.equal(earnsPerUnit({ kind: "percent", value: 1000 }, 13499), 1350);
assert.equal(earnsPerUnit({ kind: "fixed", value: 1500 }, 1000), 1000);
// The slider: whole percents, ending on the most any product allows (12.5% here, 20% on a cheap item despite cent rounding).
assert.deepEqual(discountStops([{ regularCents: 14999, floorCents: 13124 }]), [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1250]);
assert.equal(discountStops([{ regularCents: 1899, floorCents: 1519 }]).at(-1), 2000);
assert.equal(customerPrice(14999, 13124, null), 13124);
assert.deepEqual(discountStops([{ regularCents: 14999, floorCents: 14999 }]), [0]);

console.log("self-check passed");
