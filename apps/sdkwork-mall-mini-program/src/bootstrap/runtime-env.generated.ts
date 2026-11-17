/* eslint-disable */
// GENERATED FILE - DO NOT EDIT.
// Source: APP_RUNTIME_ENV_SPEC.md §3.1 and the selected committed env profile.
// Regenerate with: node <sdkwork-specs>/tools/generate-app-env-config.mjs

export interface AppEnvConfig {
  readonly environment: string;
  readonly deploymentProfile: string;
  readonly profileId: string;
  readonly runtimeTarget: string;
  readonly accessToken: string;
  readonly applicationPublicHttpUrl: string;
  readonly applicationPublicWebSocketUrl: string;
  readonly platformApiGatewayHttpUrl: string;
  readonly iamAppApiBaseUrl: string;
}

export const ENV_CONFIG: AppEnvConfig = {
  environment: "production",
  deploymentProfile: "cloud",
  profileId: "cloud.production",
  runtimeTarget: "mini-program",
  accessToken: "eyJhbGciOiJub25lIiwia2lkIjoicHVibGljLWFwcC10b2tlbiIsInR5cCI6IkpXVCJ9.eyJhcHBfaWQiOiJzZGt3b3JrLW1hbGwtbWluaS1wcm9ncmFtIiwiYXVkIjoic2Rrd29yay1tYWxsLW1pbmktcHJvZ3JhbSIsImRlcGxveW1lbnRfbW9kZSI6InNhYXMiLCJkZXBsb3ltZW50X3Byb2ZpbGUiOiJjbG91ZCIsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiIsImV4cCI6NDEwMjQ0NDgwMCwiaWF0IjoxNzY3MjI1NjAwLCJpc3MiOiJzZGt3b3JrLWlhbS1wdWJsaWMiLCJsb2dpbl9zY29wZSI6IlRFTkFOVCIsIm9yZ2FuaXphdGlvbl9pZCI6IjAiLCJwZXJtaXNzaW9uX3Njb3BlIjpbImlhbTpzZWxmIl0sInJ1bnRpbWVfdGFyZ2V0IjoibWluaS1wcm9ncmFtIiwic2Vzc2lvbl9pZCI6ImJvb3RzdHJhcC1wdWJsaWMtc2Rrd29yay1tYWxsLW1pbmktcHJvZ3JhbS1jbG91ZC5wcm9kdWN0aW9uIiwidGVuYW50X2lkIjoiMTAwMDAxIiwidG9rZW5fY2xhc3MiOiJhcHBsaWNhdGlvbiIsInRva2VuX3R5cGUiOiJhY2Nlc3MiLCJ0b2tlbl92ZXJzaW9uIjoxLCJ1c2VyX2lkIjoiMCJ9.public",
  applicationPublicHttpUrl: "https://api.sdkwork.com",
  applicationPublicWebSocketUrl: "",
  platformApiGatewayHttpUrl: "https://api.sdkwork.com",
  iamAppApiBaseUrl: "https://api.sdkwork.com",
};

export function getEnvConfig(): AppEnvConfig {
  return ENV_CONFIG;
}
