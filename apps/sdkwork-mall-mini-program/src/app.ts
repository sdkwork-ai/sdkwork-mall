// SDKWork Mall WeChat mini-program entry.
//
// Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 1-2. `src/` stays
// thin: this file only resolves the runtime environment, installs the WeChat host
// profile, composes the SDKWork packages (`@sdkwork/mall-mp-core`) and wires the
// capability services. Business behavior lives in `packages/`.
//
// Domain ownership: authentication is SDKWork IAM (`@sdkwork/iam-mp-core`
// session module), messaging is SDKWork IM (`@sdkwork/im-mp-chat` services).
import {
  getMallMpRuntime,
  initializeMallMpRuntime,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";
import { createMpAuthService } from "@sdkwork/mall-mp-auth";
import { configureMpImServices, createMpImServices } from "@sdkwork/mall-mp-im/im-service";
import { createWeixinHost } from "@sdkwork/mall-mp-host/weixin";

import { readRuntimeEnv } from "./bootstrap/environment";
import { mpCapabilityUrl } from "./routes/capabilities";
import runtimeEnvJson from "./runtime-env.json";

interface MallMpGlobalData {
  commerceApiBaseUrl: string;
  deploymentProfile: string;
  environment: string;
  runtimeError: string;
  runtimeReady: boolean;
}

// Build-time materialized bundle (scripts/build-runtime.mjs) with the
// runtime-injection override taking precedence.
const injected = readRuntimeEnv();
const fromBundle = runtimeEnvJson as {
  commerceAppApiBaseUrl?: string;
  deploymentProfile?: string;
  environment?: string;
  profileId?: string;
  surfaceCode?: string;
};

const FALLBACK_API_BASE_URL = "https://api-dev.sdkwork.com/app/v3/api";

function resolveEnvironment() {
  const environment = fromBundle.environment ?? injected.environment;
  const deploymentProfile = fromBundle.deploymentProfile ?? injected.deploymentProfile;
  const appApiBaseUrl =
    injected.commerceAppApiBaseUrl ?? fromBundle.commerceAppApiBaseUrl ?? FALLBACK_API_BASE_URL;
  return {
    environment,
    deploymentProfile,
    profileId: fromBundle.profileId ?? `${deploymentProfile}.${environment}`,
    appApiBaseUrl,
    ...(fromBundle.surfaceCode ? { surfaceCode: fromBundle.surfaceCode } : {}),
  };
}

/**
 * Installs the runtime and the messaging services.
 *
 * Exported so a test or a devtools console can rebuild the graph after a
 * profile switch; `app.onLaunch` is the only production caller.
 */
export function bootstrapMallMpRuntime(): MallMpRuntime {
  const runtime = initializeMallMpRuntime({
    environment: resolveEnvironment(),
    host: createWeixinHost(),
  });
  // Composition: the capability never learns which SDK satisfies each plane
  // (MINI_PROGRAM_APP_ARCHITECTURE_SPEC section 6).
  configureMpImServices(createMpImServices(
    { imAppClient: runtime.imAppClient, imChatClient: runtime.imChatClient },
    { resolveCurrentUserId: () => runtime.session.read()?.userId ?? "" },
  ));
  return runtime;
}

App({
  globalData: {
    commerceApiBaseUrl: FALLBACK_API_BASE_URL,
    deploymentProfile: "standalone",
    environment: "development",
    runtimeError: "",
    runtimeReady: false,
  } as MallMpGlobalData,

  onLaunch() {
    const globalData = (this as { globalData?: MallMpGlobalData }).globalData;
    try {
      const runtime = bootstrapMallMpRuntime();
      if (globalData) {
        globalData.commerceApiBaseUrl = runtime.environment.appApiBaseUrl;
        globalData.deploymentProfile = runtime.environment.deploymentProfile;
        globalData.environment = runtime.environment.environment;
        globalData.runtimeReady = true;
      }
      // Cold-launch session recovery runs off the critical path: the storefront
      // is browsable without a session, and pages re-read the store on show.
      void restoreSession();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error("[sdkwork-mall] runtime bootstrap failed", message);
      if (globalData) {
        globalData.runtimeError = message;
      }
    }
  },

  /**
   * Uncaught script errors are logged here; without a handler they fail silently
   * in release builds and leave the buyer on a frozen page.
   */
  onError(error: string) {
    console.error("[sdkwork-mall] uncaught error", error);
  },

  /** Rejected promises outside a page's own try/catch (e.g. fire-and-forget). */
  onUnhandledRejection(event: { reason?: unknown }) {
    console.error("[sdkwork-mall] unhandled rejection", event?.reason);
  },

  /**
   * A deep link or an outdated share card can target a page this release no
   * longer declares. Land the buyer on the storefront home tab instead of the
   * platform's blank "page not found" screen.
   */
  onPageNotFound() {
    console.warn("[sdkwork-mall] page not found, redirecting to home");
    wx.switchTab({ url: mpCapabilityUrl("storefront.mall.home") });
  },
});

/**
 * Re-validates the persisted session once per launch through the IAM module.
 *
 * Only a definitive IAM rejection clears it (`IAM_LOGIN_INTEGRATION_SPEC.md`
 * section 5.2); a transient failure keeps the buyer signed in.
 */
async function restoreSession(): Promise<void> {
  const runtime = getMallMpRuntime();
  if (!runtime.session.read()) {
    return;
  }
  const result = await createMpAuthService(runtime).restore();
  if (!result.authenticated && result.reason === "rejected") {
    console.warn("[sdkwork-mall] session rejected by IAM; local session cleared");
  }
}
