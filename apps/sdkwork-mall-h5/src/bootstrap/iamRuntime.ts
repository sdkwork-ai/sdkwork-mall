import { readBootstrapAccessTokenFromProcessEnv } from "@sdkwork/iam-credential-entry";
import { createIamH5RuntimeService } from "@sdkwork/iam-h5-core";
import type { IamSession } from "@sdkwork/iam-service";
import { normalizeSdkworkApiBaseUrl } from "@sdkwork/runtime-bootstrap";
import { createClient as createAccountAppClient } from "@sdkwork/account-app-sdk";
import { createClient as createCommerceAppSdkClient } from "@sdkwork/cloudrouter-app-sdk/domains";
import { createClient as createCommerceBackendClient } from "@sdkwork/cloudrouter-backend-sdk/domains";
import type { SdkworkAppClient as SdkworkImAppClient } from "@sdkwork/im-app-sdk";
import { createClient as createMembershipAppClient } from "@sdkwork/membership-app-sdk";
import { createClient as createOrderAppClient } from "@sdkwork/order-app-sdk";
import { createClient as createPartnerAppClient } from "@sdkwork/partner-app-sdk";
import { createClient as createPaymentAppClient } from "@sdkwork/payment-app-sdk";
import { createClient as createPromotionAppClient } from "@sdkwork/promotion-app-sdk";

import type { SdkworkMallH5RuntimeConfig } from "./environment";
import {
  createSdkworkMallH5SessionStore,
  SDKWORK_COMMERCE_H5_SESSION_STORAGE_KEY,
  type SdkworkMallH5SessionSnapshot,
  type SdkworkMallH5SessionStore,
} from "./sessionStore";
import { createSdkworkMallH5SessionTokenManager } from "./sessionTokenManager";
import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";

const DOMAIN_APP_SDK_FAMILY_IDS = {
  account: "sdkwork-account-app-sdk",
  im: "sdkwork-im-app-sdk",
  membership: "sdkwork-membership-app-sdk",
  order: "sdkwork-order-app-sdk",
  partner: "sdkwork-partner-app-sdk",
  payment: "sdkwork-payment-app-sdk",
  promotion: "sdkwork-promotion-app-sdk",
} as const;
const APPBASE_APP_SDK_FAMILY_ID = "sdkwork-iam-app-sdk";
const APP_API_PREFIX = "/app/v3/api";
const BACKEND_API_PREFIX = "/backend/v3/api";

/**
 * IAM runtime of the mall H5 root.
 *
 * The login/session plane is the IAM H5 brick (`@sdkwork/iam-h5-core` +
 * `@sdkwork/iam-h5-auth`): the service composes the generated IAM app client
 * over the profile-resolved app-api origin and commits every established
 * session into the host session store, which the rest of the app reads through
 * its token manager. The mall root owns no auth flow of its own
 * (`APP_H5_ARCHITECTURE_SPEC` §7, `APP_MOBILE_REACT_UI_SPEC` §4).
 */
export interface SdkworkMallH5IamRuntime {
  /** IAM service facade every H5 capability package consumes. */
  iamService: ReturnType<typeof createIamH5RuntimeService>["service"];
  /** Host session store that unlocks protected mall routes. */
  session: SdkworkMallH5SessionStore;
}

export interface CreateSdkworkMallH5IamRuntimeOptions {
  config: SdkworkMallH5RuntimeConfig;
  session?: SdkworkMallH5SessionStore;
}

export function createSdkworkMallH5IamRuntime(
  options: CreateSdkworkMallH5IamRuntimeOptions,
): SdkworkMallH5IamRuntime {
  const session = options.session ?? createSdkworkMallH5SessionStore(resolveSessionStorage());
  // Access-token-only auth calls (login, registration, reset) need the
  // committed public application token before any interactive session exists.
  // It stays the fallback after sign-out, exactly as the IAM H5 root does.
  const bootstrapAccessToken = readBootstrapAccessTokenFromProcessEnv();
  const resolveAccessToken = (): string | undefined =>
    session.getSnapshot().accessToken || bootstrapAccessToken;

  const runtime = createIamH5RuntimeService({
    baseUrl: resolveIamAppApiOrigin(options.config),
    ...(bootstrapAccessToken ? { accessToken: bootstrapAccessToken } : {}),
    clearSession: () => {
      session.clearSession();
    },
    commitSession: (iamSession: IamSession) => {
      commitMallH5IamSession(session, iamSession);
    },
  });

  // The generated IAM client keeps its own copy of the token: re-apply it after
  // every session change so the brick never sends a stale credential.
  session.subscribe(() => {
    runtime.setAccessToken(resolveAccessToken());
  });

  return {
    iamService: runtime.service,
    session,
  };
}

/**
 * Builds the domain app-SDK clients the mall services consume from the one
 * session token manager, so every generated client reads the same identity.
 */
export function createSdkworkMallH5SdkClientsWithTokenManager(
  config: SdkworkMallH5RuntimeConfig,
  tokenManager: ReturnType<typeof createSdkworkMallH5SessionTokenManager>,
): SdkworkMallH5SdkClientInventory {
  const createAppClientConfig = (sdkFamily: string) => ({
    authMode: "dual-token" as const,
    baseUrl: normalizeGeneratedSdkBaseUrl(
      resolveDependencyAppApiBaseUrl(config, sdkFamily),
      APP_API_PREFIX,
    ),
    platform: "h5" as const,
    tokenManager,
  });
  const accountAppClient = createAccountAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.account),
  );
  const commerceAppClient = createCommerceAppSdkClient({
    authMode: "dual-token",
    baseUrl: normalizeGeneratedSdkBaseUrl(config.appApiBaseUrl, APP_API_PREFIX),
    platform: "h5",
    tokenManager,
  });
  const commerceBackendClient = config.backendApiBaseUrl
    ? createCommerceBackendClient({
        authMode: "dual-token",
        baseUrl: normalizeGeneratedSdkBaseUrl(config.backendApiBaseUrl, BACKEND_API_PREFIX),
        platform: "h5",
        tokenManager,
      })
    : undefined;
  // 会员生成客户端不暴露 setTokenManager；会话凭据通过 config 传入。
  const membershipAppClient = createMembershipAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.membership),
  );
  const orderAppClient = createOrderAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.order),
  );
  const partnerAppClient = createPartnerAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.partner),
  );
  const paymentAppClient = createPaymentAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.payment),
  );
  const promotionAppClient = createPromotionAppClient(
    createAppClientConfig(DOMAIN_APP_SDK_FAMILY_IDS.promotion),
  );

  accountAppClient.setTokenManager(tokenManager);
  commerceAppClient.setTokenManager(tokenManager);
  commerceBackendClient?.setTokenManager(tokenManager);
  membershipAppClient.setTokenManager(tokenManager);
  orderAppClient.setTokenManager(tokenManager);
  partnerAppClient.setTokenManager(tokenManager);
  paymentAppClient.setTokenManager(tokenManager);
  promotionAppClient.setTokenManager(tokenManager);

  return {
    accountAppClient,
    appApiBaseUrl: normalizeSdkworkApiBaseUrl(config.appApiBaseUrl, "app"),
    backendApiBaseUrl: config.backendApiBaseUrl
      ? normalizeSdkworkApiBaseUrl(config.backendApiBaseUrl, "backend")
      : undefined,
    commerceAppClient,
    commerceBackendClient,
    membershipAppClient,
    orderAppClient,
    partnerAppClient,
    paymentAppClient,
    promotionAppClient,
    sdkFamilies: {
      app: [
        "sdkwork-account-app-sdk",
        "sdkwork-commerce-app-sdk",
        "sdkwork-iam-app-sdk",
        "sdkwork-im-app-sdk",
        "sdkwork-membership-app-sdk",
        "sdkwork-order-app-sdk",
        "sdkwork-partner-app-sdk",
        "sdkwork-payment-app-sdk",
        "sdkwork-promotion-app-sdk",
      ],
      backendAdmin: ["sdkwork-commerce-backend-sdk", "sdkwork-iam-backend-sdk"],
    },
  } as SdkworkMallH5SdkClientInventory;
}

/**
 * Loads the IM notifications client on demand.
 *
 * The IM plane is only needed by the chat and notice surfaces, which are lazy
 * routes, so the client is code-split out of the first-load bundle and created
 * on the first notification call.
 */
export async function loadSdkworkMallH5ImAppClient(
  config: SdkworkMallH5RuntimeConfig,
  tokenManager: ReturnType<typeof createSdkworkMallH5SessionTokenManager>,
): Promise<SdkworkImAppClient> {
  const { createClient } = await import("@sdkwork/im-app-sdk");
  return createClient({
    authMode: "dual-token",
    baseUrl: normalizeGeneratedSdkBaseUrl(
      resolveDependencyAppApiBaseUrl(config, DOMAIN_APP_SDK_FAMILY_IDS.im),
      APP_API_PREFIX,
    ),
    platform: "h5",
    tokenManager,
  });
}

function resolveAppbaseAppApiBaseUrl(config: SdkworkMallH5RuntimeConfig): string {
  return config.sdkBaseUrls?.dependencySdkBaseUrls?.[APPBASE_APP_SDK_FAMILY_ID]?.appApiBaseUrl
    ?? config.appApiBaseUrl;
}

/**
 * Resolves the app-api origin the IAM H5 brick builds its client from.
 *
 * Same-origin profiles configure the app-api base as `/app/v3/api`; the brick
 * requires a concrete origin (it appends the prefix itself), so a stripped and
 * empty base falls back to the page origin instead of throwing at boot.
 */
function resolveIamAppApiOrigin(config: SdkworkMallH5RuntimeConfig): string {
  const configured = normalizeGeneratedSdkBaseUrl(
    resolveAppbaseAppApiBaseUrl(config),
    APP_API_PREFIX,
  );
  if (configured) {
    return configured;
  }
  return typeof window === "undefined" ? "" : window.location.origin;
}

function normalizeGeneratedSdkBaseUrl(baseUrl: string, apiPrefix: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  const normalizedApiPrefix = apiPrefix.replace(/\/+$/u, "");
  if (normalizedBaseUrl.endsWith(normalizedApiPrefix)) {
    return normalizedBaseUrl.slice(0, -normalizedApiPrefix.length).replace(/\/+$/u, "");
  }
  return normalizedBaseUrl;
}

/**
 * Projects an IAM session onto the mall session store.
 *
 * The mall gate (`hasSdkworkMallH5IamSession`) needs both tokens and a tenant
 * context; the IAM brick only guarantees the tokens, so the tenant/user fields
 * are read from the session context (and the IAM session identity) and the
 * previous snapshot is used only to keep an already-resolved context during a
 * refresh.
 */
function commitMallH5IamSession(
  session: SdkworkMallH5SessionStore,
  iamSession: IamSession,
): void {
  const previous = session.getSnapshot();
  const context = iamSession.context;
  const tenantId = context?.tenantId ?? previous.context?.tenantId;
  const userId = context?.userId ?? iamSession.user?.id ?? previous.context?.userId;
  const nextContext: NonNullable<SdkworkMallH5SessionSnapshot["context"]> = {
    ...(tenantId ? { tenantId } : {}),
    ...(userId ? { userId } : {}),
    ...(context?.organizationId ? { organizationId: context.organizationId } : {}),
    ...(context?.sessionId || iamSession.sessionId
      ? { sessionId: context?.sessionId ?? iamSession.sessionId }
      : {}),
    ...(context?.appId ? { appId: context.appId } : {}),
    ...(context?.environment ? { environment: context.environment } : {}),
    ...(context?.deploymentMode ? { deploymentMode: context.deploymentMode } : {}),
  };

  session.setSession({
    accessToken: iamSession.accessToken,
    authToken: iamSession.authToken,
    ...(iamSession.refreshToken ? { refreshToken: iamSession.refreshToken } : {}),
    ...(iamSession.sessionId ? { sessionId: iamSession.sessionId } : {}),
    ...(Object.keys(nextContext).length > 0 ? { context: nextContext } : {}),
  });
}

function resolveSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  migrateLegacySessionStorage(SDKWORK_COMMERCE_H5_SESSION_STORAGE_KEY);
  return window.localStorage;
}

function resolveDependencyAppApiBaseUrl(
  config: SdkworkMallH5RuntimeConfig,
  sdkFamily: string,
): string {
  return config.sdkBaseUrls?.dependencySdkBaseUrls?.[sdkFamily]?.appApiBaseUrl
    ?? config.appApiBaseUrl;
}

function migrateLegacySessionStorage(storageKey: string): void {
  const legacySession = window.sessionStorage.getItem(storageKey);
  if (legacySession && !window.localStorage.getItem(storageKey)) {
    window.localStorage.setItem(storageKey, legacySession);
  }
  if (legacySession) {
    window.sessionStorage.removeItem(storageKey);
  }
}
