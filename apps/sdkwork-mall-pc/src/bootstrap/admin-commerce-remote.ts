import {
  configureSdkworkAdminRemotePort,
  type SdkworkAdminCatalogNamespace,
  type SdkworkAdminCommerceNamespace,
} from "@sdkwork/mall-pc-admin-core/admin-remote-port";
import type { SdkworkBackendClient as SdkworkShopBackendClient } from "@sdkwork/shop-backend-sdk";

import {
  createSdkCommandPortAdapter,
  normalizeSdkArgument,
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
  const shopBackendCatalog = sdkClients.shopBackendClient?.catalog;
  configureSdkworkAdminRemotePort(
    backendCommerce
      ? {
          admin: withAuthorityCatalog(
            createSdkCommandPortAdapter<SdkworkAdminCommerceNamespace>(
              // The federated client groups every backend transport under
              // `commerce`; the admin port namespace maps onto that tree.
              backendCommerce as object,
              {
                argumentRules: {
                  "shops.depositAccount.retrieve": ([query]) => [
                    splitSdkQueryId(query, "shopId")[0],
                  ],
                  "shops.riskSignals.list": ([query]) => splitSdkQueryId(query, "shopId"),
                },
                commandPaths: ADMIN_COMMAND_PATHS,
              },
            ),
            shopBackendCatalog,
          ),
        }
      : null,
  );
}

/**
 * Feeds the admin `catalog` namespace from the Shop backend authority client
 * (`sdkwork-shop-backend-sdk`) when it is configured, keeping every other
 * namespace on the federated commerce transport.
 *
 * The authority client is generated from the merchandise module contract
 * (`sdkwork-merchandise`, 38 operations under `/backend/v3/api/catalog/*`), so
 * the catalog surface stops riding the legacy `spus` aggregate the federated
 * transport still carries, and every guarded write carries the row version the
 * caller read (`API_SPEC` section 17) instead of an idempotency-key body.
 */
function withAuthorityCatalog(
  federatedAdmin: SdkworkAdminCommerceNamespace,
  shopBackendCatalog: SdkworkShopBackendClient["catalog"] | undefined,
): SdkworkAdminCommerceNamespace {
  if (!shopBackendCatalog) {
    return federatedAdmin;
  }
  return {
    ...federatedAdmin,
    catalog: createSdkworkShopCatalogNamespace(shopBackendCatalog),
  };
}

export { createSdkworkShopCatalogNamespace };

/**
 * Bridges the authority-typed generated transport onto the mall-owned
 * structural port.
 *
 * The generated request types are compile-time views of the same closed wire
 * shapes the port builds; the authority re-validates every body server-side
 * (`deny_unknown_fields`), so the seam cannot smuggle an unknown field through.
 * Guarded writes translate the port's `expectedVersion` into the generated
 * transport's `ifMatch` precondition params.
 */
function createSdkworkShopCatalogNamespace(
  client: SdkworkShopBackendClient["catalog"],
): SdkworkAdminCatalogNamespace {
  // The authority transport speaks camelCase (`API_SPEC` section 13); callers
  // may still carry snake_case keys from legacy habits, so the seam normalizes
  // exactly like the federated command adapter does. An omitted query becomes
  // an empty object, which satisfies the generated signatures whose params are
  // required.
  const body = <T>(value: Record<string, unknown>): T => normalizeSdkArgument(value) as T;
  const params = <T>(value?: Record<string, unknown>): T => normalizeSdkArgument(value ?? {}) as T;
  const ifMatch = (expectedVersion: number): { ifMatch: string } => ({
    ifMatch: String(expectedVersion),
  });

  return {
    brands: {
      create: (request) => client.brands.create(body(request)),
      delete: (brandId, expectedVersion) =>
        client.brands.delete(brandId, params(ifMatch(expectedVersion))),
      list: (query) => client.brands.list(params(query)),
      retrieve: (brandId) => client.brands.retrieve(brandId),
      update: (brandId, request, expectedVersion) =>
        client.brands.update(brandId, params(ifMatch(expectedVersion)), body(request)),
    },
    attributes: {
      create: (request) => client.attributes.create(body(request)),
      management: { list: (query) => client.attributes.management.list(params(query)) },
      update: (attributeId, request, expectedVersion) =>
        client.attributes.update(attributeId, params(ifMatch(expectedVersion)), body(request)),
    },
    attributeValues: {
      create: (request) => client.attributeValues.create(body(request)),
      delete: (valueId, expectedVersion) =>
        client.attributeValues.delete(valueId, params(ifMatch(expectedVersion))),
      list: (query) => client.attributeValues.list(params(query)),
      update: (valueId, request, expectedVersion) =>
        client.attributeValues.update(valueId, params(ifMatch(expectedVersion)), body(request)),
    },
    categories: {
      create: (request) => client.categories.create(body(request)),
      delete: (categoryId, expectedVersion) =>
        client.categories.delete(categoryId, params(ifMatch(expectedVersion))),
      management: { list: (query) => client.categories.management.list(params(query)) },
      retrieve: (categoryId) => client.categories.management.retrieve(categoryId),
      update: (categoryId, request, expectedVersion) =>
        client.categories.update(categoryId, params(ifMatch(expectedVersion)), body(request)),
    },
    categoryAttributes: {
      create: (request) => client.categoryAttributes.create(body(request)),
      delete: (bindingId, expectedVersion) =>
        client.categoryAttributes.delete(bindingId, params(ifMatch(expectedVersion))),
      list: (query) => client.categoryAttributes.list(params(query)),
      update: (bindingId, request, expectedVersion) =>
        client.categoryAttributes.update(bindingId, params(ifMatch(expectedVersion)), body(request)),
    },
    media: {
      create: (request) => client.media.create(body(request)),
      delete: (mediaId, expectedVersion) =>
        client.media.delete(mediaId, params(ifMatch(expectedVersion))),
      list: (query) => client.media.list(params(query)),
      update: (mediaId, request, expectedVersion) =>
        client.media.update(mediaId, body(request), params(ifMatch(expectedVersion))),
    },
    priceListItems: {
      create: (request) => client.priceListItems.create(body(request)),
      delete: (itemId, expectedVersion) =>
        client.priceListItems.delete(itemId, params(ifMatch(expectedVersion))),
      list: (query) => client.priceListItems.list(params(query)),
      update: (itemId, request, expectedVersion) =>
        client.priceListItems.update(itemId, body(request), params(ifMatch(expectedVersion))),
    },
    priceLists: {
      create: (request) => client.priceLists.create(body(request)),
      list: (query) => client.priceLists.list(params(query)),
      update: (priceListId, request, expectedVersion) =>
        client.priceLists.update(priceListId, params(ifMatch(expectedVersion)), body(request)),
    },
    products: {
      archive: (productId, expectedVersion) =>
        client.products.archive(productId, params(ifMatch(expectedVersion))),
      attributes: {
        update: (productId, request, expectedVersion) =>
          client.products.attributes.update(productId, body(request), params(ifMatch(expectedVersion))),
      },
      create: (request) => client.products.create(body(request)),
      delete: (productId, expectedVersion) =>
        client.products.delete(productId, params(ifMatch(expectedVersion))),
      management: {
        list: (query) => client.products.management.list(params(query)),
        retrieve: (productId) => client.products.management.retrieve(productId),
      },
      publish: (productId, expectedVersion) =>
        client.products.publish(productId, params(ifMatch(expectedVersion))),
      update: (productId, request, expectedVersion) =>
        client.products.update(productId, params(ifMatch(expectedVersion)), body(request)),
    },
    skus: {
      create: (request) => client.skus.create(body(request)),
      delete: (skuId, expectedVersion) => client.skus.delete(skuId, params(ifMatch(expectedVersion))),
      list: (query) => client.skus.list(params(query)),
      retrieve: (skuId) => client.skus.retrieve(skuId),
      update: (skuId, request, expectedVersion) =>
        client.skus.update(skuId, params(ifMatch(expectedVersion)), body(request)),
    },
  };
}
