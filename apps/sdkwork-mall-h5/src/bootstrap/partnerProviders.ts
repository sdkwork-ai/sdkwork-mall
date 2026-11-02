import {
  configureSdkworkH5PartnerServiceProvider,
  createSdkworkH5PartnerService,
} from "@sdkwork/mall-h5-partner/partner-service";

import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";

/** Binds the H5 distribution centre to the composed partner app client. */
export function configureSdkworkMallH5PartnerProviders(
  sdkClients: SdkworkMallH5SdkClientInventory,
): void {
  configureSdkworkH5PartnerServiceProvider(() =>
    createSdkworkH5PartnerService({
      partnerAppClient: sdkClients.partnerAppClient,
    }),
  );
}
