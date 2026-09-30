import { getSdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import {
  configureSdkworkMerchantRemotePort,
  type SdkworkMerchantRemotePort,
} from "@sdkwork/mall-pc-merchant";

import { createSdkCommandPortAdapter } from "./sdk-command-port-adapter";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

const MERCHANT_COMMAND_PATHS = [
  "current.applications.create",
  "current.channels.update",
  "current.policies.update",
] as const;

export function configureSdkworkMallPcMerchantCommerceRemotePort(
  sdkClients: SdkworkMallPcSdkClientInventory,
): void {
  const commerce = () => getSdkworkCommerceService();

  configureSdkworkMerchantRemotePort({
    afterSales: commerce().afterSales,
    promotions: commerce().promotions,
    shops: createSdkCommandPortAdapter<SdkworkMerchantRemotePort["shops"]>(
      sdkClients.commerceAppClient.commerce.shops,
      { commandPaths: MERCHANT_COMMAND_PATHS },
    ),
  });
}
