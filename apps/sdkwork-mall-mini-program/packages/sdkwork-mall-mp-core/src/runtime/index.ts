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
import { installMallMpHost } from "../host";
import {
  createMpRequestClient,
  type MpRequestClient,
} from "../request";
import {
  createMpIamAppSdkClient,
  createMpImAppSdkClient,
  createMpImChatSdkClient,
  type IamAppSdkClient,
  type ImAppSdkClient,
  type ImChatSdkClient,
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
  readonly environment: MallMpRuntimeEnvironment;
  readonly host: MpHost;
  readonly iamClient: IamAppSdkClient;
  readonly imAppClient: ImAppSdkClient;
  readonly imChatClient: ImChatSdkClient;
  readonly request: MpRequestClient;
  readonly session: MpSessionStore;
  readonly tokenManager: MpTokenManager;
}

export interface InitializeMallMpRuntimeInput {
  readonly environment: MallMpRuntimeEnvironment;
  readonly host: MpHost;
}

let runtime: MallMpRuntime | null = null;

/**
 * Builds the runtime and installs it as the process-wide singleton.
 *
 * Called once from `app.ts#onLaunch`. Throws when the environment document or the
 * host profile is incomplete so a mis-materialized build fails at launch with a
 * readable reason instead of at the first network call.
 */
export function initializeMallMpRuntime(input: InitializeMallMpRuntimeInput): MallMpRuntime {
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
  const session = createMpSessionStore(input.host.storage);
  const tokenManager = createMpSessionTokenManager(session);
  const request = createMpRequestClient({
    baseUrl: () => input.environment.appApiBaseUrl,
    http: input.host.http,
    session,
  });
  const iamClient = createMpIamAppSdkClient({ baseUrl: appApiBaseUrl, tokenManager });
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

  runtime = {
    environment: input.environment,
    host: input.host,
    session,
    tokenManager,
    request,
    iamClient,
    imAppClient,
    imChatClient,
    authManager,
  };
  return runtime;
}

/** Reads the installed runtime; a cold call before bootstrap is a programming error. */
export function getMallMpRuntime(): MallMpRuntime {
  if (!runtime) {
    throw new Error("mall mini program: runtime is not initialized; call initializeMallMpRuntime from app.onLaunch");
  }
  return runtime;
}

export function isMallMpRuntimeInitialized(): boolean {
  return runtime !== null;
}

/** Test/devtools hook: drops the singleton so a scenario can rebuild it. */
export function resetMallMpRuntime(): void {
  runtime = null;
}
