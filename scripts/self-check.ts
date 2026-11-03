// Assertion checks for the content guard and the token filler. Run: npm run self-check
import assert from "node:assert/strict";
import { findBlocked, findLiteralPrices } from "../src/lib/content-guard";
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

console.log("self-check passed");
