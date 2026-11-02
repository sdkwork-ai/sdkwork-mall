import {
  createSdkworkPartnerCenterPort,
  createSdkworkPartnerJoinPort,
  createSdkworkPartnerService,
} from "@sdkwork/mall-partner-service";
import type {
  SdkworkPartnerCenterPort,
  SdkworkPartnerCenterWireClient,
  SdkworkPartnerJoinWireClient,
  SdkworkPartnerService,
} from "@sdkwork/mall-partner-service";

export const SDKWORK_MALL_H5_PARTNER_SDK_FAMILY = "sdkwork-partner-app-sdk" as const;

let sdkworkPartnerServiceProvider: (() => SdkworkPartnerService) | null = null;

export function configureSdkworkH5PartnerServiceProvider(
  provider: (() => SdkworkPartnerService) | null,
): void {
  sdkworkPartnerServiceProvider = provider;
}

export function getSdkworkH5PartnerService(): SdkworkPartnerService {
  if (!sdkworkPartnerServiceProvider) {
    throw new Error("Sdkwork partner service provider is not configured.");
  }
  return sdkworkPartnerServiceProvider();
}

export interface CreateSdkworkH5PartnerServiceInput {
  readonly partnerAppClient: SdkworkPartnerJoinWireClient & SdkworkPartnerCenterWireClient;
  readonly centerPort?: SdkworkPartnerCenterPort | null;
}

export function createSdkworkH5PartnerService(
  input: CreateSdkworkH5PartnerServiceInput,
): SdkworkPartnerService {
  return createSdkworkPartnerService({
    center: input.centerPort ?? createSdkworkPartnerCenterPort(input.partnerAppClient),
    join: createSdkworkPartnerJoinPort(input.partnerAppClient),
  });
}
