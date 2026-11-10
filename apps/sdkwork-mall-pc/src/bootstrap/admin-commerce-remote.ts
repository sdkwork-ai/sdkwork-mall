import { createSdkworkIdempotencyParams } from "@sdkwork/order-service";
import {
  configureSdkworkAdminRemotePort,
  type SdkworkAdminCommerceNamespace,
} from "@sdkwork/mall-pc-admin-core/admin-remote-port";

import {
  createSdkCommandPortAdapter,
  splitSdkQueryId,
} from "./sdk-command-port-adapter";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

const ADMIN_COMMAND_PATHS = [
  "afterSales.reviews.create",
  "shops.approve",
  "shops.riskSignals.resolve",
  "shops.settlementProfile.approve",
  "shops.suspend",
] as const;

export function configureSdkworkMallPcAdminCommerceRemotePort(
  sdkClients: SdkworkMallPcSdkClientInventory,
): void {
  const backendCommerce = sdkClients.commerceBackendClient?.commerce;
  configureSdkworkAdminRemotePort(
    backendCommerce
      ? {
          admin: createSdkCommandPortAdapter<SdkworkAdminCommerceNamespace>(
            // The federated client groups every backend transport under
            // `commerce`; the admin port namespace maps onto that tree.
            backendCommerce as object,
            {
              argumentRules: {
                "shops.depositAccount.retrieve": ([query]) => [splitSdkQueryId(query, "shopId")[0]],
                "shops.riskSignals.list": ([query]) => splitSdkQueryId(query, "shopId"),
              },
              // The merchandise capability owner (`sdkwork-merchandise`, route
              // manifest `sdkwork-routes-merchandise-backend-api`) names the
              // product lifecycle commands `products.publish` and
              // `products.archive` under `/backend/v3/api/catalog/products/*`.
              // The federated commerce transport still exposes them through the
              // legacy `catalog.spus` aggregate, so the bootstrap owns this
              // remap until the transport is regenerated from the
              // `sdkwork-shop-backend-api` authority.
              methodOverrides: {
                "catalog.products.publish": (productId, body) =>
                  backendCommerce.catalog.spus.publish(
                    String(productId),
                    resolveAdminCommandBody(body),
                  ),
                "catalog.products.archive": (productId, body) =>
                  backendCommerce.catalog.spus.archive(
                    String(productId),
                    resolveAdminCommandBody(body),
                  ),
              },
              commandPaths: ADMIN_COMMAND_PATHS,
            },
          ),
        }
      : null,
  );
}

/**
 * Keeps publish/archive on the same idempotent command footing the generic
 * adapter provides: an omitted body is replaced with fresh idempotency params.
 */
function resolveAdminCommandBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return { idempotencyKey: createSdkworkIdempotencyParams().idempotencyKey };
}
