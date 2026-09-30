import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const mallRoot = path.join(workspaceRoot, "apps", "sdkwork-mall-pc");
const mallPackagesRoot = path.join(mallRoot, "packages");

const mallApplicationRequiredPaths = [
  "AGENTS.md",
  "sdkwork.app.config.json",
  "sdkwork.workflow.json",
  "specs/component.spec.json",
  "src/App.tsx",
  "src/AppRoutes.tsx",
  "src/AuthGate.tsx",
  "src/bootstrap/routes.ts",
  "src/bootstrap/runtime.ts",
  "src/bootstrap/sdkClients.ts",
  "src/bootstrap/iamRuntime.ts",
  "package.json",
  "vite.config.ts",
  "tsconfig.json",
];

const activeMallPackages = [
  "sdkwork-mall-pc-core",
  "sdkwork-mall-pc-commons",
  "sdkwork-mall-pc-shell",
  "sdkwork-mall-pc-home",
  "sdkwork-mall-pc-search",
  "sdkwork-mall-pc-catalog",
  "sdkwork-mall-pc-cart",
  "sdkwork-mall-pc-shop",
  "sdkwork-mall-pc-activity",
  "sdkwork-mall-pc-commerce",
  "sdkwork-mall-pc-order",
  "sdkwork-mall-pc-after-sales",
  "sdkwork-mall-pc-address",
  "sdkwork-mall-pc-reviews",
  "sdkwork-mall-pc-messages",
  "sdkwork-mall-pc-wallet",
  "sdkwork-mall-pc-coupon",
  "sdkwork-mall-pc-membership",
  "sdkwork-mall-pc-invoice",
  "sdkwork-mall-pc-points",
  "sdkwork-mall-pc-merchant",
  "sdkwork-mall-pc-admin-core",
  "sdkwork-mall-pc-admin-shell",
  "sdkwork-mall-pc-admin-shops",
  "sdkwork-mall-pc-admin-orders",
  "sdkwork-mall-pc-admin-marketing",
  "sdkwork-mall-pc-admin-reports",
  "sdkwork-mall-pc-admin-product",
  "sdkwork-mall-pc-admin-membership",
  "sdkwork-mall-pc-cms",
  "sdkwork-mall-pc-admin-risk",
  "sdkwork-mall-pc-admin-settlement",
  "sdkwork-mall-pc-admin-permissions",
];

const inactiveMallPackages = [
  "sdkwork-mall-pc-billing",
  "sdkwork-mall-pc-checkout",
  "sdkwork-mall-pc-entitlement",
  "sdkwork-mall-pc-offer",
  "sdkwork-mall-pc-payment",
  "sdkwork-mall-pc-pricing",
  "sdkwork-mall-pc-subscription",
  "sdkwork-mall-pc-membership-purchase",
];

const MALL_DOMAIN_MIGRATED_PACKAGES = [
  "sdkwork-mall-pc-wallet",
  "sdkwork-mall-pc-order",
  "sdkwork-mall-pc-membership",
  "sdkwork-mall-pc-coupon",
  "sdkwork-mall-pc-payment",
  "sdkwork-mall-pc-points",
  "sdkwork-mall-pc-offer",
  "sdkwork-mall-pc-subscription",
  "sdkwork-mall-pc-membership-purchase",
  "sdkwork-mall-pc-checkout",
  "sdkwork-mall-pc-pricing",
  "sdkwork-mall-pc-billing",
  "sdkwork-mall-pc-invoice",
  "sdkwork-mall-pc-address",
  "sdkwork-mall-pc-shop",
  "sdkwork-mall-pc-home",
  "sdkwork-mall-pc-search",
  "sdkwork-mall-pc-catalog",
  "sdkwork-mall-pc-activity",
  "sdkwork-mall-pc-reviews",
  "sdkwork-mall-pc-messages",
  "sdkwork-mall-pc-after-sales",
  "sdkwork-mall-pc-cart",
  "sdkwork-mall-pc-cms",
  "sdkwork-mall-pc-merchant",
  "sdkwork-mall-pc-admin-shops",
  "sdkwork-mall-pc-admin-settlement",
  "sdkwork-mall-pc-admin-risk",
  "sdkwork-mall-pc-admin-reports",
  "sdkwork-mall-pc-admin-orders",
  "sdkwork-mall-pc-admin-marketing",
  "sdkwork-mall-pc-admin-product",
  "sdkwork-mall-pc-admin-membership",
  "sdkwork-mall-pc-admin-permissions",
  "sdkwork-mall-pc-commerce",
];

const buyerPageSubpathExports = [
  ["sdkwork-mall-pc-commerce", "buyer-dashboard-page"],
  ["sdkwork-mall-pc-commerce", "buyer-favorites-page"],
  ["sdkwork-mall-pc-commerce", "buyer-profile-page"],
  ["sdkwork-mall-pc-commerce", "buyer-security-page"],
  ["sdkwork-mall-pc-commerce", "buyer-gift-cards-page"],
  ["sdkwork-mall-pc-address", "buyer-pages"],
  ["sdkwork-mall-pc-after-sales", "buyer-pages"],
  ["sdkwork-mall-pc-reviews", "buyer-pages"],
  ["sdkwork-mall-pc-messages", "buyer-pages"],
  ["sdkwork-mall-pc-order", "order-page"],
  ["sdkwork-mall-pc-wallet", "wallet-page"],
  ["sdkwork-mall-pc-coupon", "coupon-page"],
  ["sdkwork-mall-pc-membership", "membership-page"],
  ["sdkwork-mall-pc-invoice", "invoice-page"],
  ["sdkwork-mall-pc-points", "points-page"],
];

const routePageSubpathExports = [
  ["sdkwork-mall-pc-home", "storefront-pages"],
  ["sdkwork-mall-pc-search", "storefront-pages"],
  ["sdkwork-mall-pc-catalog", "storefront-pages"],
  ["sdkwork-mall-pc-cart", "storefront-pages"],
  ["sdkwork-mall-pc-shop", "storefront-pages"],
  ["sdkwork-mall-pc-activity", "storefront-pages"],
  ["sdkwork-mall-pc-merchant", "merchant-pages"],
  ["sdkwork-mall-pc-cms", "admin-pages"],
  ["sdkwork-mall-pc-admin-risk", "admin-pages"],
  ["sdkwork-mall-pc-admin-settlement", "admin-pages"],
  ["sdkwork-mall-pc-admin-permissions", "admin-pages"],
  ["sdkwork-mall-pc-admin-reports", "admin-dashboard-page"],
  ["sdkwork-mall-pc-admin-reports", "admin-reports-page"],
  ["sdkwork-mall-pc-admin-reports", "admin-audit-page"],
  ["sdkwork-mall-pc-admin-shops", "admin-shops-page"],
  ["sdkwork-mall-pc-admin-shops", "admin-governance-pages"],
  ["sdkwork-mall-pc-admin-orders", "admin-pages"],
  ["sdkwork-mall-pc-admin-marketing", "admin-pages"],
  ["sdkwork-mall-pc-admin-membership", "membership-admin-page"],
  ["sdkwork-mall-pc-admin-product", "catalog-admin"],
  ...buyerPageSubpathExports,
];

const crossPackageServiceSubpathImports = [
  ["sdkwork-mall-pc-home", "@sdkwork/mall-pc-search/search-service"],
  ["sdkwork-mall-pc-home", "@sdkwork/mall-pc-reviews/footprint-service"],
  ["sdkwork-mall-pc-catalog", "@sdkwork/mall-pc-search/search-service"],
  ["sdkwork-mall-pc-catalog", "@sdkwork/mall-pc-reviews/footprint-service"],
  ["sdkwork-mall-pc-cart", "@sdkwork/mall-pc-search/search-service"],
  ["sdkwork-mall-pc-shop", "@sdkwork/mall-pc-search/search-service"],
  ["sdkwork-mall-pc-shop", "@sdkwork/mall-pc-commerce/favorites-service"],
  ["sdkwork-mall-pc-search", "@sdkwork/mall-pc-commons/category-nav"],
  ["sdkwork-mall-pc-activity", "@sdkwork/mall-pc-search/search-service"],
  ["sdkwork-mall-pc-catalog", "@sdkwork/mall-pc-commerce/favorites-service"],
];

const requiredRouteIds = [
  "storefront.mall.home",
  "storefront.mall.search",
  "storefront.mall.cart",
  "storefront.mall.checkout",
  "buyer.mall.dashboard",
  "buyer.mall.profile",
  "buyer.mall.gift-cards",
  "buyer.mall.orders",
  "merchant.mall.dashboard",
  "merchant.mall.inventory",
  "merchant.mall.fulfillment",
  "merchant.mall.settings",
  "admin.mall.dashboard",
  "admin.mall.cms",
  "admin.mall.risk",
  "admin.mall.settlement",
  "admin.mall.permissions",
  "admin.mall.users",
  "admin.mall.brands",
  "admin.mall.moderation",
];

function read(relativePath) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function collectRouteIdsFromPackages() {
  const routeIds = [];
  for (const directory of activeMallPackages) {
    const routesPath = path.join(mallPackagesRoot, directory, "src", "routes.ts");
    if (!existsSync(routesPath)) {
      continue;
    }
    const source = readFileSync(routesPath, "utf8");
    for (const match of source.matchAll(/id:\s*"([^"]+)"/g)) {
      routeIds.push(match[1]);
    }
  }
  return routeIds;
}

function collectFiles(root, predicate) {
  if (!existsSync(root)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    // Never follow symlinked directories: workspace node_modules links point
    // into sibling repositories and pnpm store chains that are not source
    // trees and can reject stat on Windows (errno -4094).
    if (entry.isSymbolicLink()) {
      continue;
    }
    let isDirectory = false;
    try {
      isDirectory = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }
    if (isDirectory) {
      files.push(...collectFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

test("mall PC application root is registered and manifest-driven", () => {
  const pnpmWorkspace = read("pnpm-workspace.yaml");
  assert.match(pnpmWorkspace, /-\s+"apps\/sdkwork-mall-pc"/);
  assert.match(pnpmWorkspace, /-\s+"apps\/sdkwork-mall-pc\/packages\/\*"/);

  for (const relativePath of mallApplicationRequiredPaths) {
    assert.equal(existsSync(path.join(mallRoot, relativePath)), true, `apps/sdkwork-mall-pc/${relativePath} must exist`);
  }

  const manifest = readJson("apps/sdkwork-mall-pc/sdkwork.app.config.json");
  assert.equal(manifest.app?.key, "sdkwork-mall-pc");
  assert.equal(manifest.runtime?.family, "web");
  assert.equal(manifest.runtime?.framework, "react");

  const packageJson = readJson("apps/sdkwork-mall-pc/package.json");
  assert.equal(packageJson.name, "@sdkwork/mall-pc-app");
  assert.match(packageJson.scripts?.dev, /5175/);
});

test("mall PC active packages use canonical names and route surfaces", () => {
  for (const directory of activeMallPackages) {
    const packageJsonPath = path.join("apps/sdkwork-mall-pc/packages", directory, "package.json");
    assert.equal(existsSync(path.join(workspaceRoot, packageJsonPath)), true, `${directory} package.json must exist`);
    const packageJson = readJson(packageJsonPath);
    const expectedName = `@sdkwork/${directory.replace(/^sdkwork-/, "")}`;
    assert.equal(packageJson.name, expectedName, `${directory} package name must be ${expectedName}`);
    const routesPath = path.join(mallPackagesRoot, directory, "src", "routes.ts");
    if (existsSync(routesPath)) {
      assert.equal(
        packageJson.exports?.["./routes"]?.import,
        "./src/routes.ts",
        `${directory} must expose ./routes export for lazy route screens`,
      );
    }
  }

  const routeIds = collectRouteIdsFromPackages();
  for (const routeId of requiredRouteIds) {
    assert.equal(routeIds.includes(routeId), true, `active mall routes must include ${routeId}`);
  }

  const routesSource = read("apps/sdkwork-mall-pc/src/bootstrap/routes.ts");
  for (const line of routesSource.split("\n")) {
    if (!line.includes('from "@sdkwork/mall-pc-')) {
      continue;
    }
    if (line.includes("@sdkwork/mall-pc-admin-shell") || line.includes("@sdkwork/mall-pc-core")) {
      continue;
    }
    assert.match(line, /\/routes"/, `route registry must import /routes subpaths: ${line.trim()}`);
  }
  for (const exportName of [
    "sdkworkMallPcCmsRoutes",
    "sdkworkMallPcAdminRiskRoutes",
    "sdkworkMallPcAdminSettlementRoutes",
    "sdkworkMallPcAdminPermissionsRoutes",
  ]) {
    assert.match(routesSource, new RegExp(exportName), `routes registry must import ${exportName}`);
  }

  const appRoutesSource = read("apps/sdkwork-mall-pc/src/AppRoutes.tsx");
  for (const routeId of requiredRouteIds) {
    assert.match(appRoutesSource, new RegExp(`case "${routeId.replaceAll(".", "\\.")}"`), `AppRoutes must handle ${routeId}`);
  }

  for (const routeId of routeIds) {
    assert.match(
      appRoutesSource,
      new RegExp(`case "${routeId.replaceAll(".", "\\.")}"`),
      `AppRoutes must handle every active package route id: ${routeId}`,
    );
  }
});

test("mall PC composition root delegates shell layout and SDK integration", () => {
  const appSource = read("apps/sdkwork-mall-pc/src/App.tsx");
  assert.match(appSource, /@sdkwork\/mall-pc-shell/);
  assert.match(appSource, /isAuthenticated/);
  assert.equal(appSource.includes("sdkwork-mall-pc-nav"), false, "root App.tsx must not own admin nav markup");

  const sdkClientsSource = read("apps/sdkwork-mall-pc/src/bootstrap/sdkClients.ts");
  assert.match(sdkClientsSource, /@sdkwork\/mall-pc-core/);
  assert.match(sdkClientsSource, /@sdkwork\/cloudrouter-app-sdk\/domains/);

  const runtimeSource = read("apps/sdkwork-mall-pc/src/bootstrap/runtime.ts");
  assert.match(runtimeSource, /@sdkwork\/mall-commerce-service/);

  const commerceProvidersSource = read("apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts");
  assert.doesNotMatch(commerceProvidersSource, /@sdkwork\/commerce-runtime/);
  assert.match(commerceProvidersSource, /createSdkworkCommerceService/);
  assert.match(commerceProvidersSource, /configureSdkworkMallPcCommerceBuyerHubRemotePort/);

  const domainProvidersSource = read("apps/sdkwork-mall-pc/src/bootstrap/domain-service-providers.ts");
  assert.match(domainProvidersSource, /@sdkwork\/account-service/);
  assert.match(domainProvidersSource, /@sdkwork\/order-service/);
  assert.match(domainProvidersSource, /@sdkwork\/membership-service/);
  assert.match(domainProvidersSource, /@sdkwork\/payment-service/);

  const paymentServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts");
  assert.match(paymentServiceSource, /@sdkwork\/payment-service/);
  assert.doesNotMatch(paymentServiceSource, /@sdkwork\/mall-commerce-service/);

  const couponServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts");
  assert.match(couponServiceSource, /@sdkwork\/promotion-service/);
  assert.doesNotMatch(couponServiceSource, /@sdkwork\/mall-commerce-service/);

  const membershipServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-membership/src/membership-service.ts");
  assert.match(membershipServiceSource, /@sdkwork\/membership-service/);
  assert.doesNotMatch(membershipServiceSource, /@sdkwork\/mall-commerce-service/);

  const checkoutServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-checkout/src/checkout-service.ts");
  assert.doesNotMatch(checkoutServiceSource, /@sdkwork\/mall-commerce-service/);
  assert.match(checkoutServiceSource, /@sdkwork\/mall-pc-order/);
  assert.match(checkoutServiceSource, /@sdkwork\/mall-pc-payment/);

  const billingServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-billing/src/billing-service.ts");
  assert.match(billingServiceSource, /@sdkwork\/account-service/);
  assert.match(billingServiceSource, /@sdkwork\/payment-service/);
  assert.doesNotMatch(billingServiceSource, /commerceService\?:/);

  const walletServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-wallet/src/wallet-service.ts");
  assert.match(walletServiceSource, /@sdkwork\/account-service/);
  assert.doesNotMatch(walletServiceSource, /@sdkwork\/mall-commerce-service/);

  const orderServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts");
  assert.match(orderServiceSource, /@sdkwork\/order-service/);
  assert.doesNotMatch(orderServiceSource, /@sdkwork\/mall-commerce-service/);

  const mallAppPackageJson = readJson("apps/sdkwork-mall-pc/package.json");
  assert.equal(mallAppPackageJson.dependencies["@sdkwork/commerce-runtime"], undefined);

  const shellSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-shell/src/index.tsx");
  assert.match(shellSource, /isAuthenticated/);
  assert.match(shellSource, /我的账户/);
  for (const surface of ["storefront", "buyer", "merchant", "backend-admin"]) {
    assert.match(shellSource, new RegExp(surface), `mall shell must recognize ${surface} surface`);
  }
});

test("mall PC active packages avoid raw HTTP transport", () => {
  const violations = [];
  for (const directory of activeMallPackages) {
    const srcRoot = path.join(mallPackagesRoot, directory, "src");
    const sourceFiles = collectFiles(srcRoot, (filePath) => /\.(ts|tsx)$/.test(filePath));
    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, "utf8");
      if (/\bfetch\s*\(/.test(source) || /\baxios\b/.test(source)) {
        violations.push(path.relative(workspaceRoot, filePath).replaceAll("\\", "/"));
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("mall PC CMS remote persistence and route permission guards are wired", () => {
  const cmsServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cms/src/cms-service.ts");
  assert.match(cmsServiceSource, /MALL_CMS_OFFER_MARKER/);
  assert.match(cmsServiceSource, /loadMallCmsConfigRemote/);
  assert.match(cmsServiceSource, /saveMallCmsConfigRemote/);
  assert.match(cmsServiceSource, /getSdkworkCmsRemotePort/);
  assert.match(cmsServiceSource, /createAdminPromotionOffer/);
  assert.match(cmsServiceSource, /updateAdminPromotionOffer/);
  assert.doesNotMatch(cmsServiceSource, /@sdkwork\/mall-commerce-service/);

  const routePermissionsSource = read("apps/sdkwork-mall-pc/src/routePermissions.ts");
  assert.match(routePermissionsSource, /hasSdkworkMallPcRoutePermission/);
  assert.match(routePermissionsSource, /@sdkwork\/mall-pc-admin-permissions/);

  const appRoutesSource = read("apps/sdkwork-mall-pc/src/AppRoutes.tsx");
  assert.match(appRoutesSource, /hasSdkworkMallPcRoutePermission/);
  assert.match(appRoutesSource, /无权访问/);
  assert.match(appRoutesSource, /@sdkwork\/mall-pc-commerce\/buyer-dashboard-page/);

  const activityServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-activity/src/activity-service.ts");
  assert.match(activityServiceSource, /MALL_CMS_OFFER_MARKER/);
  assert.match(activityServiceSource, /@sdkwork\/mall-pc-cms\/cms-service/);
  assert.match(activityServiceSource, /getSdkworkActivityRemotePort/);
  assert.match(activityServiceSource, /listPromotionOffers/);

  const addressServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-address/src/address-service.ts");
  assert.match(addressServiceSource, /createSdkworkAddressService/);
  assert.match(addressServiceSource, /getSdkworkAddressRemotePort/);
  assert.match(addressServiceSource, /createAddress/);
  assert.match(addressServiceSource, /updateAddress/);
  assert.match(addressServiceSource, /deleteAddress/);

  const addressPageSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-address/src/pages/AddressPage.tsx");
  assert.match(addressPageSource, /createSdkworkAddressService/);
  assert.doesNotMatch(addressPageSource, /@sdkwork\/mall-commerce-service/);

  const merchantSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-merchant/src/pages/MerchantPage.tsx");
  assert.match(merchantSource, /shops\.current\.inventory\.stocks\.list/);
  assert.match(merchantSource, /shops\.current\.orders\.fulfillments\.create/);
  assert.match(merchantSource, /afterSales\.requests\.retrieve/);
  assert.match(merchantSource, /shops\.current\.orders\.list/);
  assert.match(merchantSource, /客服中心/);
  assert.match(merchantSource, /shops\.current\.categoryBindings\.list/);
  assert.match(merchantSource, /设置中心/);
  assert.match(merchantSource, /customerServices\.list/);
  assert.match(merchantSource, /brandAuthorizations\.list/);
  assert.match(merchantSource, /qualifications\.list/);
  assert.match(merchantSource, /readiness\.retrieve/);
  assert.match(merchantSource, /shippingTemplates\.list/);
  assert.match(merchantSource, /returnAddresses\.list/);
  assert.match(merchantSource, /depositAccount\.retrieve/);
  assert.match(merchantSource, /products\.publish/);
  assert.match(merchantSource, /shops\.current\.orders\.retrieve/);
  assert.match(merchantSource, /fulfillmentProfile\.retrieve/);
  assert.match(merchantSource, /businessHours\.retrieve/);

  const appRoutesLoadingSource = read("apps/sdkwork-mall-pc/src/AppRoutes.tsx");
  assert.match(appRoutesLoadingSource, /加载中/);

  const catalogServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-catalog/src/catalog-service.ts");
  assert.match(catalogServiceSource, /loadMallProductCoupons/);
  assert.match(catalogServiceSource, /getSdkworkCatalogRemotePort/);
  assert.match(catalogServiceSource, /listPromotionOffers/);
  assert.match(catalogServiceSource, /retrieveMallCategory/);

  const catalogPageSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-catalog/src/pages/CatalogPage.tsx");
  assert.match(catalogPageSource, /retrieveMallCategory/);
  assert.doesNotMatch(catalogPageSource, /@sdkwork\/mall-commerce-service/);
  assert.match(catalogPageSource, /@sdkwork\/mall-pc-commerce\/favorites-service/);

  const adminShopsSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-shops/src/pages/AdminGovernancePages.tsx");
  assert.match(adminShopsSource, /admin\.shops\.brandAuthorizations\.list/);
  assert.match(adminShopsSource, /用户中心/);

  const searchSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-search/src/pages/SearchPage.tsx");
  assert.match(searchSource, /shopId/);
  assert.match(searchSource, /热卖推荐/);
  assert.match(searchSource, /最低价/);
  assert.match(searchSource, /相关店铺/);

  const homeSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-home/src/home-service.ts");
  assert.match(homeSource, /getSdkworkHomeRemotePort/);
  assert.match(homeSource, /listShops/);
  assert.match(homeSource, /featuredShops/);

  const homePageSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-home/src/pages/HomePage.tsx");
  assert.match(homePageSource, /featuredShops/);
  assert.match(homePageSource, /@sdkwork\/mall-pc-cms\/cms-config/);
  assert.match(homePageSource, /@sdkwork\/mall-pc-search\/search-service/);
  assert.match(homePageSource, /@sdkwork\/mall-pc-reviews\/footprint-service/);

  const searchServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-search/src/search-service.ts");
  assert.match(searchServiceSource, /searchMallShops/);
  assert.match(searchServiceSource, /getSdkworkSearchRemotePort/);
  assert.match(searchServiceSource, /listShops/);

  const cartServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/cart-service.ts");
  assert.match(cartServiceSource, /getSdkworkCartRemotePort/);
  assert.doesNotMatch(cartServiceSource, /@sdkwork\/mall-commerce-service/);

  const cartPageSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/pages/CartPage.tsx");
  assert.match(cartPageSource, /retrieveMallOrderPaymentSuccess/);
  assert.match(cartPageSource, /retryMallOrderPayment/);
  assert.doesNotMatch(cartPageSource, /@sdkwork\/mall-commerce-service/);

  const adminOrdersSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-orders/src/pages/AdminOrdersPage.tsx");
  assert.match(adminOrdersSource, /getSdkworkAdminRemotePort/);
  assert.match(adminOrdersSource, /orders\.management\.retrieve/);
  assert.match(adminOrdersSource, /afterSales\.reviews\.create/);

  const buyerDashboardSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-commerce/src/pages/BuyerDashboardPage.tsx");
  assert.match(buyerDashboardSource, /loadMallBuyerDashboardSnapshot/);
  assert.doesNotMatch(buyerDashboardSource, /@sdkwork\/mall-commerce-service/);

  const buyerHubServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-commerce/src/buyer-hub-service.ts");
  assert.match(buyerHubServiceSource, /getSdkworkCommerceRemotePort/);
  assert.match(buyerHubServiceSource, /orders\.statistics\.retrieve/);
  assert.doesNotMatch(buyerHubServiceSource, /@sdkwork\/mall-commerce-service/);

  const buyerFavoritesSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-commerce/src/pages/BuyerFavoritesPage.tsx");
  assert.match(buyerFavoritesSource, /关注店铺/);

  const buyerGiftCardsSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-commerce/src/pages/BuyerGiftCardsPage.tsx");
  assert.match(buyerGiftCardsSource, /SdkworkMallGiftCardsPage/);

  const afterSalesSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-after-sales/src/after-sales-service.ts");
  assert.match(afterSalesSource, /getSdkworkAfterSalesRemotePort/);
  assert.match(afterSalesSource, /retrieveAfterSalesRequest/);
  assert.match(afterSalesSource, /listAfterSalesEvents/);
  assert.match(afterSalesSource, /listReturnShipments/);

  const reviewsServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-reviews/src/reviews-service.ts");
  assert.match(reviewsServiceSource, /getSdkworkReviewsRemotePort/);
  assert.match(reviewsServiceSource, /loadMallPendingReviewOrders/);

  const messagesServiceSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-messages/src/messages-service.ts");
  assert.match(messagesServiceSource, /getSdkworkMessagesRemotePort/);
  assert.match(messagesServiceSource, /loadMallMessageCenterRows/);

  const shopSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-shop/src/pages/ShopPage.tsx");
  assert.match(shopSource, /toggleMallShopFavorite/);
  assert.match(shopSource, /@sdkwork\/mall-pc-commerce\/favorites-service/);

  const adminReportsSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-reports/src/pages/AdminReportsListPage.tsx");
  assert.match(adminReportsSource, /commerceReports\.refunds\.list/);
});

const moduleScaffoldOwnership = {
  "order-service.ts": "sdkwork-mall-pc-order",
  "order-controller.ts": "sdkwork-mall-pc-order",
  "order-copy.ts": "sdkwork-mall-pc-order",
  "order-appearance.ts": "sdkwork-mall-pc-order",
  "order-intl.tsx": "sdkwork-mall-pc-order",
  "order.ts": "sdkwork-mall-pc-order",
  "pages/OrderPage.tsx": "sdkwork-mall-pc-order",
  "home-service.ts": "sdkwork-mall-pc-home",
  "pages/HomePage.tsx": "sdkwork-mall-pc-home",
};

test("mall PC active packages must not duplicate module scaffold files", () => {
  const violations = [];

  for (const directory of activeMallPackages) {
    for (const [relativePath, ownerPackage] of Object.entries(moduleScaffoldOwnership)) {
      if (directory === ownerPackage) {
        continue;
      }
      const fullPath = path.join(mallPackagesRoot, directory, "src", relativePath);
      if (existsSync(fullPath)) {
        violations.push(`${directory}/src/${relativePath}`);
      }
    }

    const testsRoot = path.join(mallPackagesRoot, directory, "tests");
    if (directory !== "sdkwork-mall-pc-order" && existsSync(testsRoot)) {
      const duplicateOrderTests = collectFiles(testsRoot, (filePath) => /[/\\]order(?:\.|$)/.test(filePath));
      for (const filePath of duplicateOrderTests) {
        violations.push(path.relative(workspaceRoot, filePath).replaceAll("\\", "/"));
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("mall PC app root excludes inactive SaaS legacy packages from direct dependencies", () => {
  const packageJson = readJson("apps/sdkwork-mall-pc/package.json");
  const dependencyNames = Object.keys(packageJson.dependencies ?? {});

  for (const directory of inactiveMallPackages) {
    const packageName = `@sdkwork/${directory.replace(/^sdkwork-/, "")}`;
    assert.equal(
      dependencyNames.includes(packageName),
      false,
      `apps/sdkwork-mall-pc must not directly depend on inactive legacy package ${packageName}`,
    );
  }
});

test("mall PC route screens lazy-load dedicated page subpaths", () => {
  const appRoutesSource = read("apps/sdkwork-mall-pc/src/AppRoutes.tsx");
  assert.doesNotMatch(appRoutesSource, /import \{ CatalogAdmin \} from "@sdkwork\/mall-pc-admin-product"/);

  for (const match of appRoutesSource.matchAll(/import\("(@sdkwork\/mall-pc-[^"]+)"\)/g)) {
    const spec = match[1];
    assert.match(
      spec,
      /\/[^/]+$/,
      `AppRoutes lazy import must use a page subpath, not package root: ${spec}`,
    );
  }

  for (const [directory, exportName] of routePageSubpathExports) {
    const packageJson = readJson(`apps/sdkwork-mall-pc/packages/${directory}/package.json`);
    const packageSlug = `@sdkwork/${directory.replace(/^sdkwork-/, "")}`;
    assert.equal(
      packageJson.exports?.[`./${exportName}`]?.import != null,
      true,
      `${directory} must expose ./${exportName}`,
    );
    assert.match(
      appRoutesSource,
      new RegExp(`${packageSlug.replaceAll("/", "\\/")}\\/${exportName}`),
      `AppRoutes must lazy-load ${packageSlug}/${exportName}`,
    );
  }
});

test("mall PC active packages use service subpaths for cross-package imports", () => {
  const violations = [];
  const allowedRootImports = new Set([
    "@sdkwork/mall-pc-core",
    "@sdkwork/mall-pc-commons",
    "@sdkwork/mall-pc-admin-core",
    "@sdkwork/mall-commerce-service",
    "@sdkwork/ui-pc-react",
  ]);

  for (const directory of activeMallPackages) {
    const pagesRoot = path.join(mallPackagesRoot, directory, "src", "pages");
    if (!existsSync(pagesRoot)) {
      continue;
    }
    const pageFiles = collectFiles(pagesRoot, (filePath) => /\.(ts|tsx)$/.test(filePath));
    for (const filePath of pageFiles) {
      const source = readFileSync(filePath, "utf8");
      for (const match of source.matchAll(/from "(@sdkwork\/mall-pc-[^"]+)"/g)) {
        const spec = match[1];
        if (allowedRootImports.has(spec) || spec.includes("/")) {
          continue;
        }
        violations.push(`${path.relative(workspaceRoot, filePath).replaceAll("\\", "/")} -> ${spec}`);
      }
    }
  }

  assert.deepEqual(violations, []);

  for (const [directory, expectedImport] of crossPackageServiceSubpathImports) {
    const pagesRoot = path.join(mallPackagesRoot, directory, "src", "pages");
    const pageFiles = collectFiles(pagesRoot, (filePath) => /\.(ts|tsx)$/.test(filePath));
    const hasExpectedImport = pageFiles.some((filePath) => readFileSync(filePath, "utf8").includes(expectedImport));
    assert.equal(
      hasExpectedImport,
      true,
      `${directory} pages must import ${expectedImport}`,
    );
  }

  const commerceIndexSource = read("apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-commerce/src/index.ts");
  assert.doesNotMatch(commerceIndexSource, /mall-commerce-service/);
  assert.doesNotMatch(commerceIndexSource, /CommercePage/);
  assert.doesNotMatch(commerceIndexSource, /BuyerPages/);
  assert.match(commerceIndexSource, /favorites-service/);
});

test("mall workspace metadata and packaging contract align with sdkwork-mall ownership", () => {
  const workflow = readJson("apps/sdkwork-mall-pc/sdkwork.workflow.json");
  assert.equal(workflow.app.repository, "sdkwork-ai/sdkwork-mall");
  assert.equal(workflow.app.sourcePath, "apps/sdkwork-mall-pc");

  const dependencyIds = (workflow.dependencies ?? []).map((dependency) => dependency.id);
  assert.equal(
    dependencyIds.includes("sdkwork-commerce"),
    false,
    "packaging workflow must not declare retired sdkwork-commerce dependency",
  );
  assert.equal(dependencyIds.includes("sdkwork-appbase"), true, "packaging workflow must declare sdkwork-appbase dependency");

  const appManifest = readJson("apps/sdkwork-mall-pc/sdkwork.app.config.json");
  assert.equal(appManifest.metadata?.standardOwner, "sdkwork-mall");
  assert.equal(appManifest.publish?.config?.managedBy, "sdkwork-mall");

  assert.equal(existsSync(path.join(workspaceRoot, ".github/workflows/verify.yml")), true);

  const staleCommercePcPaths = collectFiles(path.join(workspaceRoot, "apps"), (filePath) => {
    if (!/\.(ts|tsx|mjs|json|md|yml|yaml)$/.test(filePath)) {
      return false;
    }
    const source = readFileSync(filePath, "utf8");
    return source.includes("apps/sdkwork-commerce-pc/packages/sdkwork-mall-pc");
  }).map((filePath) => path.relative(workspaceRoot, filePath).replaceAll("\\", "/"));

  assert.deepEqual(staleCommercePcPaths, []);
});


test("mall markdown must not reference deleted commerce snapshot paths", () => {
  const legacyPatterns = [
    /sdkwork-commerce \(deleted\)/,
    /@sdkwork\/commerce-service(?!-)/,
    /apps\/sdkwork-commerce-pc\/packages\/sdkwork-mall-pc/,
  ];

  const violations = collectFiles(workspaceRoot, (filePath) => {
    if (!filePath.endsWith(".md") || filePath.includes(`${path.sep}node_modules${path.sep}`)) {
      return false;
    }
    const markdownSource = readFileSync(filePath, "utf8");
    return legacyPatterns.some((pattern) => pattern.test(markdownSource));
  }).map((filePath) => path.relative(workspaceRoot, filePath).replaceAll("\\", "/"));

  assert.deepEqual(violations, []);
});


test("mall domain-migrated packages must not declare stale mall-commerce-service peers", () => {
  const violations = [];

  for (const directory of MALL_DOMAIN_MIGRATED_PACKAGES) {
    const packageJson = readJson(`apps/sdkwork-mall-pc/packages/${directory}/package.json`);
    if (packageJson.peerDependencies?.["@sdkwork/mall-commerce-service"]) {
      violations.push(`${directory}: peerDependencies still declares @sdkwork/mall-commerce-service`);
    }
    if (packageJson.peerDependenciesMeta?.["@sdkwork/mall-commerce-service"]) {
      violations.push(`${directory}: peerDependenciesMeta still declares @sdkwork/mall-commerce-service`);
    }

    const servicePath = path.join(mallPackagesRoot, directory, "src", `${directory.replace("sdkwork-mall-pc-", "")}-service.ts`);
    if (existsSync(servicePath)) {
      const source = readFileSync(servicePath, "utf8");
      if (source.includes("@sdkwork/mall-commerce-service")) {
        violations.push(`${directory}/src: source still imports @sdkwork/mall-commerce-service`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("mall active packages declare sdkwork-mall workspace ownership", () => {
  const violations = [];

  for (const directory of [...activeMallPackages, ...inactiveMallPackages]) {
    const packageJsonPath = path.join(mallPackagesRoot, directory, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = readJson(`apps/sdkwork-mall-pc/packages/${directory}/package.json`);
    const workspaceOwner = packageJson.sdkwork?.workspace;
    if (workspaceOwner !== "sdkwork-mall") {
      violations.push(`${directory}: sdkwork.workspace=${workspaceOwner ?? "missing"}`);
    }
  }

  assert.deepEqual(violations, []);
});
