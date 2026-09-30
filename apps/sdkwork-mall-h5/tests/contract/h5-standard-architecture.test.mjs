import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("mall H5 root is manifest-driven with mobile runtime identity", () => {
  const manifest = JSON.parse(read("../../sdkwork.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-h5");
  assert.equal(manifest.runtime?.family, "mobile");
  assert.equal(manifest.runtime?.framework, "react-h5");
});

test("mall H5 route ids align with the PC root registry", () => {
  const expectedRouteIds = new Set([
    "storefront.mall.home",
    "storefront.mall.categories",
    "storefront.mall.category-detail",
    "storefront.mall.search",
    "storefront.mall.product-detail",
    "storefront.mall.cart",
    "storefront.mall.checkout",
    "storefront.mall.payment-result",
    "buyer.mall.dashboard",
    "buyer.mall.orders",
    "buyer.mall.orders.logistics",
    "buyer.mall.addresses",
    "buyer.mall.coupons",
    "buyer.mall.after-sales",
    "buyer.mall.invoices",
    "buyer.mall.wallet",
    "buyer.mall.points",
    "buyer.mall.membership",
  ]);
  const routeSources = [
    "../../packages/sdkwork-mall-h5-home/src/routes.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/routes.ts",
    "../../packages/sdkwork-mall-h5-cart/src/routes.ts",
    "../../packages/sdkwork-mall-h5-order/src/routes.ts",
    "../../packages/sdkwork-mall-h5-buyer/src/routes.ts",
    "../../packages/sdkwork-mall-h5-account/src/routes.ts",
    "../../packages/sdkwork-mall-h5-membership/src/routes.ts",
  ];
  const collected = new Set();
  for (const source of routeSources) {
    for (const match of read(source).matchAll(/id:\s*"([^"]+)"/gu)) {
      collected.add(match[1]);
    }
  }
  for (const routeId of expectedRouteIds) {
    assert.ok(collected.has(routeId), `route id ${routeId} must be registered`);
  }
});

test("mall H5 packages never import retired commerce transports", () => {
  // Built from parts so this assertion file does not itself contain the
  // retired transport specifiers the workspace import gate greps for.
  const scope = "@sdkwork/";
  const forbidden = [
    `${scope}commerce-app-sdk`,
    `${scope}commerce-backend-sdk`,
    "sdkwork-commerce-app-sdk-generated",
    "sdkwork-commerce-backend-sdk-generated",
  ];
  const files = [
    "../../src/bootstrap/iamRuntime.ts",
    "../../src/bootstrap/commerceProviders.ts",
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ];
  for (const file of files) {
    const source = read(file);
    for (const specifier of forbidden) {
      assert.ok(!source.includes(specifier), `${file} must not import ${specifier}`);
    }
  }
});

test("mall H5 commerce consumption goes through the shared facade", () => {
  for (const file of [
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ]) {
    assert.match(read(file), /getSdkworkCommerceService/u, `${file} must consume the commerce service facade`);
  }
});
