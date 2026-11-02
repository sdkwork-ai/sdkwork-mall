import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program i18n runtime contract.
 *
 * The mini-program module system resolves JavaScript at runtime, not JSON, so
 * copy is authored as plain-object `.js` fragments under
 * `src/i18n/<locale>/<domain>/<capability>/` with a sibling `.d.ts`. The runtime
 * flattens them once and exposes a synchronous `t(key, params)`.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const appRoot = "apps/sdkwork-mall-mini-program";

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the runtime flattens authored fragments and exposes lookups", () => {
  const runtime = read(`${appRoot}/src/i18n/index.ts`);
  assert.match(runtime, /from "\.\/zh-CN\/account\/buyer-hub\/messages"/u);
  assert.match(runtime, /from "\.\/zh-CN\/support\/help\/messages"/u);
  assert.match(runtime, /from "\.\/zh-CN\/support\/after-sales\/messages"/u);
  assert.match(runtime, /from "\.\/zh-CN\/storefront\/home\/messages"/u);
  assert.match(runtime, /from "\.\/zh-CN\/checkout\/confirm-order\/messages"/u);
  assert.match(runtime, /export function t\(/u);
  assert.match(runtime, /export function hasMessage\(/u);
  assert.match(runtime, /\{\{\$\{name\}\}\}/u);

  const fragment = read(`${appRoot}/src/i18n/zh-CN/account/buyer-hub/messages.js`);
  assert.match(fragment, /buyerHub/u);

  const helpFragment = read(`${appRoot}/src/i18n/zh-CN/support/help/messages.js`);
  assert.match(helpFragment, /help:/u);

  const afterSalesFragment = read(`${appRoot}/src/i18n/zh-CN/support/after-sales/messages.js`);
  assert.match(afterSalesFragment, /afterSales:/u);

  const homeFragment = read(`${appRoot}/src/i18n/zh-CN/storefront/home/messages.js`);
  assert.match(homeFragment, /home:/u);

  const checkoutFragment = read(`${appRoot}/src/i18n/zh-CN/checkout/confirm-order/messages.js`);
  assert.match(checkoutFragment, /checkout:/u);

  const declarations = read(`${appRoot}/src/i18n/zh-CN/account/buyer-hub/messages.d.ts`);
  assert.match(declarations, /export = messages;/u);
});

test("the buyer hub and help centre resolve every label from the catalogue", () => {
  const page = read(`${appRoot}/src/pages/buyer/index.ts`);
  assert.match(page, /labelKey: "buyerHub\.orders\.all"/u);
  assert.match(page, /label: t\(entry\.labelKey\)/u);
  assert.match(page, /label: t\(link\.labelKey\)/u);
  assert.match(page, /t\("buyerHub\.logout\.title"\)/u);
  assert.doesNotMatch(page, /label: "全部订单"/u);

  const helpPage = read(`${appRoot}/src/pages/help/index.ts`);
  assert.match(helpPage, /labelKey: "help\.quick\.orders"/u);
  assert.match(helpPage, /title: t\(section\.titleKey\)/u);
  assert.match(helpPage, /items: section\.itemKeys\.map\(\(itemKey\) => t\(itemKey\)\)/u);
  assert.match(helpPage, /t\("help\.contact\.hours"\)/u);

  const homePage = read(`${appRoot}/src/pages/home/index.ts`);
  assert.match(homePage, /titleKey: "home\.banners\.quality\.title"/u);
  assert.match(homePage, /title: t\(banner\.titleKey\)/u);
  assert.match(homePage, /label: t\(entry\.labelKey\)/u);
  assert.match(homePage, /t\("home\.seckill\.titleMatch"\)/u);
  assert.match(homePage, /t\("home\.sold", \{ count: product\.sales \}\)/u);

  const checkoutPage = read(`${appRoot}/src/pages/checkout/index.ts`);
  assert.match(checkoutPage, /t\("checkout\.loading"\)/u);
  assert.match(checkoutPage, /t\("checkout\.giftCard\.required"\)/u);
  assert.match(checkoutPage, /t\("checkout\.errors\.addressRequired"\)/u);
  assert.match(checkoutPage, /t\(method\.labelKey\)/u);

  const afterSalesPage = read(`${appRoot}/src/pages/aftersales/index.ts`);
  assert.match(afterSalesPage, /t\("afterSales\.apply\.orderLabel"\)/u);
  assert.match(afterSalesPage, /t\(entry\.labelKey\)/u);
  assert.match(afterSalesPage, /t\(row\.statusLabelKey\)/u);
  assert.match(afterSalesPage, /t\("afterSales\.errors\.trackingRequired"\)/u);

  for (const tsPath of [
    `${appRoot}/src/pages/buyer/index.ts`,
    `${appRoot}/src/pages/help/index.ts`,
    `${appRoot}/src/pages/home/index.ts`,
    `${appRoot}/src/pages/checkout/index.ts`,
    `${appRoot}/src/pages/aftersales/index.ts`,
  ]) {
    const source = read(tsPath);
    const chineseLiterals = [...source.matchAll(/"[^"\n]*[\u4e00-\u9fff][^"\n]*"/gu)]
      .map((match) => match[0])
      .filter((literal) => !literal.startsWith('"{{'));
    assert.deepEqual(chineseLiterals, [], `${tsPath} must not inline Chinese copy`);
  }

  // Migrated templates render catalogue-driven data only.
  for (const wxmlPath of [
    `${appRoot}/src/pages/help/index.wxml`,
    `${appRoot}/src/pages/home/index.wxml`,
    `${appRoot}/src/pages/checkout/index.wxml`,
    `${appRoot}/src/pages/aftersales/index.wxml`,
  ]) {
    const template = read(wxmlPath);
    assert.deepEqual(
      [...template.matchAll(/[\u4e00-\u9fff]+/gu)].map((match) => match[0]),
      [],
      `${wxmlPath} must not inline Chinese copy`,
    );
  }
});
