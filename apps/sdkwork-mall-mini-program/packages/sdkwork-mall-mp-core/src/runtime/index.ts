/**
 * Runtime composition for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 1 ("thin app
 * bootstrap -> SDKWork packages -> generated app SDKs -> typed host adapters")
 * and section 6 (dependency direction). This is the single place that binds a
 * host profile, a runtime environment document, the IAM session module and the
 * generated clients together.
 *
 * Authentication is **not** implemented here: `@sdkwork/iam-mp-core/session-wechat`
 * owns the exchange, persistence and revalidation, and this runtime only
 * instantiates it with the mall's host storage and generated IAM client.
 */
import type { MpHost } from "@sdkwork/mall-mp-host";

import { validateMallMpComposition } from "../composition";
import { installMallMpHost, isMallMpHostInstalled } from "../host";
import { readSharedState, writeSharedState } from "@sdkwork/mall-mp-host";
import { MP_RUNTIME_BOOTSTRAP_SHARED_KEY, MP_RUNTIME_SHARED_KEY } from "../shared-keys";
import { installMpFetch } from "@sdkwork/mall-mp-host/fetch";
import {
  createMpRequestClient,
  type MpRequestClient,
} from "../request";
import {
  createMpCommerceAppSdkClient,
  createMpIamAppSdkClient,
  createMpImAppSdkClient,
  createMpImChatSdkClient,
  createMpOrderAppSdkClient,
  createMpPartnerAppSdkClient,
  type IamAppSdkClient,
  type ImAppSdkClient,
  type ImChatSdkClient,
  type MpCommerceAppSdkClient,
  type MpOrderAppSdkClient,
  type MpPartnerAppSdkClient,
} from "../sdk";
import {
  createIamMpWechatSessionManager,
  createMpSessionStore,
  createMpSessionTokenManager,
  type IamMpWechatSessionManager,
  type MpSessionStore,
  type MpTokenManager,
} from "../session";

/** Public runtime document the build materializes per deployment profile. */
export interface MallMpRuntimeEnvironment {
  readonly appApiBaseUrl: string;
  readonly deploymentProfile: string;
  readonly environment: string;
  /** IM app-api origin; defaults to `appApiBaseUrl` when the gateway is shared. */
  readonly imAppApiBaseUrl?: string;
  /** IM conversation API origin; defaults to the app-api origin. */
  readonly imChatApiBaseUrl?: string;
  readonly profileId: string;
  /** Registered IAM OAuth mini-program surface code, when the tenant configures one. */
  readonly surfaceCode?: string;
}

export interface MallMpRuntime {
  /** IAM-owned session lifecycle (WeChat exchange, restore, logout). */
  readonly authManager: IamMpWechatSessionManager;
  /** Mall commerce app SDK: catalog, cart, checkout, payments, promotions, … */
  readonly commerceClient: MpCommerceAppSdkClient;
  readonly environment: MallMpRuntimeEnvironment;
  readonly host: MpHost;
  readonly iamClient: IamAppSdkClient;
  readonly imAppClient: ImAppSdkClient;
  readonly imChatClient: ImChatSdkClient;
  /** Order block (orders, cancellations, receipts, payments, shipments). */
  readonly orderClient: MpOrderAppSdkClient;
  /** Partner block (join programme, partner centre). */
  readonly partnerClient: MpPartnerAppSdkClient;
  readonly request: MpRequestClient;
  readonly session: MpSessionStore;
  readonly tokenManager: MpTokenManager;
}

export interface InitializeMallMpRuntimeInput {
  readonly environment: MallMpRuntimeEnvironment;
  readonly host: MpHost;
}

/**
 * Runtime singleton keys.
 *
 * The published package is bundled per entry (app + every page), so each bundle
 * would otherwise get its own module instance and therefore its own null runtime:
 * `app.onLaunch` initialized one copy while pages read another. The instance lives
 * in the shared cross-bundle store (`getApp().globalData` and the platform global),
 * and the bootstrap factory is published the same way so a page bundle can rebuild
 * the runtime after a hot reload that skipped `app.onLaunch`.
 */
const RUNTIME_GLOBAL_KEY = "__SDKWORK_MALL_MP_RUNTIME__";
const RUNTIME_BOOTSTRAP_KEY = "__SDKWORK_MALL_MP_RUNTIME_BOOTSTRAP__";

function readInstalledRuntime(): MallMpRuntime | null {
  return readSharedState<MallMpRuntime | null>(RUNTIME_GLOBAL_KEY) ?? null;
}

function writeInstalledRuntime(next: MallMpRuntime | null): void {
  writeSharedState(RUNTIME_GLOBAL_KEY, next);
}

/**
 * Publishes the launch bootstrap so any bundle can rebuild the runtime.
 *
 * Called at module scope of the app entry: with dev-tool hot reload a page bundle
 * may evaluate without `app.onLaunch` ever running in the new appservice context.
 */
export function registerMallMpBootstrap(factory: () => MallMpRuntime): void {
  writeSharedState(RUNTIME_BOOTSTRAP_KEY, factory);
}

/**
 * Builds the runtime and installs it as the process-wide singleton.
 *
 * Called once from `app.ts#onLaunch`. Throws when the environment document or the
 * host profile is incomplete so a mis-materialized build fails at launch with a
 * readable reason instead of at the first network call.
 */
export function initializeMallMpRuntime(input: InitializeMallMpRuntimeInput): MallMpRuntime {
  // Idempotent: hot reload and the lazy page-side bootstrap may both call this in
  // one appservice lifetime; a second host/client graph would split session state.
  // A runtime without its host means the shared store was partially cleared, so the
  // graph is rebuilt rather than returned half-installed.
  const existing = readInstalledRuntime();
  if (existing && isMallMpHostInstalled()) {
    return existing;
  }
  const issues = validateMallMpComposition(input.environment, input.host.capabilities);
  if (issues.length > 0) {
    // Fail closed at launch: a graph missing its login/storage capability or a
    // runtime key can only produce a half-working storefront.
    throw new Error(`mall mini program composition is incomplete: ${issues.join("; ")}`);
  }
  const appApiBaseUrl = input.environment.appApiBaseUrl.trim();
  if (!appApiBaseUrl) {
    throw new Error("mall mini program: app-api base URL is missing from the runtime environment");
  }
  installMallMpHost(input.host);
  // Generated SDKWork SDKs issue every request through the global `fetch`.
  // WeChat has none, so the host adapter is installed once, before any client is
  // built (`@sdkwork/sdk-common` `BaseHttpClient` reads it per request).
  installMpFetch(input.host.http);
  const session = createMpSessionStore(input.host.storage);
  const tokenManager = createMpSessionTokenManager(session);
  const request = createMpRequestClient({
    baseUrl: () => input.environment.appApiBaseUrl,
    http: input.host.http,
    session,
  });
  const iamClient = createMpIamAppSdkClient({ baseUrl: appApiBaseUrl, tokenManager });
  const commerceClient = createMpCommerceAppSdkClient({ baseUrl: appApiBaseUrl, tokenManager });
  const orderClient = createMpOrderAppSdkClient({ baseUrl: appApiBaseUrl, tokenManager });
  const partnerClient = createMpPartnerAppSdkClient({ baseUrl: appApiBaseUrl, tokenManager });
  const imAppClient = createMpImAppSdkClient({
    baseUrl: input.environment.imAppApiBaseUrl ?? appApiBaseUrl,
    tokenManager,
  });
  const imChatClient = createMpImChatSdkClient({
    baseUrl: input.environment.imChatApiBaseUrl ?? input.environment.imAppApiBaseUrl ?? appApiBaseUrl,
    socket: input.host.socket,
    tokenManager,
  });
  const authManager = createIamMpWechatSessionManager({
    client: iamClient,
    store: session,
    ...(input.environment.surfaceCode ? { surfaceCode: input.environment.surfaceCode } : {}),
  });

  const installed: MallMpRuntime = {
    environment: input.environment,
    host: input.host,
    session,
    tokenManager,
    request,
    iamClient,
    commerceClient,
    orderClient,
    partnerClient,
    imAppClient,
    imChatClient,
    authManager,
  };
  writeInstalledRuntime(installed);
  return installed;
}

/**
 * Reads the installed runtime.
 *
 * Self-healing: when a page bundle evaluates before `app.onLaunch` (dev-tool hot
 * reload re-runs page modules in a fresh appservice context), the published
 * bootstrap factory rebuilds the runtime instead of throwing at the first
 * `onShow`. A failed bootstrap surfaces its own error.
 */
export function getMallMpRuntime(): MallMpRuntime {
  const runtime = readInstalledRuntime();
  if (runtime) {
    return runtime;
  }
  const bootstrap = readSharedState<(() => MallMpRuntime) | null>(RUNTIME_BOOTSTRAP_KEY) ?? null;
  if (bootstrap) {
    const built = bootstrap();
    if (built) {
      return built;
    }
  }
  throw new Error("mall mini program: runtime is not initialized; call initializeMallMpRuntime from app.onLaunch");
}

export function isMallMpRuntimeInitialized(): boolean {
  return readInstalledRuntime() !== null;
}

/** Test/devtools hook: drops the singleton so a scenario can rebuild it. */
export function resetMallMpRuntime(): void {
  writeInstalledRuntime(null);
}
