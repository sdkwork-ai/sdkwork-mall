import { createSdkworkPartnerJoinPort, createSdkworkPartnerService } from "@sdkwork/mall-partner-service";
import type {
  SdkworkPartnerCenterPort,
  SdkworkPartnerJoinWireClient,
  SdkworkPartnerService,
} from "@sdkwork/mall-partner-service";

export const SDKWORK_MALL_PARTNER_SDK_FAMILY = "sdkwork-partner-app-sdk" as const;

let sdkworkPartnerServiceProvider: (() => SdkworkPartnerService) | null = null;

/** Injects the runtime partner service once from the application bootstrap. */
export function configureSdkworkPartnerServiceProvider(
  provider: (() => SdkworkPartnerService) | null,
): void {
  sdkworkPartnerServiceProvider = provider;
}

export function getSdkworkPartnerService(): SdkworkPartnerService {
  if (!sdkworkPartnerServiceProvider) {
    throw new Error("Sdkwork partner service provider is not configured.");
  }
  return sdkworkPartnerServiceProvider();
}

export interface CreateSdkworkMallPartnerServiceInput {
  /**
   * Composed partner app client, structurally typed. The bootstrap owns the
   * generated SDK import; feature packages never import a business SDK.
   */
  readonly partnerAppClient: SdkworkPartnerJoinWireClient;
  readonly centerPort?: SdkworkPartnerCenterPort | null;
}

/** Composes the mall partner service over the composed partner app client. */
export function createSdkworkMallPartnerService(
  input: CreateSdkworkMallPartnerServiceInput,
): SdkworkPartnerService {
  return createSdkworkPartnerService({
    center: input.centerPort ?? null,
    join: createSdkworkPartnerJoinPort(input.partnerAppClient),
  });
}
