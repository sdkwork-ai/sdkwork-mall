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
  environment: "development",
  deploymentProfile: "cloud",
  profileId: "cloud.development",
  runtimeTarget: "mini-program",
  accessToken: "eyJhbGciOiJub25lIiwia2lkIjoicHVibGljLWFwcC10b2tlbiIsInR5cCI6IkpXVCJ9.eyJhcHBfaWQiOiJzZGt3b3JrLW1hbGwtbWluaS1wcm9ncmFtIiwiYXVkIjoic2Rrd29yay1tYWxsLW1pbmktcHJvZ3JhbSIsImRlcGxveW1lbnRfbW9kZSI6InNhYXMiLCJkZXBsb3ltZW50X3Byb2ZpbGUiOiJjbG91ZCIsImVudmlyb25tZW50IjoiZGV2ZWxvcG1lbnQiLCJleHAiOjQxMDI0NDQ4MDAsImlhdCI6MTc2NzIyNTYwMCwiaXNzIjoic2Rrd29yay1pYW0tcHVibGljIiwibG9naW5fc2NvcGUiOiJURU5BTlQiLCJvcmdhbml6YXRpb25faWQiOiIwIiwicGVybWlzc2lvbl9zY29wZSI6WyJpYW06c2VsZiJdLCJydW50aW1lX3RhcmdldCI6Im1pbmktcHJvZ3JhbSIsInNlc3Npb25faWQiOiJib290c3RyYXAtcHVibGljLXNka3dvcmstbWFsbC1taW5pLXByb2dyYW0tY2xvdWQuZGV2ZWxvcG1lbnQiLCJ0ZW5hbnRfaWQiOiIxMDAwMDEiLCJ0b2tlbl9jbGFzcyI6ImFwcGxpY2F0aW9uIiwidG9rZW5fdHlwZSI6ImFjY2VzcyIsInRva2VuX3ZlcnNpb24iOjEsInVzZXJfaWQiOiIwIn0.public",
  applicationPublicHttpUrl: "https://api-dev.sdkwork.com",
  applicationPublicWebSocketUrl: "",
  platformApiGatewayHttpUrl: "https://api-dev.sdkwork.com",
  iamAppApiBaseUrl: "https://api-dev.sdkwork.com",
};

export function getEnvConfig(): AppEnvConfig {
  return ENV_CONFIG;
}
