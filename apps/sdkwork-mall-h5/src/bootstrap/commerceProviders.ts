import {
  configureSdkworkCommerceServiceProvider,
  configureSdkworkCommerceSessionTokenProvider,
  createSdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import { configureSdkworkOrderAppServiceProvider } from "@sdkwork/order-service";
import type { CommerceAppSdkClient, CommerceBackendSdkClient } from "@sdkwork/mall-commerce-sdk-ports";

import { configureSdkworkMallH5DomainServiceProviders } from "./domain-service-providers";
import { createSdkCommandPortAdapter } from "./sdk-command-port-adapter";
import type { SdkworkMallH5IamRuntime } from "./iamRuntime";
import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";
import type { SdkworkMallH5RuntimeConfig } from "./environment";

export interface SdkworkMallH5CommerceProviders {
  commerceService: ReturnType<typeof createSdkworkCommerceService>;
}

const COMMERCE_APP_COMMAND_PATHS = [
  "addresses.create",
  "addresses.defaultSelection.create",
  "addresses.delete",
  "addresses.update",
  "afterSales.requests.create",
  "cart.items.create",
  "cart.items.delete",
  "cart.items.update",
  "checkout.sessions.create",
  "checkout.sessions.orders.create",
  "checkout.sessions.quotes.create",
  "orders.pay",
  "promotions.codes.redemptions.create",
  "promotions.discountApplications.create",
  "promotions.userCoupons.claims.create",
  "wallet.holds.create",
] as const;

export function configureSdkworkMallH5Providers(input: {
  config: SdkworkMallH5RuntimeConfig;
  iamRuntime: SdkworkMallH5IamRuntime;
  sdkClients: SdkworkMallH5SdkClientInventory;
}): SdkworkMallH5CommerceProviders {
  const appClient: CommerceAppSdkClient = {
    commerce: createSdkCommandPortAdapter<CommerceAppSdkClient["commerce"]>(
      // Adapt the commerce namespace itself: the facade spreads this node, so
      // wrapping the client root would leak httpClient/ai/iam into the service
      // and leave catalog/cart/... undefined.
      input.sdkClients.commerceAppClient.commerce,
      { commandPaths: COMMERCE_APP_COMMAND_PATHS },
    ),
  };
  const backendClient = input.sdkClients.commerceBackendClient
    ? {
        commerce: createSdkCommandPortAdapter<CommerceBackendSdkClient["commerce"]>(
          input.sdkClients.commerceBackendClient.commerce,
          { commandPaths: [] },
        ),
      }
    : undefined;

  const commerceService = createSdkworkCommerceService({ appClient, backendClient });

  configureSdkworkCommerceServiceProvider(() => commerceService);
  configureSdkworkCommerceSessionTokenProvider(() => {
    const snapshot = input.iamRuntime.session.getSnapshot();
    return {
      accessToken: snapshot.accessToken,
      authToken: snapshot.authToken,
      refreshToken: snapshot.refreshToken,
    };
  });

  configureSdkworkMallH5DomainServiceProviders(
    input.sdkClients,
    () => {
      const snapshot = input.iamRuntime.session.getSnapshot();
      return {
        accessToken: snapshot.accessToken,
        authToken: snapshot.authToken,
        refreshToken: snapshot.refreshToken,
      };
    },
  );
  void configureSdkworkOrderAppServiceProvider;

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__commerceService = commerceService;
  }

  return { commerceService };
}
