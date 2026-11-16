/**
 * Mini-program runtime environment.
 *
 * Base URLs come from build-time injection via the runtime bundle
 * (scripts/build-runtime.mjs), never from hard-coded secrets. When no injection
 * is present the release channel decides the default so a production build can
 * never silently fall back to the development API host.
 *
 * The channel itself is a host fact (`deviceInfo.accountEnvVersion`) rather than
 * a platform call here: this module stays pure and testable, and the app entry
 * passes the value in.
 */
export interface SdkworkMallMpRuntimeEnvironment {
  commerceAppApiBaseUrl: string;
  environment: string;
  deploymentProfile: string;
}

const PRODUCTION_API_BASE_URL = "https://api.sdkwork.com/app/v3/api";
const DEVELOPMENT_API_BASE_URL = "https://api-dev.sdkwork.com/app/v3/api";

/**
 * Maps the platform account channel onto the deployment environment.
 *
 * @param accountEnvVersion - `wx.getAccountInfoSync().miniProgram.envVersion`.
 */
export function resolveReleaseChannel(accountEnvVersion: string): "development" | "production" {
  return accountEnvVersion === "release" ? "production" : "development";
}

/**
 * Resolves the runtime environment document for this launch.
 *
 * @param accountEnvVersion - Platform release channel from the host profile.
 */
export function readRuntimeEnv(accountEnvVersion: string): SdkworkMallMpRuntimeEnvironment {
  const globalRuntime = (globalThis as {
    __SDKWORK_MALL_MP_RUNTIME_ENV__?: Partial<SdkworkMallMpRuntimeEnvironment>;
  }).__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
  const fallbackEnvironment = resolveReleaseChannel(accountEnvVersion);
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
