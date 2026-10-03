// SDKWork Mall WeChat mini-program entry.
// Bootstraps the runtime environment and the commerce service seam. All
// network traffic goes through services/transport.ts (single transport seam).
import type { SdkworkMallMpRuntimeEnvironment } from "./bootstrap/environment";
import { readRuntimeEnv } from "./bootstrap/environment";
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
});
