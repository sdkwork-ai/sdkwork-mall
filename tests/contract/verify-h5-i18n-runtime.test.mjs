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
 * identifiers to the buyer. This test flattens the catalogue and proves every
 * `t("...")` key used by the migrated payment-result surface resolves.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const cataloguePath =
  "apps/sdkwork-mall-h5/src/i18n/zh-CN/checkout/payment-result/messages.json";
const paymentResultPath =
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/PaymentResultPage.tsx";

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

test("the H5 runtime initialises i18next with a zh-CN catalogue", () => {
  const runtime = read("apps/sdkwork-mall-h5/src/i18n/index.ts");
  assert.match(runtime, /initReactI18next/u);
  assert.match(runtime, /resources:\s*SDKWORK_MALL_H5_I18N_RESOURCES/u);
  assert.match(runtime, /lng:\s*SDKWORK_MALL_H5_DEFAULT_LOCALE/u);
  assert.match(runtime, /"zh-CN"/u);

  const main = read("apps/sdkwork-mall-h5/src/main.tsx");
  assert.match(main, /import "\.\/i18n";/u);
});

test("every payment-result key used by the page exists in the catalogue", () => {
  const catalogue = JSON.parse(read(cataloguePath));
  const available = new Set(flattenKeys(catalogue));
  const page = read(paymentResultPath);

  const used = [...page.matchAll(/\bt\("([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(used.length >= 10, `expected the page to use i18n keys, found ${used.length}`);

  for (const key of used) {
    assert.ok(available.has(key), `missing catalogue key: ${key}`);
  }
});

test("the migrated page no longer carries hard-coded user copy", () => {
  const page = read(paymentResultPath);
  const chineseLiterals = [...page.matchAll(/"[^"\n]*[\u4e00-\u9fff][^"\n]*"/gu)].map(
    (match) => match[0],
  );
  assert.deepEqual(chineseLiterals, [], `payment result must read copy from the catalogue`);
});
