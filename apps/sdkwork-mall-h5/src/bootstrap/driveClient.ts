import { createDriveAppClient, type SdkworkDriveAppClient } from "@sdkwork/drive-app-sdk";
import type { SdkworkMallH5RuntimeConfig } from "./environment";
import { createSdkworkMallH5SessionTokenManager } from "./sessionTokenManager";

type SdkworkMallH5SessionTokenManager = ReturnType<typeof createSdkworkMallH5SessionTokenManager>;

const APP_API_PREFIX = "/app/v3/api";
const DRIVE_APP_SDK_FAMILY_ID = "sdkwork-drive-app-sdk";

function resolveDependencyAppApiBaseUrl(config: SdkworkMallH5RuntimeConfig, sdkFamily: string): string {
  return config.sdkBaseUrls?.dependencySdkBaseUrls?.[sdkFamily]?.appApiBaseUrl ?? config.appApiBaseUrl;
}

/**
 * The composed Drive App SDK client for the mall H5 buyer surface.
 *
 * Built with the same session token manager every other family uses; the base
 * URL resolves from the dependency family's configured app API base URL
 * (falling back to the storefront gateway), so the drive family follows the
 * app's existing environment topology. Constructed per call (mirroring how
 * the commerce client is rebuilt with the live token manager) — the
 * underlying generated client carries the token manager reference.
 */
export function createSdkworkMallH5DriveAppClient(
  config: SdkworkMallH5RuntimeConfig,
  tokenManager: SdkworkMallH5SessionTokenManager,
): SdkworkDriveAppClient {
  const normalized = resolveDependencyAppApiBaseUrl(config, DRIVE_APP_SDK_FAMILY_ID)
    .replace(/\/+$/, "");
  const baseUrl = normalized.endsWith(APP_API_PREFIX)
    ? normalized.slice(0, normalized.length - APP_API_PREFIX.length)
    : normalized;
  return createDriveAppClient({
    authMode: "dual-token",
    baseUrl,
    platform: "h5",
    tokenManager: tokenManager as never,
  });
}
