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
  "promotions.discountApplications.create",
  "wallet.holds.create",
] as const;

export function configureSdkworkMallH5Providers(input: {
  config: SdkworkMallH5RuntimeConfig;
  iamRuntime: SdkworkMallH5IamRuntime;
  sdkClients: SdkworkMallH5SdkClientInventory;
}): SdkworkMallH5CommerceProviders {
  const appClient: CommerceAppSdkClient = {
    commerce: createSdkCommandPortAdapter<CommerceAppSdkClient["commerce"]>(
      input.sdkClients.commerceAppClient,
      { commandPaths: COMMERCE_APP_COMMAND_PATHS },
    ),
  };
  const backendClient = input.sdkClients.commerceBackendClient
    ? {
        commerce: createSdkCommandPortAdapter<CommerceBackendSdkClient["commerce"]>(
          input.sdkClients.commerceBackendClient,
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

  return { commerceService };
}
