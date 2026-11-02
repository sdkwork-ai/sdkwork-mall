/**
 * H5 i18n runtime (TECH-I18N-READINESS S2 for the H5 root).
 *
 * Authored messages live under `i18n/<locale>/<domain>/<capability>/<fragment>.json`
 * per the i18n standard, so copy changes stay reviewable fragments instead of one
 * locale monolith. This module composes those fragments into the i18next resource
 * and is imported once from `main.tsx`. The default locale stays zh-CN, so
 * shipping the runtime does not change any visible text.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import confirmOrder from "./zh-CN/checkout/confirm-order/messages.json";
import paymentResult from "./zh-CN/checkout/payment-result/messages.json";
import productDetail from "./zh-CN/catalog/product-detail/messages.json";
import help from "./zh-CN/support/help/messages.json";
import afterSales from "./zh-CN/support/after-sales/messages.json";
import home from "./zh-CN/storefront/home/messages.json";
import buyerHub from "./zh-CN/account/buyer-hub/messages.json";
import addresses from "./zh-CN/account/addresses/messages.json";
import invoices from "./zh-CN/account/invoices/messages.json";
import orderDetail from "./zh-CN/order/detail/messages.json";
import orderList from "./zh-CN/order/list/messages.json";

export const SDKWORK_MALL_H5_DEFAULT_LOCALE = "zh-CN";

/** One merged translation tree per locale, composed from authored fragments. */
export const SDKWORK_MALL_H5_I18N_RESOURCES = {
  "zh-CN": {
    translation: {
      ...addresses,
      ...buyerHub,
      ...confirmOrder,
      ...afterSales,
      ...help,
      ...home,
      ...invoices,
      ...orderDetail,
      ...orderList,
      ...paymentResult,
      ...productDetail,
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  fallbackLng: SDKWORK_MALL_H5_DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  lng: SDKWORK_MALL_H5_DEFAULT_LOCALE,
  resources: SDKWORK_MALL_H5_I18N_RESOURCES,
});

export default i18n;
