export type SdkworkMallPcSdkSurface = "app" | "open";

export type SdkworkMallPcCredentialScope = "api-key-provider" | "global-session";

export type SdkworkMallPcRouteSurface =
  | "storefront"
  | "buyer"
  | "merchant"
  | "backend-admin";

export interface SdkworkMallPcRouteContribution {
  readonly auth: "public" | "required";
  readonly capability: string;
  readonly domain: "commerce";
  readonly id: string;
  readonly packageName: string;
  readonly path: string;
  readonly permissionHint?: string;
  readonly screen: string;
  readonly surface: SdkworkMallPcRouteSurface;
  readonly title: string;
  readonly titleKey: string;
}

export interface SdkworkMallPcSdkFamilyInventoryItem {
  readonly authority: string;
  readonly family: string;
  readonly generationInputSpec: string;
  readonly generatedPackageName?: string;
  readonly surface: SdkworkMallPcSdkSurface;
  readonly tokenManagerScope: SdkworkMallPcCredentialScope;
}

export const sdkworkMallPcRuntimeIdentity = {
  appKey: "sdkwork-mall-pc",
  architecture: "pc-react",
  domain: "commerce",
  runtimeFamily: "web",
} as const;

export const sdkworkMallPcAppSdkFamilies = [
  {
    authority: "sdkwork-account.app",
    family: "sdkwork-account-app-sdk",
    generationInputSpec: "../sdkwork-account/sdks/sdkwork-account-app-sdk/openapi/account-app-api.sdkgen.yaml",
    generatedPackageName: "@sdkwork/account-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-commerce-app-api",
    family: "sdkwork-commerce-app-sdk",
    generationInputSpec: "apis/app-api/commerce/commerce-app-api.openapi.json",
    generatedPackageName: "@sdkwork/cloudrouter-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-iam-app-api",
    family: "sdkwork-iam-app-sdk",
    generationInputSpec: "../sdkwork-iam/sdks/sdkwork-iam-app-sdk/openapi/sdkwork-iam-app-api.openapi.yaml",
    generatedPackageName: "@sdkwork/iam-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-membership-app-api",
    family: "sdkwork-membership-app-sdk",
    generationInputSpec: "../sdkwork-membership/sdks/sdkwork-membership-app-sdk/openapi/sdkwork-membership-app-api.sdkgen.json",
    generatedPackageName: "@sdkwork/membership-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-order-app-api",
    family: "sdkwork-order-app-sdk",
    generationInputSpec: "../sdkwork-order/sdks/sdkwork-order-app-sdk/openapi/sdkwork-order-app-api.sdkgen.json",
    generatedPackageName: "@sdkwork/order-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-partner-app-api",
    family: "sdkwork-partner-app-sdk",
    generationInputSpec: "../sdkwork-partner/sdks/sdkwork-partner-app-sdk/openapi/sdkwork-partner-app-api.sdkgen.json",
    generatedPackageName: "@sdkwork/partner-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-payment-app-api",
    family: "sdkwork-payment-app-sdk",
    generationInputSpec: "../sdkwork-payment/sdks/sdkwork-payment-app-sdk/openapi/sdkwork-payment-app-api.sdkgen.json",
    generatedPackageName: "@sdkwork/payment-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-promotion-app-api",
    family: "sdkwork-promotion-app-sdk",
    generationInputSpec: "../sdkwork-promotion/sdks/sdkwork-promotion-app-sdk/openapi/sdkwork-promotion-app-api.sdkgen.json",
    generatedPackageName: "@sdkwork/promotion-app-sdk",
    surface: "app",
    tokenManagerScope: "global-session",
  },
  {
    authority: "sdkwork-commerce-open-api",
    family: "sdkwork-commerce-sdk",
    generationInputSpec: "apis/open-api/commerce/commerce-open-api.openapi.json",
    surface: "open",
    tokenManagerScope: "api-key-provider",
  },
] as const satisfies readonly SdkworkMallPcSdkFamilyInventoryItem[];

export function listSdkworkMallPcAppSdkFamilies(): readonly SdkworkMallPcSdkFamilyInventoryItem[] {
  return sdkworkMallPcAppSdkFamilies;
}

export function createSdkworkMallPcRouteRegistry(
  ...routeGroups: readonly (readonly SdkworkMallPcRouteContribution[])[]
): readonly SdkworkMallPcRouteContribution[] {
  return routeGroups.flat();
}
