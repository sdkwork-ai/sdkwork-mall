import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

import {
  buildSdkworkMallPcAuthLoginRedirect,
  hasSdkworkMallPcAuthenticatedSession,
} from "./authGateLogic";
import type { SdkworkMallPcRuntime } from "./bootstrap/runtime";
import { hasSdkworkMallPcRoutePermission } from "./routePermissions";

const SdkworkMallHomePage = lazy(() =>
  import("@sdkwork/mall-pc-home/storefront-pages").then((module) => ({ default: module.SdkworkMallHomePage })),
);
const SdkworkMallHelpPage = lazy(() =>
  import("@sdkwork/mall-pc-home/storefront-pages").then((module) => ({ default: module.SdkworkMallHelpPage })),
);
const SdkworkMallSearchPage = lazy(() =>
  import("@sdkwork/mall-pc-search/storefront-pages").then((module) => ({ default: module.SdkworkMallSearchPage })),
);
const SdkworkMallCategoryPage = lazy(() =>
  import("@sdkwork/mall-pc-catalog/storefront-pages").then((module) => ({ default: module.SdkworkMallCategoryPage })),
);
const SdkworkMallProductDetailPage = lazy(() =>
  import("@sdkwork/mall-pc-catalog/storefront-pages").then((module) => ({ default: module.SdkworkMallProductDetailPage })),
);
const SdkworkMallCartPage = lazy(() =>
  import("@sdkwork/mall-pc-cart/storefront-pages").then((module) => ({ default: module.SdkworkMallCartPage })),
);
const SdkworkMallCheckoutPage = lazy(() =>
  import("@sdkwork/mall-pc-cart/storefront-pages").then((module) => ({ default: module.SdkworkMallCheckoutPage })),
);
const SdkworkMallPaymentResultPage = lazy(() =>
  import("@sdkwork/mall-pc-cart/storefront-pages").then((module) => ({ default: module.SdkworkMallPaymentResultPage })),
);
const SdkworkMallShopPage = lazy(() =>
  import("@sdkwork/mall-pc-shop/storefront-pages").then((module) => ({ default: module.SdkworkMallShopPage })),
);
const SdkworkMallActivityListPage = lazy(() =>
  import("@sdkwork/mall-pc-activity/storefront-pages").then((module) => ({ default: module.SdkworkMallActivityListPage })),
);
const SdkworkMallActivityDetailPage = lazy(() =>
  import("@sdkwork/mall-pc-activity/storefront-pages").then((module) => ({ default: module.SdkworkMallActivityDetailPage })),
);
const SdkworkMallBuyerDashboardPage = lazy(() =>
  import("@sdkwork/mall-pc-commerce/buyer-dashboard-page").then((module) => ({ default: module.SdkworkMallBuyerDashboardPage })),
);
const SdkworkMallFavoritesPage = lazy(() =>
  import("@sdkwork/mall-pc-commerce/buyer-favorites-page").then((module) => ({ default: module.SdkworkMallFavoritesPage })),
);
const SdkworkMallProfilePage = lazy(() =>
  import("@sdkwork/mall-pc-commerce/buyer-profile-page").then((module) => ({ default: module.SdkworkMallProfilePage })),
);
const SdkworkMallSecurityPage = lazy(() =>
  import("@sdkwork/mall-pc-commerce/buyer-security-page").then((module) => ({ default: module.SdkworkMallSecurityPage })),
);
const SdkworkMallGiftCardsPage = lazy(() =>
  import("@sdkwork/mall-pc-commerce/buyer-gift-cards-page").then((module) => ({ default: module.SdkworkMallGiftCardsPage })),
);
const SdkworkOrderPage = lazy(() =>
  import("@sdkwork/mall-pc-order/order-page").then((module) => ({ default: module.SdkworkOrderPage })),
);
const SdkworkLogisticsPage = lazy(() =>
  import("@sdkwork/mall-pc-order/logistics-page").then((module) => ({ default: module.SdkworkLogisticsPage })),
);
const SdkworkWalletPage = lazy(() =>
  import("@sdkwork/mall-pc-wallet/wallet-page").then((module) => ({ default: module.SdkworkWalletPage })),
);
const SdkworkCouponPage = lazy(() =>
  import("@sdkwork/mall-pc-coupon/coupon-page").then((module) => ({ default: module.SdkworkCouponPage })),
);
const SdkworkMembershipPage = lazy(() =>
  import("@sdkwork/mall-pc-membership/membership-page").then((module) => ({ default: module.SdkworkMembershipPage })),
);
const SdkworkInvoicePage = lazy(() =>
  import("@sdkwork/mall-pc-invoice/invoice-page").then((module) => ({ default: module.SdkworkInvoicePage })),
);
const SdkworkPointsPage = lazy(() =>
  import("@sdkwork/mall-pc-points/points-page").then((module) => ({ default: module.SdkworkPointsPage })),
);
const SdkworkMallAddressPage = lazy(() =>
  import("@sdkwork/mall-pc-address/buyer-pages").then((module) => ({ default: module.SdkworkMallAddressPage })),
);
const SdkworkMallAfterSalesPage = lazy(() =>
  import("@sdkwork/mall-pc-after-sales/buyer-pages").then((module) => ({ default: module.SdkworkMallAfterSalesPage })),
);
const SdkworkMallReviewsPage = lazy(() =>
  import("@sdkwork/mall-pc-reviews/buyer-pages").then((module) => ({ default: module.SdkworkMallReviewsPage })),
);
const SdkworkMallFootprintPage = lazy(() =>
  import("@sdkwork/mall-pc-reviews/buyer-pages").then((module) => ({ default: module.SdkworkMallFootprintPage })),
);
const SdkworkMallMessagesPage = lazy(() =>
  import("@sdkwork/mall-pc-messages/buyer-pages").then((module) => ({ default: module.SdkworkMallMessagesPage })),
);
const SdkworkMallMerchantDashboardPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantDashboardPage })),
);
const SdkworkMallMerchantOnboardingPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantOnboardingPage })),
);
const SdkworkMallMerchantShopPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantShopPage })),
);
const SdkworkMallMerchantProductsPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantProductsPage })),
);
const SdkworkMallMerchantInventoryPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantInventoryPage })),
);
const SdkworkMallMerchantOrdersPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantOrdersPage })),
);
const SdkworkMallMerchantFulfillmentPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantFulfillmentPage })),
);
const SdkworkMallMerchantAfterSalesPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantAfterSalesPage })),
);
const SdkworkMallMerchantMarketingPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantMarketingPage })),
);
const SdkworkMallMerchantDataPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantDataPage })),
);
const SdkworkMallMerchantServicePage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantServicePage })),
);
const SdkworkMallMerchantSettlementPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantSettlementPage })),
);
const SdkworkMallMerchantSettingsPage = lazy(() =>
  import("@sdkwork/mall-pc-merchant/merchant-pages").then((module) => ({ default: module.SdkworkMallMerchantSettingsPage })),
);
const SdkworkMallAdminCmsPage = lazy(() =>
  import("@sdkwork/mall-pc-cms/admin-pages").then((module) => ({ default: module.SdkworkMallAdminCmsPage })),
);
const SdkworkMallAdminRiskPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-risk/admin-pages").then((module) => ({ default: module.SdkworkMallAdminRiskPage })),
);
const SdkworkMallAdminSettlementPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-settlement/admin-pages").then((module) => ({ default: module.SdkworkMallAdminSettlementPage })),
);
const SdkworkMallAdminPermissionsPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-permissions/admin-pages").then((module) => ({ default: module.SdkworkMallAdminPermissionsPage })),
);
const SdkworkMallAdminDashboardPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-reports/admin-dashboard-page").then((module) => ({ default: module.SdkworkMallAdminDashboardPage })),
);
const SdkworkMallAdminReportsPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-reports/admin-reports-page").then((module) => ({ default: module.SdkworkMallAdminReportsPage })),
);
const SdkworkMallAdminAuditPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-reports/admin-audit-page").then((module) => ({ default: module.SdkworkMallAdminAuditPage })),
);
const SdkworkMallAdminShopsPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-shops/admin-shops-page").then((module) => ({ default: module.SdkworkMallAdminShopsPage })),
);
const SdkworkMallAdminUsersPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-shops/admin-governance-pages").then((module) => ({ default: module.SdkworkMallAdminUsersPage })),
);
const SdkworkMallAdminBrandsPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-shops/admin-governance-pages").then((module) => ({ default: module.SdkworkMallAdminBrandsPage })),
);
const SdkworkMallAdminModerationPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-shops/admin-governance-pages").then((module) => ({ default: module.SdkworkMallAdminModerationPage })),
);
const SdkworkMallAdminOrdersPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-orders/admin-pages").then((module) => ({ default: module.SdkworkMallAdminOrdersPage })),
);
const SdkworkMallAdminAfterSalesPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-orders/admin-pages").then((module) => ({ default: module.SdkworkMallAdminAfterSalesPage })),
);
const SdkworkMallAdminMarketingPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-marketing/admin-pages").then((module) => ({ default: module.SdkworkMallAdminMarketingPage })),
);
const SdkworkMembershipAdminPage = lazy(() =>
  import("@sdkwork/mall-pc-admin-membership/membership-admin-page").then((module) => ({
    default: module.SdkworkMembershipAdminPage,
  })),
);
const CatalogAdmin = lazy(() =>
  import("@sdkwork/mall-pc-admin-product/catalog-admin").then((module) => ({ default: module.CatalogAdmin })),
);
export function AppRoutes({ runtime }: { runtime: SdkworkMallPcRuntime }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {runtime.routes.map((route) => (
          <Route
            element={(
              <ProtectedRoute auth={route.auth} route={route} runtime={runtime}>
                {resolveRouteScreen(route, runtime)}
              </ProtectedRoute>
            )}
            key={route.id}
            path={route.path}
          />
        ))}
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </Suspense>
  );
}

function ProtectedRoute({
  auth,
  children,
  route,
  runtime,
}: {
  auth: SdkworkMallPcRouteContribution["auth"];
  children: ReactNode;
  route: SdkworkMallPcRouteContribution;
  runtime: SdkworkMallPcRuntime;
}) {
  const location = useLocation();
  const snapshot = runtime.session.getSnapshot();
  if (auth === "required" && !hasSdkworkMallPcAuthenticatedSession(snapshot)) {
    return <Navigate replace to={buildSdkworkMallPcAuthLoginRedirect(location)} />;
  }
  if (route.surface === "backend-admin" && !hasSdkworkMallPcRoutePermission(runtime, route)) {
    return (
      <div className="sdkwork-mall-pc-forbidden">
        <h1>无权访问</h1>
        <p>当前账号缺少 {route.permissionHint ?? "backend-admin"} 权限，或尚未配置后台 API。</p>
        <Link to="/">返回首页</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function resolveRouteScreen(
  route: SdkworkMallPcRouteContribution,
  runtime: SdkworkMallPcRuntime,
) {
  const locale = runtime.config.i18n.defaultLocale;
  switch (route.id) {
    case "storefront.mall.home":
      return <SdkworkMallHomePage />;
    case "storefront.mall.help":
      return <SdkworkMallHelpPage />;
    case "storefront.mall.search":
      return <SdkworkMallSearchPage />;
    case "storefront.mall.categories":
    case "storefront.mall.category-detail":
      return <SdkworkMallCategoryPage />;
    case "storefront.mall.product-detail":
      return <SdkworkMallProductDetailPage />;
    case "storefront.mall.cart":
      return <SdkworkMallCartPage />;
    case "storefront.mall.checkout":
      return <SdkworkMallCheckoutPage />;
    case "storefront.mall.payment-result":
      return <SdkworkMallPaymentResultPage />;
    case "storefront.mall.shop":
      return <SdkworkMallShopPage />;
    case "storefront.mall.activity-list":
      return <SdkworkMallActivityListPage />;
    case "storefront.mall.activity-detail":
      return <SdkworkMallActivityDetailPage />;
    case "buyer.mall.dashboard":
      return <SdkworkMallBuyerDashboardPage />;
    case "buyer.mall.favorites":
      return <SdkworkMallFavoritesPage />;
    case "buyer.mall.profile":
      return <SdkworkMallProfilePage />;
    case "buyer.mall.security":
      return <SdkworkMallSecurityPage />;
    case "buyer.mall.gift-cards":
      return <SdkworkMallGiftCardsPage />;
    case "buyer.mall.orders":
      return <SdkworkOrderPage locale={locale} />;
    case "buyer.mall.orders.logistics":
      return <SdkworkLogisticsPage locale={locale} />;
    case "buyer.mall.addresses":
      return <SdkworkMallAddressPage />;
    case "buyer.mall.after-sales":
      return <SdkworkMallAfterSalesPage />;
    case "buyer.mall.reviews":
      return <SdkworkMallReviewsPage />;
    case "buyer.mall.footprint":
      return <SdkworkMallFootprintPage />;
    case "buyer.mall.messages":
      return <SdkworkMallMessagesPage />;
    case "buyer.mall.wallet":
      return <SdkworkWalletPage locale={locale} />;
    case "buyer.mall.coupons":
      return <SdkworkCouponPage locale={locale} />;
    case "buyer.mall.membership":
      return <SdkworkMembershipPage locale={locale} />;
    case "buyer.mall.invoices":
      return <SdkworkInvoicePage locale={locale} />;
    case "buyer.mall.points":
      return <SdkworkPointsPage locale={locale} />;
    case "merchant.mall.dashboard":
      return <SdkworkMallMerchantDashboardPage />;
    case "merchant.mall.onboarding":
      return <SdkworkMallMerchantOnboardingPage />;
    case "merchant.mall.shop":
      return <SdkworkMallMerchantShopPage />;
    case "merchant.mall.products":
      return <SdkworkMallMerchantProductsPage />;
    case "merchant.mall.inventory":
      return <SdkworkMallMerchantInventoryPage />;
    case "merchant.mall.orders":
      return <SdkworkMallMerchantOrdersPage />;
    case "merchant.mall.fulfillment":
      return <SdkworkMallMerchantFulfillmentPage />;
    case "merchant.mall.after-sales":
      return <SdkworkMallMerchantAfterSalesPage />;
    case "merchant.mall.marketing":
      return <SdkworkMallMerchantMarketingPage />;
    case "merchant.mall.data":
      return <SdkworkMallMerchantDataPage />;
    case "merchant.mall.service":
      return <SdkworkMallMerchantServicePage />;
    case "merchant.mall.settlement":
      return <SdkworkMallMerchantSettlementPage />;
    case "merchant.mall.settings":
      return <SdkworkMallMerchantSettingsPage />;
    case "admin.mall.cms":
      return <SdkworkMallAdminCmsPage />;
    case "admin.mall.risk":
      return <SdkworkMallAdminRiskPage />;
    case "admin.mall.settlement":
      return <SdkworkMallAdminSettlementPage />;
    case "admin.mall.permissions":
      return <SdkworkMallAdminPermissionsPage />;
    case "admin.mall.dashboard":
      return <SdkworkMallAdminDashboardPage />;
    case "admin.mall.reports":
      return <SdkworkMallAdminReportsPage />;
    case "admin.mall.audit":
      return <SdkworkMallAdminAuditPage />;
    case "admin.mall.shops":
      return <SdkworkMallAdminShopsPage />;
    case "admin.mall.users":
      return <SdkworkMallAdminUsersPage />;
    case "admin.mall.brands":
      return <SdkworkMallAdminBrandsPage />;
    case "admin.mall.moderation":
      return <SdkworkMallAdminModerationPage />;
    case "admin.mall.orders":
      return <SdkworkMallAdminOrdersPage />;
    case "admin.mall.after-sales":
      return <SdkworkMallAdminAfterSalesPage />;
    case "admin.mall.marketing":
      return <SdkworkMallAdminMarketingPage />;
    case "admin.commerce.product-admin.catalog":
      return <CatalogAdmin />;
    case "admin.commerce.membership-admin.dashboard":
      return <SdkworkMembershipAdminPage locale={locale} />;
    default:
      return <Navigate replace to="/" />;
  }
}

function RouteLoadingFallback() {
  return (
    <div aria-label="加载商城页面" className="sdkwork-mall-pc-loading" role="status">
      <div className="sdkwork-mall-pc-loading-spinner" aria-hidden="true" />
      <span className="sdkwork-mall-pc-loading-text">加载中...</span>
    </div>
  );
}
