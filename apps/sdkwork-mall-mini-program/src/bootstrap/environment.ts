/**
 * Mini-program runtime environment.
 *
 * Base URLs come from the build-time materialized module
 * (`runtime-env.generated.ts`, written by `scripts/build-runtime.mjs`), never
 * from hard-coded secrets. The release channel still decides the production
 * default, so a production build can never silently fall back to the development
 * API host even if the materialized file was left at its development values.
 *
 * A TypeScript module rather than a JSON import: the WeChat compiler emits
 * `require("./runtime-env.json")` for a JSON import, which the mini-program
 * module system cannot resolve and which aborts the whole app boot.
 *
 * The channel itself is a host fact (`deviceInfo.accountEnvVersion`) rather than
 * a platform call here: this module stays pure and testable, and the app entry
 * passes the value in.
 */
import { RUNTIME_ENV } from "./runtime-env.generated";

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
 * Precedence: runtime global injection (tests, DevTools console override) →
 * build-time materialized values → release-channel default.
 *
 * @param accountEnvVersion - Platform release channel from the host profile.
 */
export function readRuntimeEnv(accountEnvVersion: string): SdkworkMallMpRuntimeEnvironment {
  const globalRuntime = (globalThis as {
    __SDKWORK_MALL_MP_RUNTIME_ENV__?: Partial<SdkworkMallMpRuntimeEnvironment>;
  }).__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
  const channel = resolveReleaseChannel(accountEnvVersion);
  const environment = globalRuntime.environment ?? RUNTIME_ENV.environment ?? channel;
  // A release channel is a production build no matter what the materialized file
  // says; a materialized `production` environment is production too.
  const production = channel === "production" || environment === "production";
  return {
    commerceAppApiBaseUrl:
      globalRuntime.commerceAppApiBaseUrl
      ?? (production ? PRODUCTION_API_BASE_URL : RUNTIME_ENV.commerceAppApiBaseUrl || DEVELOPMENT_API_BASE_URL),
    environment,
    deploymentProfile: globalRuntime.deploymentProfile ?? RUNTIME_ENV.deploymentProfile ?? "standalone",
  };
}
