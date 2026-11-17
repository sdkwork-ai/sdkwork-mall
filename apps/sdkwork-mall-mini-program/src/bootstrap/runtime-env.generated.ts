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
  accessToken: "eyJhbGciOiJub25lIiwia2lkIjoicHVibGljLWFwcC10b2tlbiIsInR5cCI6IkpXVCJ9.eyJhcHBfaWQiOiJfX1NES1dPUktfREVQTE9ZX0FQUExJQ0FUSU9OX0lEX18iLCJhdWQiOiJfX1NES1dPUktfREVQTE9ZX0FQUExJQ0FUSU9OX0lEX18iLCJkZXBsb3ltZW50X21vZGUiOiJzYWFzIiwiZGVwbG95bWVudF9wcm9maWxlIjoiY2xvdWQiLCJlbnZpcm9ubWVudCI6ImRldmVsb3BtZW50IiwiZXhwIjo0MTAyNDQ0ODAwLCJpYXQiOjE3NjcyMjU2MDAsImlzcyI6InNka3dvcmstaWFtLXB1YmxpYyIsImxvZ2luX3Njb3BlIjoiVEVOQU5UIiwib3JnYW5pemF0aW9uX2lkIjoiMCIsInBlcm1pc3Npb25fc2NvcGUiOlsiaWFtOnNlbGYiXSwicnVudGltZV90YXJnZXQiOiJtaW5pLXByb2dyYW0iLCJzZXNzaW9uX2lkIjoiYm9vdHN0cmFwLXB1YmxpYy1fX1NES1dPUktfREVQTE9ZX0FQUExJQ0FUSU9OX0lEX18tY2xvdWQuZGV2ZWxvcG1lbnQiLCJ0ZW5hbnRfaWQiOiIxMDAwMDEiLCJ0b2tlbl9jbGFzcyI6ImFwcGxpY2F0aW9uIiwidG9rZW5fdHlwZSI6ImFjY2VzcyIsInRva2VuX3ZlcnNpb24iOjEsInVzZXJfaWQiOiIwIn0.public",
  applicationPublicHttpUrl: "https://api-dev.sdkwork.com",
  applicationPublicWebSocketUrl: "",
  platformApiGatewayHttpUrl: "https://api-dev.sdkwork.com",
  iamAppApiBaseUrl: "https://api-dev.sdkwork.com",
};

export function getEnvConfig(): AppEnvConfig {
  return ENV_CONFIG;
}
