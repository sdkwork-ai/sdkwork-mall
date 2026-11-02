/**
 * Mini-program runtime environment.
 *
 * Base URLs come from build-time injection via the runtime bundle
 * (scripts/build-runtime.mjs), never from hard-coded secrets. When no injection
 * is present the release channel decides the default so a production build can
 * never silently fall back to the development API host.
 */
export interface SdkworkMallMpRuntimeEnvironment {
  commerceAppApiBaseUrl: string;
  environment: string;
  deploymentProfile: string;
}

const PRODUCTION_API_BASE_URL = "https://api.sdkwork.com/app/v3/api";
const DEVELOPMENT_API_BASE_URL = "https://api-dev.sdkwork.com/app/v3/api";

/** The platform release channel, when the runtime exposes it. */
function detectReleaseChannel(): "development" | "production" {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion === "release"
      ? "production"
      : "development";
  } catch {
    return "development";
  }
}

export function readRuntimeEnv(): SdkworkMallMpRuntimeEnvironment {
  const globalRuntime = (globalThis as {
    __SDKWORK_MALL_MP_RUNTIME_ENV__?: Partial<SdkworkMallMpRuntimeEnvironment>;
  }).__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
  const fallbackEnvironment = detectReleaseChannel();
  return {
    commerceAppApiBaseUrl:
      globalRuntime.commerceAppApiBaseUrl
      ?? (fallbackEnvironment === "production"
        ? PRODUCTION_API_BASE_URL
        : DEVELOPMENT_API_BASE_URL),
    environment: globalRuntime.environment ?? fallbackEnvironment,
    deploymentProfile: globalRuntime.deploymentProfile ?? "standalone",
  };
}
