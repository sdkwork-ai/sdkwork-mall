import {
  getSdkworkMallPcBackendAdminRoutes,
  type SdkworkMallPcAdminSurface,
} from "@sdkwork/mall-pc-admin-shell";
import { sdkworkMallPcAdminMembershipRoutes } from "@sdkwork/mall-pc-admin-membership/routes";
import { sdkworkMallPcAdminProductRoutes } from "@sdkwork/mall-pc-admin-product/routes";
import { sdkworkMallPcActivityRoutes } from "@sdkwork/mall-pc-activity/routes";
import { sdkworkMallPcAdminMarketingRoutes } from "@sdkwork/mall-pc-admin-marketing/routes";
import { sdkworkMallPcAdminOrdersRoutes } from "@sdkwork/mall-pc-admin-orders/routes";
import { sdkworkMallPcAdminPermissionsRoutes } from "@sdkwork/mall-pc-admin-permissions/routes";
import { sdkworkMallPcAdminRiskRoutes } from "@sdkwork/mall-pc-admin-risk/routes";
import { sdkworkMallPcAdminReportsRoutes } from "@sdkwork/mall-pc-admin-reports/routes";
import { sdkworkMallPcAdminSettlementRoutes } from "@sdkwork/mall-pc-admin-settlement/routes";
import { sdkworkMallPcCmsRoutes } from "@sdkwork/mall-pc-cms/routes";
import { sdkworkMallPcAddressRoutes } from "@sdkwork/mall-pc-address/routes";
import { sdkworkMallPcAfterSalesRoutes } from "@sdkwork/mall-pc-after-sales/routes";
import { sdkworkMallPcCartRoutes } from "@sdkwork/mall-pc-cart/routes";
import { sdkworkMallPcCatalogRoutes } from "@sdkwork/mall-pc-catalog/routes";
import { sdkworkMallPcCommerceRoutes } from "@sdkwork/mall-pc-commerce/routes";
import { sdkworkMallPcCouponRoutes } from "@sdkwork/mall-pc-coupon/routes";
import { createSdkworkMallPcRouteRegistry } from "@sdkwork/mall-pc-core";
import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";
import { sdkworkMallPcHomeRoutes } from "@sdkwork/mall-pc-home/routes";
import { sdkworkMallPcInvoiceRoutes } from "@sdkwork/mall-pc-invoice/routes";
import { sdkworkMallPcMembershipRoutes } from "@sdkwork/mall-pc-membership/routes";
import { sdkworkMallPcMerchantRoutes } from "@sdkwork/mall-pc-merchant/routes";
import { sdkworkMallPcMessagesRoutes } from "@sdkwork/mall-pc-messages/routes";
import { sdkworkMallPcReviewsRoutes } from "@sdkwork/mall-pc-reviews/routes";
import { sdkworkMallPcAdminShopsRoutes } from "@sdkwork/mall-pc-admin-shops/routes";
import { sdkworkMallPcOrderRoutes } from "@sdkwork/mall-pc-order/routes";
import { sdkworkMallPcPartnerRoutes } from "@sdkwork/mall-pc-partner/routes";
import { sdkworkMallPcPointsRoutes } from "@sdkwork/mall-pc-points/routes";
import { sdkworkMallPcSearchRoutes } from "@sdkwork/mall-pc-search/routes";
import { sdkworkMallPcShopRoutes } from "@sdkwork/mall-pc-shop/routes";
import { sdkworkMallPcWalletRoutes } from "@sdkwork/mall-pc-wallet/routes";

export type { SdkworkMallPcRouteContribution, SdkworkMallPcAdminSurface };

export const sdkworkMallPcRoutes = createSdkworkMallPcRouteRegistry(
  sdkworkMallPcHomeRoutes,
  sdkworkMallPcSearchRoutes,
  sdkworkMallPcCatalogRoutes,
  sdkworkMallPcCartRoutes,
  sdkworkMallPcShopRoutes,
  sdkworkMallPcActivityRoutes,
  sdkworkMallPcCommerceRoutes,
  sdkworkMallPcOrderRoutes,
  sdkworkMallPcPartnerRoutes,
  sdkworkMallPcAfterSalesRoutes,
  sdkworkMallPcAddressRoutes,
  sdkworkMallPcReviewsRoutes,
  sdkworkMallPcMessagesRoutes,
  sdkworkMallPcWalletRoutes,
  sdkworkMallPcCouponRoutes,
  sdkworkMallPcMembershipRoutes,
  sdkworkMallPcInvoiceRoutes,
  sdkworkMallPcPointsRoutes,
  sdkworkMallPcMerchantRoutes,
  sdkworkMallPcAdminReportsRoutes,
  sdkworkMallPcCmsRoutes,
  sdkworkMallPcAdminRiskRoutes,
  sdkworkMallPcAdminSettlementRoutes,
  sdkworkMallPcAdminPermissionsRoutes,
  sdkworkMallPcAdminShopsRoutes,
  sdkworkMallPcAdminOrdersRoutes,
  sdkworkMallPcAdminMarketingRoutes,
  sdkworkMallPcAdminProductRoutes,
  sdkworkMallPcAdminMembershipRoutes,
);

export const sdkworkMallPcBackendAdminRoutes =
  getSdkworkMallPcBackendAdminRoutes(sdkworkMallPcRoutes);
