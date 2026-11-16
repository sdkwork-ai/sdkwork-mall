import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Orders are a building block, not a mall feature.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (order row) and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. The order plane is owned by
 * the generated order app SDK (`orders`, `payments`, `cancellations`, `receipts`,
 * `payment-success`, `shipments`); the mall service projects it onto view models
 * and must not hand-roll an order wire path.
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

test("the order service reads and writes through the order block", () => {
  const service = read("src/services/order-service.ts");
  assert.match(service, /getMallMpRuntime\(\)\.orderClient/u, "the order client arrives through the runtime");
  for (const call of [
    "ordersClient\\(\\)\\.list",
    "ordersClient\\(\\)\\.retrieve",
    "ordersClient\\(\\)\\.statistics\\.retrieve",
    "ordersClient\\(\\)\\.payments\\.create",
    "ordersClient\\(\\)\\.cancellations\\.create",
    "ordersClient\\(\\)\\.receipts\\.create",
    "ordersClient\\(\\)\\.paymentSuccess\\.retrieve",
    "shipmentsClient\\(\\)\\.retrieve",
    "shipmentsClient\\(\\)\\.packages\\.list",
    "shipmentsClient\\(\\)\\.trackingEvents\\.list",
  ]) {
    assert.match(service, new RegExp(call, "u"), `missing block call ${call}`);
  }
  // Idempotent commands must come from the shared helper.
  assert.match(service, /createMpIdempotencyParams/u);
});

test("the order service owns no order wire path", () => {
  const source = stripComments(read("src/services/order-service.ts"));
  for (const pattern of [/path:\s*"\/(?:orders|shipments)/u, /\/orders\//u, /\/shipments\//u, /receipt_confirmations/u]) {
    assert.doesNotMatch(source, pattern, `hand-rolled order endpoint: ${pattern}`);
  }
});

test("the order client is built from the generated order app SDK in one place", () => {
  const sdk = read("packages/sdkwork-mall-mp-core/src/sdk/index.ts");
  assert.match(sdk, /from "@sdkwork\/order-app-sdk"/u);
  assert.match(sdk, /createMpOrderAppSdkClient/u);
  assert.match(sdk, /createMpIdempotencyParams/u, "the seam owns the idempotency helper");
  const runtime = read("packages/sdkwork-mall-mp-core/src/runtime/index.ts");
  assert.match(runtime, /createMpOrderAppSdkClient\(\{ baseUrl: appApiBaseUrl, tokenManager \}\)/u);
  assert.match(runtime, /readonly orderClient: MpOrderAppSdkClient/u);
});
