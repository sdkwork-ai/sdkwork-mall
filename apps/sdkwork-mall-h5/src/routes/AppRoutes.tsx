import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { hasSdkworkMallH5AuthenticatedSession } from "../authGateLogic";
import type { SdkworkMallH5Runtime } from "../bootstrap/runtime";

const SdkworkMallH5HomePage = lazy(() =>
  import("@sdkwork/mall-h5-home/home-page").then((module) => ({ default: module.SdkworkMallH5HomePage })),
);
const SdkworkMallH5CatalogPage = lazy(() =>
  import("@sdkwork/mall-h5-catalog/catalog-page").then((module) => ({ default: module.SdkworkMallH5CatalogPage })),
);
const SdkworkMallH5ProductDetailPage = lazy(() =>
  import("@sdkwork/mall-h5-catalog/product-detail-page").then((module) => ({ default: module.SdkworkMallH5ProductDetailPage })),
);
const SdkworkMallH5CartPage = lazy(() =>
  import("@sdkwork/mall-h5-cart/cart-page").then((module) => ({ default: module.SdkworkMallH5CartPage })),
);
const SdkworkMallH5CheckoutPage = lazy(() =>
  import("@sdkwork/mall-h5-cart/checkout-page").then((module) => ({ default: module.SdkworkMallH5CheckoutPage })),
);
const SdkworkMallH5PaymentResultPage = lazy(() =>
  import("@sdkwork/mall-h5-cart/payment-result-page").then((module) => ({ default: module.SdkworkMallH5PaymentResultPage })),
);
const SdkworkMallH5OrderPage = lazy(() =>
  import("@sdkwork/mall-h5-order/order-page").then((module) => ({ default: module.SdkworkMallH5OrderPage })),
);
const SdkworkMallH5LogisticsPage = lazy(() =>
  import("@sdkwork/mall-h5-order/logistics-page").then((module) => ({ default: module.SdkworkMallH5LogisticsPage })),
);
const SdkworkMallH5BuyerHomePage = lazy(() =>
  import("@sdkwork/mall-h5-buyer/buyer-page").then((module) => ({ default: module.SdkworkMallH5BuyerHomePage })),
);
const SdkworkMallH5AddressesPage = lazy(() =>
  import("@sdkwork/mall-h5-buyer/addresses-page").then((module) => ({ default: module.SdkworkMallH5AddressesPage })),
);
const SdkworkMallH5CouponsPage = lazy(() =>
  import("@sdkwork/mall-h5-buyer/coupons-page").then((module) => ({ default: module.SdkworkMallH5CouponsPage })),
);
const SdkworkMallH5AfterSalesPage = lazy(() =>
  import("@sdkwork/mall-h5-buyer/aftersales-page").then((module) => ({ default: module.SdkworkMallH5AfterSalesPage })),
);

function LoadingPlaceholder() {
  return <div className="sdk-h5-loading">加载中...</div>;
}

function RequireSession({ children, runtime }: { children: ReactNode; runtime: SdkworkMallH5Runtime }) {
  const location = useLocation();
  if (hasSdkworkMallH5AuthenticatedSession(runtime.session.getSnapshot())) {
    return <>{children}</>;
  }
  const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate replace to={`/auth/login?redirect=${redirect}`} />;
}

export function AppRoutes({ runtime }: { runtime: SdkworkMallH5Runtime }) {
  return (
    <Suspense fallback={<LoadingPlaceholder />}>
      <Routes>
        <Route element={<SdkworkMallH5HomePage />} path="/" />
        <Route element={<SdkworkMallH5CatalogPage />} path="/categories" />
        <Route element={<SdkworkMallH5CatalogPage />} path="/categories/:categoryId" />
        <Route element={<SdkworkMallH5CatalogPage />} path="/search" />
        <Route element={<SdkworkMallH5ProductDetailPage />} path="/product/:productId" />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5CartPage />
            </RequireSession>
          )}
          path="/cart"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5CheckoutPage />
            </RequireSession>
          )}
          path="/checkout"
        />
        <Route element={<SdkworkMallH5PaymentResultPage />} path="/payment/result" />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5OrderPage />
            </RequireSession>
          )}
          path="/buyer/orders"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5LogisticsPage />
            </RequireSession>
          )}
          path="/buyer/logistics"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5BuyerHomePage />
            </RequireSession>
          )}
          path="/buyer"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5AddressesPage />
            </RequireSession>
          )}
          path="/buyer/addresses"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5CouponsPage />
            </RequireSession>
          )}
          path="/buyer/coupons"
        />
        <Route
          element={(
            <RequireSession runtime={runtime}>
              <SdkworkMallH5AfterSalesPage />
            </RequireSession>
          )}
          path="/buyer/after-sales"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </Suspense>
  );
}
