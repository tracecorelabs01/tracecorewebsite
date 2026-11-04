// Assertion checks for the content guard, the token filler and the product cost maths. Run: npm run self-check
import assert from "node:assert/strict";
import { findBlocked, findLiteralPrices } from "../src/lib/content-guard";
import { parseCost, saleCosts, totalCost, type CostField } from "../src/lib/costs";
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

console.log("self-check passed");
