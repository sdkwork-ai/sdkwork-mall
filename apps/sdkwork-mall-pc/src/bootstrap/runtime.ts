import type { SdkworkCommerceService } from "@sdkwork/mall-commerce-service";

import { configureSdkworkMallPcProviders } from "./commerceProviders";
import {
  resolveSdkworkMallPcRuntimeConfig,
  type SdkworkMallPcRuntimeConfig,
} from "./environment";
import {
  createSdkworkMallPcIamRuntime,
  createSdkworkMallPcSdkClientsWithTokenManager,
  type SdkworkMallPcIamRuntime,
} from "./iamRuntime";
import {
  sdkworkMallPcRoutes,
  type SdkworkMallPcRouteContribution,
} from "./routes";
import {
  createSdkworkMallPcSessionStore,
  type SdkworkMallPcSessionStore,
} from "./sessionStore";
import { createSdkworkMallPcSessionTokenManager } from "./sessionTokenManager";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

export interface SdkworkMallPcRuntime {
  commerceService: SdkworkCommerceService;
  config: SdkworkMallPcRuntimeConfig;
  iamRuntime: SdkworkMallPcIamRuntime;
  routes: readonly SdkworkMallPcRouteContribution[];
  sdkClients: SdkworkMallPcSdkClientInventory;
  session: SdkworkMallPcSessionStore;
}

export function createSdkworkMallPcRuntime(): SdkworkMallPcRuntime {
  const config = resolveSdkworkMallPcRuntimeConfig();
  const session = createSdkworkMallPcSessionStore(
    typeof window === "undefined" ? undefined : window.sessionStorage,
  );
  const tokenManager = createSdkworkMallPcSessionTokenManager(session);
  const sdkClients = createSdkworkMallPcSdkClientsWithTokenManager(config, tokenManager);
  const iamRuntime = createSdkworkMallPcIamRuntime({
    config,
    sdkClients,
    session,
  });
  const { commerceService } = configureSdkworkMallPcProviders({
    config,
    iamRuntime,
    sdkClients,
    tokenManager,
  });

  return {
    commerceService,
    config,
    iamRuntime,
    routes: sdkworkMallPcRoutes,
    sdkClients,
    session,
  };
}
