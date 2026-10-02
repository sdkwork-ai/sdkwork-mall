// SDKWork Mall WeChat mini-program entry.
// Bootstraps the runtime environment and the commerce service seam. All
// network traffic goes through services/transport.js (single transport seam).
let runtimeEnv = {};
try {
  runtimeEnv = require("./runtime-env.json");
} catch (error) {
  runtimeEnv = {};
}

App({
  onLaunch() {
    const injected = globalThis.__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
    this.globalData = {
      environment: runtimeEnv.environment ?? injected.environment ?? "development",
      deploymentProfile: runtimeEnv.deploymentProfile ?? injected.deploymentProfile ?? "standalone",
      commerceApiBaseUrl:
        injected.commerceAppApiBaseUrl ?? runtimeEnv.commerceAppApiBaseUrl ?? "https://api-dev.sdkwork.com/app/v3/api",
    };
  },

  globalData: {
    environment: "development",
    deploymentProfile: "standalone",
    commerceApiBaseUrl: "https://api-dev.sdkwork.com/app/v3/api",
  },
});
