// SDKWork Mall WeChat mini-program entry.
// Bootstraps the runtime environment and the commerce service seam. All
// network traffic goes through services/transport.ts (single transport seam).
import type { SdkworkMallMpRuntimeEnvironment } from "./bootstrap/environment";
import { readRuntimeEnv } from "./bootstrap/environment";
import { mpCapabilityUrl } from "./routes/capabilities";
import runtimeEnvJson from "./runtime-env.json";

interface MallMpGlobalData {
  environment: string;
  deploymentProfile: string;
  commerceApiBaseUrl: string;
}

// Build-time materialized bundle (scripts/build-runtime.mjs) with the
// runtime-injection override taking precedence.
const injected = readRuntimeEnv();
const fromBundle = runtimeEnvJson as Partial<SdkworkMallMpRuntimeEnvironment>;

const defaultGlobalData: MallMpGlobalData = {
  environment: "development",
  deploymentProfile: "standalone",
  commerceApiBaseUrl: "https://api-dev.sdkwork.com/app/v3/api",
};

App({
  onLaunch() {
    (this as { globalData?: MallMpGlobalData }).globalData = {
      environment: fromBundle.environment ?? injected.environment,
      deploymentProfile: fromBundle.deploymentProfile ?? injected.deploymentProfile,
      commerceApiBaseUrl:
        injected.commerceAppApiBaseUrl
          ?? fromBundle.commerceAppApiBaseUrl
          ?? defaultGlobalData.commerceApiBaseUrl,
    };
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
