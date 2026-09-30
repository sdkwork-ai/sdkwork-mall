/**
 * Mini-program runtime environment.
 *
 * Base URLs come from build-time injection via the runtime bundle
 * (scripts/build-runtime.mjs), never from hard-coded secrets.
 */
export interface SdkworkMallMpRuntimeEnvironment {
  commerceAppApiBaseUrl: string;
  environment: string;
  deploymentProfile: string;
}

export function readRuntimeEnv(): SdkworkMallMpRuntimeEnvironment {
  const globalRuntime = (globalThis as {
    __SDKWORK_MALL_MP_RUNTIME_ENV__?: Partial<SdkworkMallMpRuntimeEnvironment>;
  }).__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
  return {
    commerceAppApiBaseUrl:
      globalRuntime.commerceAppApiBaseUrl ?? "https://api-dev.sdkwork.com/app/v3/api",
    environment: globalRuntime.environment ?? "development",
    deploymentProfile: globalRuntime.deploymentProfile ?? "standalone",
  };
}
