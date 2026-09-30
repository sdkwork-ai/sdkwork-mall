import manifest from "../../sdkwork.app.config.json";
import { resolveSharedSdkApiBaseUrl } from "./resolveSdkApiBaseUrl";

export type SdkworkMallH5Environment =
  | "development"
  | "test"
  | "staging"
  | "production";

export type SdkworkMallH5ConfigProfile =
  | "dev"
  | "test"
  | "staging"
  | "prod";

export type SdkworkMallH5DeploymentMode = "web";
export type SdkworkMallH5RuntimeTarget = "browser";
export type SdkworkMallH5BuildMode = SdkworkMallH5Environment;

export interface SdkworkMallH5AuthRuntimeConfig {
  accessTokenHeader: "Access-Token";
  authTokenHeader: "Authorization";
  refreshEnabled: boolean;
  tokenManagerMode: "appbase-global";
  tokenStorage: "browser-session";
}

export interface SdkworkMallH5I18nRuntimeConfig {
  defaultLocale: string;
  fallbackLocale: string;
  supportedLocales: string[];
}

export interface SdkworkMallH5DependencySdkBaseUrls {
  appApiBaseUrl?: string;
  backendApiBaseUrl?: string;
}

export interface SdkworkMallH5SdkBaseUrls {
  appApiBaseUrl?: string;
  backendApiBaseUrl?: string;
  dependencySdkBaseUrls?: Record<string, SdkworkMallH5DependencySdkBaseUrls>;
  sdkBaseUrl?: string;
}

export interface SdkworkMallH5RuntimeConfig {
  appApiBaseUrl: string;
  appDisplayName: string;
  appKey: string;
  auth: SdkworkMallH5AuthRuntimeConfig;
  backendApiBaseUrl?: string;
  buildMode: SdkworkMallH5BuildMode;
  configProfile: SdkworkMallH5ConfigProfile;
  deploymentMode: SdkworkMallH5DeploymentMode;
  environment: SdkworkMallH5Environment;
  i18n: SdkworkMallH5I18nRuntimeConfig;
  runtimeTarget: SdkworkMallH5RuntimeTarget;
  sdkBaseUrl?: string;
  sdkBaseUrls?: SdkworkMallH5SdkBaseUrls;
  version: string;
}

const environmentByMode: Record<string, SdkworkMallH5Environment> = {
  development: "development",
  dev: "development",
  production: "production",
  prod: "production",
  staging: "staging",
  test: "test",
};

const profileByEnvironment: Record<SdkworkMallH5Environment, SdkworkMallH5ConfigProfile> = {
  development: "dev",
  production: "prod",
  staging: "staging",
  test: "test",
};

function envValue(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveEnvironment(mode: string): SdkworkMallH5Environment {
  return environmentByMode[mode] ?? "development";
}

function parseSdkBaseUrls(
  sdkBaseUrl?: string,
): SdkworkMallH5SdkBaseUrls | undefined {
  const raw = envValue("VITE_SDKWORK_COMMERCE_H5_SDK_BASE_URLS_JSON");
  if (raw) {
    try {
      return JSON.parse(raw) as SdkworkMallH5SdkBaseUrls;
    } catch {
      return undefined;
    }
  }

  if (!sdkBaseUrl) {
    return undefined;
  }

  const normalizedSdkBaseUrl = sdkBaseUrl.replace(/\/+$/u, "");
  return {
    appApiBaseUrl: `${normalizedSdkBaseUrl}/app/v3/api`,
    backendApiBaseUrl: `${normalizedSdkBaseUrl}/backend/v3/api`,
    dependencySdkBaseUrls: {
      "sdkwork-iam-app-sdk": {
        appApiBaseUrl: `${normalizedSdkBaseUrl}/app/v3/api`,
      },
      "sdkwork-iam-backend-sdk": {
        backendApiBaseUrl: `${normalizedSdkBaseUrl}/backend/v3/api`,
      },
    },
    sdkBaseUrl: normalizedSdkBaseUrl,
  };
}

export function resolveSdkworkMallH5RuntimeConfig(
  mode = import.meta.env.MODE,
): SdkworkMallH5RuntimeConfig {
  const environment = resolveEnvironment(mode);
  const sdkBaseUrl = envValue("VITE_SDKWORK_COMMERCE_H5_SDK_BASE_URL");
  const sdkBaseUrls = parseSdkBaseUrls(sdkBaseUrl);

  return {
    appApiBaseUrl: (resolveSharedSdkApiBaseUrl() !== undefined
      ? `${resolveSharedSdkApiBaseUrl()}/app/v3/api`
      : undefined)
      ?? envValue("VITE_SDKWORK_COMMERCE_H5_APP_API_BASE_URL")
      ?? sdkBaseUrls?.appApiBaseUrl
      ?? (sdkBaseUrl ? `${sdkBaseUrl.replace(/\/+$/u, "")}/app/v3/api` : "/app/v3/api"),
    appDisplayName: manifest.app.displayName,
    appKey: manifest.app.key,
    auth: {
      accessTokenHeader: "Access-Token",
      authTokenHeader: "Authorization",
      refreshEnabled: true,
      tokenManagerMode: "appbase-global",
      tokenStorage: "browser-session",
    },
    backendApiBaseUrl: (resolveSharedSdkApiBaseUrl() !== undefined
      ? `${resolveSharedSdkApiBaseUrl()}/backend/v3/api`
      : undefined)
      ?? envValue("VITE_SDKWORK_COMMERCE_H5_BACKEND_API_BASE_URL")
      ?? sdkBaseUrls?.backendApiBaseUrl,
    buildMode: environment,
    configProfile: profileByEnvironment[environment],
    deploymentMode: "web",
    environment,
    i18n: {
      defaultLocale: envValue("VITE_SDKWORK_COMMERCE_H5_DEFAULT_LOCALE") ?? "zh-CN",
      fallbackLocale: "en-US",
      supportedLocales: ["zh-CN", "en-US"],
    },
    runtimeTarget: "browser",
    sdkBaseUrl,
    sdkBaseUrls,
    version: manifest.release.currentVersion,
  };
}
