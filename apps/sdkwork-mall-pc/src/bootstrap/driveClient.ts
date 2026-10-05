import { createDriveAppClient, type SdkworkDriveAppClient } from "@sdkwork/drive-app-sdk";
import type { SdkworkMallPcRuntimeConfig } from "./environment";
import type { SdkworkMallPcSessionTokenManager } from "./sessionTokenManager";

const APP_API_PREFIX = "/app/v3/api";
const DRIVE_APP_SDK_FAMILY_ID = "sdkwork-drive-app-sdk";

function resolveDependencyAppApiBaseUrl(config: SdkworkMallPcRuntimeConfig, sdkFamily: string): string {
  return config.sdkBaseUrls?.dependencySdkBaseUrls?.[sdkFamily]?.appApiBaseUrl ?? config.appApiBaseUrl;
}

/**
 * The composed Drive App SDK client for the mall PC buyer surface.
 *
 * Built with the same dual-token session token manager every other family
 * uses; the base URL resolves from the dependency family's configured app API
 * base URL (falling back to the storefront gateway), so the drive family
 * follows the app's existing environment topology. Constructed per call
 * (mirroring how the commerce client is rebuilt with the live token manager)
 * — the underlying generated client carries the token manager reference.
 */
export function createSdkworkMallPcDriveAppClient(
  config: SdkworkMallPcRuntimeConfig,
  tokenManager: SdkworkMallPcSessionTokenManager,
): SdkworkDriveAppClient {
  const normalized = resolveDependencyAppApiBaseUrl(config, DRIVE_APP_SDK_FAMILY_ID)
    .replace(/\/+$/, "");
  const baseUrl = normalized.endsWith(APP_API_PREFIX)
    ? normalized.slice(0, normalized.length - APP_API_PREFIX.length)
    : normalized;
  return createDriveAppClient({
    authMode: "dual-token",
    baseUrl,
    platform: "pc",
    tokenManager: tokenManager as never,
  });
}
