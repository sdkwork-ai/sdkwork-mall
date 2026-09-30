import { listSdkworkMallH5BackendAdminSdkFamilies } from "@sdkwork/mall-h5-admin-core/composition";
import { listSdkworkMallH5AppSdkFamilies } from "@sdkwork/mall-h5-core/composition";
import type { SdkworkAccountAppClient } from "@sdkwork/account-app-sdk";
import type { SdkworkCloudRouterDomainsClient } from "@sdkwork/cloudrouter-app-sdk/domains";
import type { SdkworkCloudRouterBackendDomainsClient } from "@sdkwork/cloudrouter-backend-sdk/domains";
import type { SdkworkAppClient as SdkworkMembershipAppClient } from "@sdkwork/membership-app-sdk";
import type { SdkworkAppClient as SdkworkOrderAppClient } from "@sdkwork/order-app-sdk";
import type { SdkworkAppClient as SdkworkPaymentAppClient } from "@sdkwork/payment-app-sdk";
import type { SdkworkAppClient as SdkworkPromotionAppClient } from "@sdkwork/promotion-app-sdk";

import type { SdkworkMallH5RuntimeConfig } from "./environment";

export interface SdkworkMallH5SdkClientInventory {
  accountAppClient: SdkworkAccountAppClient;
  appApiBaseUrl: string;
  backendApiBaseUrl?: string;
  commerceAppClient: SdkworkCloudRouterDomainsClient & {
    setTokenManager(manager: unknown): unknown;
  };
  commerceBackendClient?: SdkworkCloudRouterBackendDomainsClient & {
    setTokenManager(manager: unknown): unknown;
  };
  membershipAppClient: SdkworkMembershipAppClient;
  orderAppClient: SdkworkOrderAppClient;
  paymentAppClient: SdkworkPaymentAppClient;
  promotionAppClient: SdkworkPromotionAppClient;
  sdkFamilies: {
    app: string[];
    backendAdmin: string[];
  };
}

export function listSdkworkMallH5RegisteredSdkFamilies(
  config: SdkworkMallH5RuntimeConfig,
): SdkworkMallH5SdkClientInventory["sdkFamilies"] {
  void config;
  return {
    app: listSdkworkMallH5AppSdkFamilies()
      .filter((sdkFamily) => sdkFamily.surface === "app")
      .map((sdkFamily) => sdkFamily.family),
    backendAdmin: listSdkworkMallH5BackendAdminSdkFamilies().map((sdkFamily) => sdkFamily.family),
  };
}
