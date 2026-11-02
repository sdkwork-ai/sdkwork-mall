import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * H5 i18n runtime contract (TECH-I18N-READINESS S2 for the H5 root).
 *
 * The runtime is only useful if every migrated key actually exists: i18next
 * renders the key itself when a resource is missing, which ships English-looking
 * identifiers to the buyer. This test merges the authored fragments and proves
 * every `t("...")` key used by a migrated page resolves.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

const FRAGMENTS = [
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/checkout/payment-result/messages.json",
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/checkout/confirm-order/messages.json",
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/catalog/product-detail/messages.json",
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/storefront/home/messages.json",
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/support/help/messages.json",
];

const PAGES = [
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/PaymentResultPage.tsx",
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx",
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/pages/ProductDetailPage.tsx",
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-home/src/pages/HomePage.tsx",
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-home/src/pages/HelpPage.tsx",
];

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

function flattenKeys(value, prefix = "", collected = []) {
  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenKeys(child, nextPrefix, collected);
    } else {
      collected.push(nextPrefix);
    }
  }
  return collected;
}

test("the H5 runtime initialises i18next with the authored fragments", () => {
  const runtime = read("apps/sdkwork-mall-h5/src/i18n/index.ts");
  assert.match(runtime, /initReactI18next/u);
  assert.match(runtime, /resources:\s*SDKWORK_MALL_H5_I18N_RESOURCES/u);
  assert.match(runtime, /lng:\s*SDKWORK_MALL_H5_DEFAULT_LOCALE/u);
  assert.match(runtime, /"zh-CN"/u);
  assert.match(runtime, /confirm-order\/messages\.json/u);
  assert.match(runtime, /payment-result\/messages\.json/u);

  const main = read("apps/sdkwork-mall-h5/src/main.tsx");
  assert.match(main, /import "\.\/i18n";/u);
});

test("every key used by a migrated page exists in the merged catalogue", () => {
  const available = new Set(
    FRAGMENTS.flatMap((fragment) => flattenKeys(JSON.parse(read(fragment)))),
  );

  for (const pagePath of PAGES) {
    const page = read(pagePath);
    // Direct t("...") calls plus keys declared in page constants (dynamic
    // `t(link.labelKey)` lookups resolve those at render time).
    const used = new Set([
      ...[...page.matchAll(/\bt\("([^"]+)"/gu)].map((match) => match[1]),
      ...[...page.matchAll(/"((?:checkout|paymentResult|help|productDetail|home)\.[A-Za-z0-9_.]+)"/gu)].map(
        (match) => match[1],
      ),
    ]);
    assert.ok(used.size >= 8, `${pagePath}: expected i18n keys, found ${used.size}`);
    for (const key of used) {
      assert.ok(available.has(key), `${pagePath}: missing catalogue key ${key}`);
    }
  }
});

test("migrated pages carry no hard-coded user copy", () => {
  for (const pagePath of PAGES) {
    const page = read(pagePath);
    // Comments explain the code; only executable string literals are copy.
    const code = page
      .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/\/\/[^\n]*/gu, "");
    const chineseLiterals = [...code.matchAll(/"[^"\n]*[\u4e00-\u9fff][^"\n]*"/gu)].map(
      (match) => match[0],
    );
    assert.deepEqual(chineseLiterals, [], `${pagePath} must read copy from the catalogue`);
  }
});
