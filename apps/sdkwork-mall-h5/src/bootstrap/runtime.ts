import type { SdkworkCommerceService } from "@sdkwork/mall-commerce-service";

import { configureSdkworkMallH5Providers } from "./commerceProviders";
import {
  resolveSdkworkMallH5RuntimeConfig,
  type SdkworkMallH5RuntimeConfig,
} from "./environment";
import {
  createSdkworkMallH5IamRuntime,
  createSdkworkMallH5SdkClientsWithTokenManager,
  type SdkworkMallH5IamRuntime,
} from "./iamRuntime";
import {
  sdkworkMallH5Routes,
  type SdkworkMallH5RouteContribution,
} from "./routes";
import {
  createSdkworkMallH5SessionStore,
  registerSdkworkMallH5SessionStoreLocator,
  type SdkworkMallH5SessionStore,
} from "./sessionStore";
import { createSdkworkMallH5SessionTokenManager } from "./sessionTokenManager";
import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";

export interface SdkworkMallH5Runtime {
  commerceService: SdkworkCommerceService;
  config: SdkworkMallH5RuntimeConfig;
  iamRuntime: SdkworkMallH5IamRuntime;
  routes: readonly SdkworkMallH5RouteContribution[];
  sdkClients: SdkworkMallH5SdkClientInventory;
  session: SdkworkMallH5SessionStore;
}

export function createSdkworkMallH5Runtime(): SdkworkMallH5Runtime {
  const config = resolveSdkworkMallH5RuntimeConfig();
  const session = createSdkworkMallH5SessionStore(
    typeof window === "undefined" ? undefined : window.localStorage,
  );
  registerSdkworkMallH5SessionStoreLocator(() => session);
  const tokenManager = createSdkworkMallH5SessionTokenManager(session);
  const sdkClients = createSdkworkMallH5SdkClientsWithTokenManager(config, tokenManager);
  const iamRuntime = createSdkworkMallH5IamRuntime({
    config,
    sdkClients,
    session,
  });
  const { commerceService } = configureSdkworkMallH5Providers({
    config,
    iamRuntime,
    sdkClients,
  });

  return {
    commerceService,
    config,
    iamRuntime,
    routes: sdkworkMallH5Routes,
    sdkClients,
    session,
  };
}
