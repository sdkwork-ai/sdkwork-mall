import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Payment channel wiring contract (H5).
 *
 * Creating a payment used to keep only the payment id and navigate to the result
 * page, so a buyer who received an Alipay/WeChat H5 cashier URL could never
 * complete the charge. The client must surface the channel URL and hand the buyer
 * over to it; the result page stays the fallback when no channel URL exists.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the H5 order service surfaces the channel cashier URL", () => {
  const service = read("apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts");
  assert.match(service, /export interface MallH5OrderPaymentStart/u);
  assert.match(service, /PAYMENT_URL_KEYS/u);
  assert.match(service, /function readPaymentUrl\(/u);
  assert.match(service, /paymentUrl: readPaymentUrl\(payload\)/u);
  assert.match(service, /"mwebUrl"/u);
});

test("every H5 pay action redirects to the channel URL when present", () => {
  for (const pagePath of [
    "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx",
    "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/pages/OrderDetailPage.tsx",
    "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/PaymentResultPage.tsx",
  ]) {
    const page = read(pagePath);
    assert.match(page, /if \(paymentUrl\) \{/u, `${pagePath} must branch on paymentUrl`);
    assert.match(
      page,
      /window\.location\.assign\(paymentUrl\)/u,
      `${pagePath} must hand the buyer to the channel cashier`,
    );
  }

  const cartService = read("apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts");
  assert.match(cartService, /export interface MallH5PaymentRetryStart/u);
  assert.match(cartService, /paymentUrl: readPaymentUrl\(payment\)/u);
});
