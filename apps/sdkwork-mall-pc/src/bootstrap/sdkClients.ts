import { listSdkworkMallPcBackendAdminSdkFamilies } from "@sdkwork/mall-pc-admin-core/composition";
import { listSdkworkMallPcAppSdkFamilies } from "@sdkwork/mall-pc-core/composition";
import type { SdkworkAccountAppClient } from "@sdkwork/account-app-sdk";
import type { SdkworkCloudRouterDomainsClient } from "@sdkwork/cloudrouter-app-sdk/domains";
import type { SdkworkCloudRouterBackendDomainsClient } from "@sdkwork/cloudrouter-backend-sdk/domains";
import type { SdkworkAppClient as SdkworkMembershipAppClient } from "@sdkwork/membership-app-sdk";
import type { SdkworkAppClient as SdkworkOrderAppClient } from "@sdkwork/order-app-sdk";
import type { SdkworkAppClient as SdkworkPaymentAppClient } from "@sdkwork/payment-app-sdk";
import type { SdkworkAppClient as SdkworkPromotionAppClient } from "@sdkwork/promotion-app-sdk";

import type { SdkworkMallPcRuntimeConfig } from "./environment";

export interface SdkworkMallPcSdkClientInventory {
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

export function listSdkworkMallPcRegisteredSdkFamilies(
  config: SdkworkMallPcRuntimeConfig,
): SdkworkMallPcSdkClientInventory["sdkFamilies"] {
  void config;
  return {
    app: listSdkworkMallPcAppSdkFamilies()
      .filter((sdkFamily) => sdkFamily.surface === "app")
      .map((sdkFamily) => sdkFamily.family),
    backendAdmin: listSdkworkMallPcBackendAdminSdkFamilies().map((sdkFamily) => sdkFamily.family),
  };
}
