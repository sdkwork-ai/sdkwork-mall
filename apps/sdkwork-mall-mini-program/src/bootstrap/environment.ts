/**
 * Mini-program runtime environment.
 *
 * Base URLs are projected at build time from one committed client-env profile by
 * the canonical generator (APP_RUNTIME_ENV_SPEC.md §3.1):
 * `runtime-env.generated.ts` (`ENV_CONFIG`) is the only source. Release code must
 * never parse the profile JSON or bake a deploy URL into a source constant.
 *
 * The channel is a host fact (`deviceInfo.accountEnvVersion`); this module stays
 * pure and testable, and the app entry passes the value in.
 */
import { resolveGlobalObject } from "@sdkwork/mall-mp-core";

import { ENV_CONFIG } from "./runtime-env.generated";

export interface SdkworkMallMpRuntimeEnvironment {
  readonly accessToken: string;
  readonly applicationPublicHttpUrl: string;
  /** Commerce app-api base derived from the platform gateway origin. */
  readonly appApiBaseUrl: string;
  readonly deploymentProfile: string;
  readonly environment: string;
  readonly platformApiGatewayHttpUrl: string;
  readonly profileId: string;
  readonly runtimeTarget: string;
}

const APP_API_PATH = "/app/v3/api";

/**
 * Maps the platform account channel onto the deployment environment.
 *
 * @param accountEnvVersion - `wx.getAccountInfoSync().miniProgram.envVersion`.
 */
export function resolveReleaseChannel(accountEnvVersion: string): "development" | "production" {
  return accountEnvVersion === "release" ? "production" : "development";
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, "");
}

/**
 * Resolves the runtime environment document for this launch.
 *
 * Precedence: runtime global injection (tests, DevTools console override) ->
 * generated EnvConfig. A release-channel build must run a production profile;
 * a mismatch is surfaced instead of silently pointing the app at dev hosts.
 *
 * @param accountEnvVersion - Platform release channel from the host profile.
 */
export function readRuntimeEnv(accountEnvVersion: string): SdkworkMallMpRuntimeEnvironment {
  // Never dereference `globalThis` unguarded: the WeChat appservice does not
  // reliably define it (base library 3.18 raised "Cannot read property … of
  // undefined" here). The host scope resolver tries the real global objects.
  const injected = resolveGlobalObject() as {
    __SDKWORK_MALL_MP_RUNTIME_ENV__?: Partial<SdkworkMallMpRuntimeEnvironment>;
  };
  const globalRuntime = injected.__SDKWORK_MALL_MP_RUNTIME_ENV__ ?? {};
  const channel = resolveReleaseChannel(accountEnvVersion);
  const environment = globalRuntime.environment ?? ENV_CONFIG.environment;
  const platformApiGatewayHttpUrl = trimTrailingSlashes(
    globalRuntime.platformApiGatewayHttpUrl ?? ENV_CONFIG.platformApiGatewayHttpUrl,
  );
  const appApiBaseUrl = globalRuntime.appApiBaseUrl
    ?? (platformApiGatewayHttpUrl ? `${platformApiGatewayHttpUrl}${APP_API_PATH}` : "");
  if (channel === "production" && environment !== "production") {
    console.warn(
      `[sdkwork-mall] release channel is production but the packaged profile is ${ENV_CONFIG.profileId}; rebuild with a production profile.`,
    );
  }
  return {
    accessToken: ENV_CONFIG.accessToken,
    applicationPublicHttpUrl: globalRuntime.applicationPublicHttpUrl ?? ENV_CONFIG.applicationPublicHttpUrl,
    appApiBaseUrl,
    deploymentProfile: globalRuntime.deploymentProfile ?? ENV_CONFIG.deploymentProfile,
    environment,
    platformApiGatewayHttpUrl,
    profileId: globalRuntime.profileId ?? ENV_CONFIG.profileId,
    runtimeTarget: ENV_CONFIG.runtimeTarget,
  };
}
