import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Cart and checkout are building blocks, not mall features.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (cart / checkout / payments rows). The
 * cart, checkout session, payment-method, coupon, address and wallet operations
 * are owned by the mall commerce block; the payment intent by the order block.
 * The mall service projects them and must not hand-roll a wire path.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const miniProgram = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

function read(relative) {
  const absolute = path.join(miniProgram, relative);
  assert.ok(existsSync(absolute), `missing ${relative}`);
  return readFileSync(absolute, "utf8");
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

test("the cart service reads and writes through the commerce block", () => {
  const service = read("src/services/cart-service.ts");
  assert.match(service, /getMallMpRuntime\(\)\.commerceClient/u, "the commerce client arrives through the runtime");
  for (const call of [
    "cart\\.current\\.retrieve",
    "cart\\.items\\.create",
    "cart\\.items\\.update",
    "cart\\.items\\.delete",
    "payments\\.methods\\.list",
    "promotions\\.userCoupons\\.list",
    "checkout\\.sessions\\.create",
    "checkout\\.sessions\\.quotes\\.create",
    "checkout\\.sessions\\.orders\\.create",
    "addresses\\.defaultSelection\\.create",
    "promotions\\.discountApplications\\.create",
    "wallet\\.holds\\.create",
  ]) {
    assert.match(service, new RegExp(call, "u"), `missing block call ${call}`);
  }
});

test("the payment intent is started by the order block", () => {
  const service = read("src/services/cart-service.ts");
  assert.match(service, /getMallMpRuntime\(\)\.orderClient\.orders\.payments\.create/u);
  assert.match(service, /createMpIdempotencyParams/u, "commands carry an idempotency key");
});

test("the cart service owns no commerce wire path", () => {
  const source = stripComments(read("src/services/cart-service.ts"));
  for (const pattern of [
    /path:\s*"\/(?:cart|checkout|payments|promotions|wallet|addresses)/u,
    /\/checkout\/sessions/u,
    /\/user_coupons/u,
    /\/discount_applications/u,
    /\/wallet\/holds/u,
    /default_selection/u,
  ]) {
    assert.doesNotMatch(source, pattern, `hand-rolled commerce endpoint: ${pattern}`);
  }
});

test("the money-path body builder stays pure and exported", () => {
  const service = read("src/services/cart-service.ts");
  assert.match(service, /export function buildCheckoutOrderBody/u);
  const builderStart = service.indexOf("export function buildCheckoutOrderBody");
  const builderBody = service.slice(builderStart, service.indexOf("\n}", builderStart));
  assert.doesNotMatch(builderBody, /await|request\(/u, "the builder must stay free of I/O");
});
