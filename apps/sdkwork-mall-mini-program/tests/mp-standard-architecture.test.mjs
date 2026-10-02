import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function collectPageFiles() {
  const pagesDir = fileURLToPath(new URL("../src/pages/", import.meta.url));
  const files = [];
  for (const entry of readdirSync(pagesDir)) {
    const entryPath = join(pagesDir, entry);
    try {
      const inner = readdirSync(entryPath);
      for (const name of inner) {
        if (name.endsWith(".js")) {
          files.push(`../src/pages/${entry}/${name}`);
        }
      }
    } catch {
      // not a directory
    }
  }
  return files;
}

test("mall mini-program root is manifest-driven", () => {
  const manifest = JSON.parse(read("../sdkwork.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-mini-program");
  assert.equal(manifest.runtime?.family, "mini-program");
  assert.equal(manifest.runtime?.framework, "weixin-mini-program");
});

test("mall mini-program tab bar covers the JD core surfaces", () => {
  const appJson = JSON.parse(read("../src/app.json"));
  const pages = appJson.tabBar.list.map((entry) => entry.pagePath);
  assert.deepEqual(pages, [
    "pages/home/index",
    "pages/category/index",
    "pages/cart/index",
    "pages/buyer/index",
  ]);
});

test("mall mini-program registers the full commerce route catalog", () => {
  const appJson = JSON.parse(read("../src/app.json"));
  const pages = new Set(appJson.pages);
  const requiredSurfaces = [
    "pages/home/index",
    "pages/category/index",
    "pages/search/index",
    "pages/product/index",
    "pages/cart/index",
    "pages/checkout/index",
    "pages/cashier/index",
    "pages/payment-result/index",
    "pages/orders/index",
    "pages/order-detail/index",
    "pages/address/index",
    "pages/coupons/index",
    "pages/buyer/index",
    "pages/login/index",
  ];
  for (const surface of requiredSurfaces) {
    assert.equal(pages.has(surface), true, `mini-program must register ${surface}`);
  }
});

test("mall mini-program funnels all traffic through the single transport seam", () => {
  const transportSource = read("../src/services/transport.js");
  const seamCalls = transportSource.match(/wx\.request\(/gu) ?? [];
  assert.equal(
    seamCalls.length,
    1,
    "services/transport.js must be the only module issuing wx.request",
  );

  for (const file of collectPageFiles()) {
    assert.ok(!read(file).includes("wx.request("), `${file} must not call wx.request directly`);
  }
  for (const file of [
    "../src/app.js",
    "../src/services/catalog-service.js",
    "../src/services/cart-service.js",
    "../src/services/order-service.js",
    "../src/services/address-service.js",
    "../src/services/promotion-service.js",
  ]) {
    assert.ok(!read(file).includes("wx.request("), `${file} must go through the transport seam`);
  }
});

test("mall mini-program commerce facade composes the domain services", () => {
  const facade = read("../src/bootstrap/sdkClients.ts");
  for (const serviceType of [
    "MallMpCatalogService",
    "MallMpCartService",
    "MallMpOrderService",
    "MallMpAddressService",
    "MallMpPromotionService",
  ]) {
    assert.match(facade, new RegExp(serviceType, "u"), `facade must type ${serviceType}`);
  }
  for (const service of [
    "../src/services/catalog-service.js",
    "../src/services/cart-service.js",
    "../src/services/order-service.js",
    "../src/services/address-service.js",
    "../src/services/promotion-service.js",
  ]) {
    assert.ok(read(service).includes("module.exports"), `${service} must export its domain surface`);
  }
});
