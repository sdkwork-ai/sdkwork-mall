import type { SdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureMallAccountScopeProvider } from "@sdkwork/mall-pc-core/session";

import { configureSdkworkMallPcProviders } from "./commerceProviders";
import { configureSdkworkMallPcDefaultDataProvider } from "./default-data-remote";
import { configureSdkworkMallPcPartnerProviders } from "./partnerProviders";
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
  // Local buyer data (favourites, footprint, search history, CMS fallback and
  // admin role) is keyed by the live IAM identity, so a second account never
  // reads the previous account's values.
  configureMallAccountScopeProvider(() => {
    const snapshot = session.getSnapshot();
    const tenantId = snapshot.context?.tenantId?.trim();
    const userId = snapshot.context?.userId?.trim();
    return tenantId && userId ? { tenantId, userId } : null;
  });
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
  configureSdkworkMallPcPartnerProviders(sdkClients);
  configureSdkworkMallPcDefaultDataProvider({
    environment: config.environment,
    locale: config.i18n.defaultLocale,
    sdkClients,
    session,
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
