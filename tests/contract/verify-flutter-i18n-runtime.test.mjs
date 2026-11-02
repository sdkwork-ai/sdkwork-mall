import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Flutter i18n runtime contract.
 *
 * Flutter was the last root with no i18n mechanism. Messages are authored as
 * JSON fragments under `lib/src/i18n/<locale>/<domain>/<capability>/`, loaded
 * once by `SdkworkI18n` at startup; `t()` is synchronous so widgets never await
 * copy, and a missing fragment degrades to the key.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const appRoot = "apps/sdkwork-mall-flutter-mobile";

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the runtime loads authored fragments and exposes synchronous lookups", () => {
  const runtime = read(`${appRoot}/lib/src/i18n/runtime.dart`);
  assert.match(runtime, /Future<void> load\(/u);
  assert.match(runtime, /static String t\(/u);
  assert.match(runtime, /installForTest/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/support\/help\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/buyer-hub\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/membership\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/storefront\/home\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/catalog\/product-detail\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/wallet\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/messages\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/catalog\/search\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/account-pages\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/order\/detail\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/marketing\/pages\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/account\/settings-invoices\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/checkout\/confirm-order\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/checkout\/cashier\/messages\.json/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/support\/after-sales\/messages\.json/u);

  const main = read(`${appRoot}/lib/main.dart`);
  assert.match(main, /await SdkworkI18n\.load\(\)/u);

  const pubspec = read(`${appRoot}/pubspec.yaml`);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/support\/help\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/buyer-hub\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/membership\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/storefront\/home\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/catalog\/product-detail\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/wallet\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/messages\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/catalog\/search\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/account-pages\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/order\/detail\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/marketing\/pages\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/account\/settings-invoices\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/checkout\/confirm-order\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/checkout\/cashier\/messages\.json/u);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/support\/after-sales\/messages\.json/u);
});

test("migrated pages resolve every string from the catalogue", () => {
  const helpPage = read(`${appRoot}/lib/pages/help_page.dart`);
  assert.match(helpPage, /SdkworkI18n\.t\('help\.title'\)/u);
  assert.match(helpPage, /SdkworkI18n\.t\(section\.titleKey\)/u);
  assert.match(helpPage, /SdkworkI18n\.t\(itemKey\)/u);
  assert.match(helpPage, /SdkworkI18n\.t\(link\.labelKey\)/u);

  const buyerPage = read(`${appRoot}/lib/pages/buyer_page.dart`);
  assert.match(buyerPage, /SdkworkI18n\.t\('buyerHub\.sections\.orders'\)/u);
  assert.match(buyerPage, /SdkworkI18n\.t\(labelKey\)/u);
  assert.match(buyerPage, /SdkworkI18n\.t\(shortcut\.labelKey\)/u);
  assert.match(buyerPage, /icon: Icons\.[a-z0-9_]+/u);
  assert.match(buyerPage, /SdkworkI18n\.t\('buyerHub\.logout\.confirm'\)/u);

  const settingsPage = read(`${appRoot}/lib/pages/settings_and_invoices.dart`);
  assert.match(settingsPage, /SdkworkI18n\.t\('invoices\.title'\)/u);
  assert.match(settingsPage, /SdkworkI18n\.t\('invoices\.titleRequired'\)/u);
  assert.match(settingsPage, /SdkworkI18n\.t\(statusKey\)/u);
  assert.match(settingsPage, /SdkworkI18n\.t\('settings\.logoutConfirm'\)/u);

  const checkoutPage = read(`${appRoot}/lib/pages/checkout_page.dart`);
  assert.match(checkoutPage, /SdkworkI18n\.t\('checkout\.title'\)/u);
  assert.match(checkoutPage, /SdkworkI18n\.t\(\s*'checkout\.selectedCount'/u);
  assert.match(checkoutPage, /SdkworkI18n\.t\(method\['labelKey'\]!\)/u);
  assert.match(checkoutPage, /SdkworkI18n\.t\('checkout\.invoice\.taxInvalid'\)/u);

  const afterSalesPage = read(`${appRoot}/lib/pages/after_sales_page.dart`);
  assert.match(afterSalesPage, /SdkworkI18n\.t\('afterSales\.page\.title'\)/u);
  assert.match(afterSalesPage, /SdkworkI18n\.t\(preset\['labelKey'\]!\)/u);
  assert.match(afterSalesPage, /SdkworkI18n\.t\(carrier\['nameKey'\]!\)/u);
  assert.match(afterSalesPage, /SdkworkI18n\.t\('afterSales\.errors\.submitted'\)/u);

  const homePage = read(`${appRoot}/lib/pages/home_page.dart`);
  assert.match(homePage, /'titleKey': 'home\.banners\.quality\.title'/u);
  assert.match(homePage, /SdkworkI18n\.t\('home\.seckill\.titleMatch'\)/u);
  assert.match(homePage, /'labelKey': 'home\.quick\.categories'/u);
  assert.match(homePage, /SdkworkI18n\.t\('home\.seckill\.ongoing'\)/u);

  const productPage = read(`${appRoot}/lib/pages/product_page.dart`);
  assert.match(productPage, /SdkworkI18n\.t\('productDetail\.title'\)/u);
  assert.match(productPage, /'productDetail\.stats\.sales'/u);
  assert.match(productPage, /'productDetail\.toast\.addedPickCheckout'/u);
  assert.match(productPage, /'productDetail\.actions\.buyNow'/u);

  const accountPages = read(`${appRoot}/lib/pages/account_pages.dart`);
  assert.match(accountPages, /SdkworkI18n\.t\('wallet\.title'\)/u);
  assert.match(accountPages, /SdkworkI18n\.t\(\s*'points\.expires'/u);
  assert.match(accountPages, /SdkworkI18n\.t\('points\.ledgerEmpty'\)/u);

  const marketingPages = read(`${appRoot}/lib/pages/marketing_pages.dart`);
  assert.match(marketingPages, /SdkworkI18n\.t\('marketing\.shop\.title'\)/u);
  assert.match(marketingPages, /'marketing\.activity\.types\.flashSale'/u);
  assert.match(marketingPages, /'marketing\.activity\.phase\.active'/u);
  assert.match(marketingPages, /SdkworkI18n\.t\('marketing\.activity\.detailTitle'\)/u);

  const searchPage = read(`${appRoot}/lib/pages/search_page.dart`);
  assert.match(searchPage, /SdkworkI18n\.t\('search\.hint'\)/u);
  assert.match(searchPage, /'search\.sort\.sales'/u);
  assert.match(searchPage, /'search\.hotKeywords\.phone'/u);
  assert.match(searchPage, /'search\.allShown'/u);

  const orderDetailPage = read(`${appRoot}/lib/pages/order_detail_page.dart`);
  assert.match(orderDetailPage, /SdkworkI18n\.t\('orderDetail\.title'\)/u);
  assert.match(orderDetailPage, /'orderDetail\.actions\.pay'/u);
  assert.match(orderDetailPage, /'orderDetail\.paidAmount'/u);
  assert.match(orderDetailPage, /'orderDetail\.notFound'/u);

  const buyerAccountPages = read(`${appRoot}/lib/pages/buyer_account_pages.dart`);
  assert.match(buyerAccountPages, /SdkworkI18n\.t\('accountPages\.giftCards\.title'\)/u);
  assert.match(buyerAccountPages, /'accountPages\.profile\.securityTitle'/u);
  assert.match(buyerAccountPages, /'accountPages\.security\.settingsTitle'/u);
  assert.match(buyerAccountPages, /SdkworkI18n\.t\('accountPages\.loginNow'\)/u);

  for (const pagePath of [
    `${appRoot}/lib/pages/help_page.dart`,
    `${appRoot}/lib/pages/buyer_page.dart`,
    `${appRoot}/lib/pages/settings_and_invoices.dart`,
    `${appRoot}/lib/pages/checkout_page.dart`,
    `${appRoot}/lib/pages/after_sales_page.dart`,
    `${appRoot}/lib/pages/home_page.dart`,
    `${appRoot}/lib/pages/product_page.dart`,
    `${appRoot}/lib/pages/account_pages.dart`,
    `${appRoot}/lib/pages/marketing_pages.dart`,
    `${appRoot}/lib/pages/search_page.dart`,
    `${appRoot}/lib/pages/order_detail_page.dart`,
    `${appRoot}/lib/pages/buyer_account_pages.dart`,
  ]) {
    const page = read(pagePath);
    const literalChinese = [...page.matchAll(/'[^'\n]*[\u4e00-\u9fff][^'\n]*'/gu)].map(
      (match) => match[0],
    );
    assert.deepEqual(literalChinese, [], `${pagePath} must not inline Chinese copy`);
  }
});
