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
  registerMallMpBootstrap,
  initializeMallMpRuntime,
  platform,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";
import { createMpAuthService } from "@sdkwork/mall-mp-auth";
import { configureMpImServices, createMpImServices } from "@sdkwork/mall-mp-im/im-service";
import { createWeixinHost } from "@sdkwork/mall-mp-host/weixin";

import { readRuntimeEnv } from "./bootstrap/environment";
import { SDKWORK_MALL_MP_CHAT_IMAGE_UPLOAD } from "./bootstrap/uploadDeclaration";
import { mpCapabilityUrl } from "./routes/capabilities";
import { uploadDriveImageDetailed } from "./services/drive-upload-service";
import { createDriveDownloadGrant } from "./services/drive-download-service";
import {
  applyCartTabBadge,
  applyMessageTabBadge,
  syncCartTabBadge,
  syncMessageTabBadge,
} from "./services/tab-bar-service";

// Injected by scripts/build-miniprogram.mjs so the dev-tool console proves which
// package is actually running.
declare const __SDKWORK_MALL_MP_BUILD_ID__: string;

interface MallMpGlobalData {
  commerceApiBaseUrl: string;
  deploymentProfile: string;
  environment: string;
  runtimeError: string;
  runtimeReady: boolean;
}

/**
 * Resolves the launch environment.
 *
 * `readRuntimeEnv` owns the whole merge (build-time module -> channel default);
 * the entry only derives the profile id. No JSON import: the WeChat compiler
 * cannot resolve JSON modules and the app would fail to boot.
 */
function resolveEnvironment(accountEnvVersion: string) {
  const resolved = readRuntimeEnv(accountEnvVersion);
  return {
    environment: resolved.environment,
    deploymentProfile: resolved.deploymentProfile,
    profileId: resolved.profileId,
    appApiBaseUrl: resolved.appApiBaseUrl,
  };
}

/**
 * Installs the runtime and the messaging services.
 *
 * Exported so a test or a devtools console can rebuild the graph after a
 * profile switch; `app.onLaunch` is the only production caller.
 */
export function bootstrapMallMpRuntime(): MallMpRuntime {
  // Published at module scope below: a hot-reloaded page bundle may run before
  // `app.onLaunch` in the new appservice context and rebuild the runtime itself.
  // The host is created first: the release channel it reports decides the
  // fallback API host (spec section 10).
  const host = createWeixinHost();
  const runtime = initializeMallMpRuntime({
    environment: resolveEnvironment(host.deviceInfo.accountEnvVersion()),
    host,
  });
  // Composition: the capability never learns which SDK satisfies each plane
  // (MINI_PROGRAM_APP_ARCHITECTURE_SPEC section 6). The Drive uploader is injected
  // too, so messaging owns no storage flow of its own.
  configureMpImServices(createMpImServices(
    { imAppClient: runtime.imAppClient, imChatClient: runtime.imChatClient },
    {
      resolveCurrentUserId: () => runtime.session.read()?.userId ?? "",
      resolveImageUrl: createDriveDownloadGrant,
      uploadImage: (image) => uploadDriveImageDetailed({
        declaration: SDKWORK_MALL_MP_CHAT_IMAGE_UPLOAD,
        appResourceId: SDKWORK_MALL_MP_CHAT_IMAGE_UPLOAD.scene,
        file: {
          fileName: image.fileName,
          contentType: image.contentType,
          bytes: image.bytes,
        },
      }),
    },
  ));

// Publish the launch bootstrap before App() runs: a hot-reloaded page bundle may
// evaluate in a fresh appservice context where `app.onLaunch` never ran, and its
// capability calls then resolve the runtime through this factory.
registerMallMpBootstrap(bootstrapMallMpRuntime);
  return runtime;
}

App({
  globalData: {
    commerceApiBaseUrl: "",
    deploymentProfile: "standalone",
    environment: "development",
    runtimeError: "",
    runtimeReady: false,
  } as MallMpGlobalData,

  onLaunch() {
    // Which bundle is running: compare this stamp with the build log output.
    console.info("[sdkwork-mall] build", __SDKWORK_MALL_MP_BUILD_ID__);
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
      // The cart tab badge is part of the tab bar contract (H5 renders
      // `readMallH5CartCount`); paint the last known count immediately.
      applyCartTabBadge();
      applyMessageTabBadge();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error("[sdkwork-mall] runtime bootstrap failed", message);
      if (globalData) {
        globalData.runtimeError = message;
      }
    }
  },

  /**
   * Returning from the background can mean the cart changed elsewhere (another
   * client, a stale badge). Re-paint from storage first, then reconcile.
   */
  onShow() {
    try {
      applyCartTabBadge();
      applyMessageTabBadge();
      // `syncCartTabBadge` clears the badge itself when the buyer is signed out.
      void syncCartTabBadge();
      void syncMessageTabBadge();
    } catch (cause) {
      // A failed bootstrap leaves no host installed; the tab badge must never be
      // the reason the app reports an uncaught error.
      const message = cause instanceof Error ? cause.message : String(cause);
      console.warn("[sdkwork-mall] tab badge skipped", message);
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
    platform.switchTab(mpCapabilityUrl("storefront.mall.home"));
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
