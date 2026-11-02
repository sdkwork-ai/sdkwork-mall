import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Payment channel wiring contract.
 *
 * Creating a payment used to keep only the payment id and navigate to the result
 * page, so a buyer who received a cashier URL (or a WeChat prepay payload) could
 * never complete the charge. Every pay entry must hand control to the real
 * channel and keep the result page only as the fallback.
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

test("the mini-program cashier invokes the native WeChat cashier", () => {
  const service = read("apps/sdkwork-mall-mini-program/src/services/cart-service.ts");
  assert.match(service, /export interface MpPaymentStart/u);
  assert.match(service, /export interface MpWechatPayParams/u);
  assert.match(service, /function readWechatPay\(/u);
  assert.match(service, /wechatPay: readWechatPay\(payment\)/u);
  assert.match(service, /paymentUrl: readPaymentUrl\(payment\)/u);

  const cashier = read("apps/sdkwork-mall-mini-program/src/pages/cashier/index.ts");
  assert.match(cashier, /wx\.requestPayment\(\{/u);
  assert.match(cashier, /await this\.requestWechatPayment\(payment\.wechatPay\)/u);
  assert.match(cashier, /wx\.setClipboardData\(\{ data: payment\.paymentUrl \}\)/u);

  const orderDetail = read("apps/sdkwork-mall-mini-program/src/pages/order-detail/index.ts");
  assert.match(orderDetail, /storefront\.mall\.payment-cashier/u);
});

test("the Flutter cashier surfaces the channel URL and routes pay actions through itself", () => {
  const cartService = read("apps/sdkwork-mall-flutter-mobile/lib/services/cart_service.dart");
  assert.match(cartService, /\(\{String paymentId, String paymentUrl\}\)> payOrder/u);
  assert.match(cartService, /_readPaymentUrl\(payment\)/u);
  assert.match(cartService, /'mwebUrl'/u);

  const cashier = read("apps/sdkwork-mall-flutter-mobile/lib/pages/cashier_page.dart");
  assert.match(cashier, /payment\.paymentUrl\.isNotEmpty/u);
  assert.match(cashier, /Clipboard\.setData\(ClipboardData\(text: paymentUrl\)\)/u);
  assert.match(cashier, /SdkworkI18n\.t\('cashier\.linkTitle'\)/u);

  for (const pagePath of [
    "apps/sdkwork-mall-flutter-mobile/lib/pages/orders_page.dart",
    "apps/sdkwork-mall-flutter-mobile/lib/pages/order_detail_page.dart",
  ]) {
    const page = read(pagePath);
    assert.match(page, /pushNamed\('\/cashier'/u, `${pagePath} must route pay through the cashier`);
  }

  const orderService = read("apps/sdkwork-mall-flutter-mobile/lib/services/order_service.dart");
  assert.doesNotMatch(orderService, /payOrder\(/u);
});

