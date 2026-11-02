import {
  configureSdkworkPartnerServiceProvider,
  createSdkworkMallPartnerService,
} from "@sdkwork/mall-pc-partner/partner-service";

import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

/**
 * Binds the distribution centre to the composed partner app client.
 *
 * The supplier is lazy so the partner SDK only resolves when a distribution
 * surface actually reads the service.
 */
export function configureSdkworkMallPcPartnerProviders(
  sdkClients: SdkworkMallPcSdkClientInventory,
): void {
  configureSdkworkPartnerServiceProvider(() =>
    createSdkworkMallPartnerService({
      partnerAppClient: sdkClients.partnerAppClient,
    }),
  );
}
