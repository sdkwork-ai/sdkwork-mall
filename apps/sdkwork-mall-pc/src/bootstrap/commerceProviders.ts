import {
  configureSdkworkCommerceServiceProvider,
  configureSdkworkCommerceSessionTokenProvider,
  createSdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import type { CommerceAppSdkClient, CommerceBackendSdkClient } from "@sdkwork/mall-commerce-sdk-ports";

import { configureSdkworkMallPcCommerceBuyerHubRemotePort } from "./commerce-buyer-hub-remote";
import { configureSdkworkMallPcDomainServiceProviders } from "./domain-service-providers";
import { configureSdkworkMallPcBillingUsageRecordsLoader } from "./billing-usage-records";
import { configureSdkworkMallPcInvoiceRemotePort } from "./invoice-commerce-remote";
import { configureSdkworkMallPcAdminCommerceRemotePort } from "./admin-commerce-remote";
import { configureSdkworkMallPcAddressRemotePort } from "./address-commerce-remote";
import { configureSdkworkMallPcBuyerCommerceRemotePorts } from "./buyer-commerce-remote";
import { configureSdkworkMallPcCartCommerceRemotePort } from "./cart-commerce-remote";
import { configureSdkworkMallPcCmsCommerceRemotePort } from "./cms-commerce-remote";
import { configureSdkworkMallPcMerchantCommerceRemotePort } from "./merchant-commerce-remote";
import { configureSdkworkMallPcStorefrontCommerceRemotePorts } from "./storefront-commerce-remote";
import { createSdkCommandPortAdapter } from "./sdk-command-port-adapter";
import type { SdkworkMallPcIamRuntime } from "./iamRuntime";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";
import type { SdkworkMallPcRuntimeConfig } from "./environment";

export interface SdkworkMallPcCommerceProviders {
  commerceService: ReturnType<typeof createSdkworkCommerceService>;
}

const COMMERCE_APP_COMMAND_PATHS = [
  "addresses.create",
  "addresses.defaultSelection.create",
  "addresses.delete",
  "addresses.update",
  "afterSales.requests.create",
  "cart.items.create",
  "cart.items.delete",
  "cart.items.update",
  "checkout.sessions.create",
  "checkout.sessions.orders.create",
  "checkout.sessions.quotes.create",
  "invoices.cancellations.create",
  "invoices.create",
  "invoices.submissions.create",
  "invoices.update",
  "orders.create",
  "orders.pay",
  "promotions.discountApplications.create",
  "wallet.holds.create",
] as const;

const COMMERCE_BACKEND_COMMAND_PATHS = [
  "catalog.products.create",
  "inventory.stocks.update",
  "payments.providerAccounts.create",
  "promotions.offers.create",
  "promotions.offers.update",
] as const;

export function configureSdkworkMallPcProviders(input: {
  config: SdkworkMallPcRuntimeConfig;
  iamRuntime: SdkworkMallPcIamRuntime;
  sdkClients: SdkworkMallPcSdkClientInventory;
}): SdkworkMallPcCommerceProviders {
  const orderAfterSales = createSdkCommandPortAdapter<{
    requests: {
      update(...args: unknown[]): Promise<unknown>;
    };
  }>(input.sdkClients.orderAppClient.afterSales, {
    commandPaths: ["requests.update"],
  });
  const appClient: CommerceAppSdkClient = {
    commerce: createSdkCommandPortAdapter<CommerceAppSdkClient["commerce"]>(
      // Adapt the commerce namespace itself: the facade spreads this node, so
      // wrapping the client root would leak httpClient/ai/iam into the service
      // and leave catalog/cart/... undefined.
      input.sdkClients.commerceAppClient.commerce,
      {
        commandPaths: COMMERCE_APP_COMMAND_PATHS,
        methodOverrides: {
          "afterSales.requests.update": orderAfterSales.requests.update,
        },
      },
    ),
  };
  const backendClient = input.sdkClients.commerceBackendClient
    ? {
        commerce: createSdkCommandPortAdapter<CommerceBackendSdkClient["commerce"]>(
          input.sdkClients.commerceBackendClient.commerce,
          { commandPaths: COMMERCE_BACKEND_COMMAND_PATHS },
        ),
      }
    : undefined;

  const commerceService = createSdkworkCommerceService({
    appClient,
    backendClient,
  });

  configureSdkworkCommerceServiceProvider(() => commerceService);
  configureSdkworkCommerceSessionTokenProvider(() => {
    const snapshot = input.iamRuntime.session.getSnapshot();
    return {
      accessToken: snapshot.accessToken,
      authToken: snapshot.authToken,
      refreshToken: snapshot.refreshToken,
    };
  });

  configureSdkworkMallPcDomainServiceProviders(
    input.sdkClients,
    () => {
      const snapshot = input.iamRuntime.session.getSnapshot();
      return {
        accessToken: snapshot.accessToken,
        authToken: snapshot.authToken,
        refreshToken: snapshot.refreshToken,
      };
    },
  );

  configureSdkworkMallPcBillingUsageRecordsLoader();
  configureSdkworkMallPcInvoiceRemotePort();
  configureSdkworkMallPcAddressRemotePort();
  configureSdkworkMallPcStorefrontCommerceRemotePorts();
  configureSdkworkMallPcBuyerCommerceRemotePorts();
  configureSdkworkMallPcCommerceBuyerHubRemotePort();
  configureSdkworkMallPcCartCommerceRemotePort();
  configureSdkworkMallPcMerchantCommerceRemotePort(input.sdkClients);
  configureSdkworkMallPcAdminCommerceRemotePort(input.sdkClients);
  configureSdkworkMallPcCmsCommerceRemotePort();

  return {
    commerceService,
  };
}
