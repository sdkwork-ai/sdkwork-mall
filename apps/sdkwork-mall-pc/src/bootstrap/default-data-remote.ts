import {
  configureMallDefaultDataProvider,
  resolveMallDefaultDataEnvironment,
  type MallDefaultDataCmsConfigShape,
  type MallDefaultDataLocale,
  type MallDefaultDataPort,
} from "@sdkwork/mall-pc-admin-product/default-data";
import {
  readMallCmsConfig,
  writeMallCmsConfig,
  type MallCmsConfig,
} from "@sdkwork/mall-pc-cms/cms-config";
import {
  readAccountScopedItem,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";

import type { SdkworkBackendClient as SdkworkShopBackendClient } from "@sdkwork/shop-backend-sdk";

import { createSdkworkShopCatalogNamespace } from "./admin-commerce-remote";
import { createSdkCommandPortAdapter } from "./sdk-command-port-adapter";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

/**
 * Commerce backend operations the default-data plan calls.
 *
 * The catalog section rides the Shop backend authority client
 * (`sdkwork-shop-backend-sdk`, owned by `sdkwork-shop` with the merchandise
 * module mounted), so publishing is the authority's `products.publish` command.
 * The remaining domains stay on the federated commerce transport; both are
 * declared explicitly instead of reusing the generated transport types so the
 * port stays a stable, testable seam: the app bootstrap owns the adapter, the
 * default-data package owns the workflow.
 */
interface MallDefaultDataBackendCommerce {
  readonly shops: {
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    create(body: Record<string, unknown>): Promise<unknown>;
  };
  readonly promotions: {
    readonly offers: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
  };
  readonly memberships: {
    readonly plans: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
    readonly packageGroups: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
    readonly packages: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
  };
}

const BACKEND_COMMAND_PATHS = [
  "shops.create",
  "promotions.offers.create",
  "memberships.plans.create",
  "memberships.packageGroups.create",
  "memberships.packages.create",
] as const;

/**
 * Provisioning lookups read at most one bounded page.
 *
 * The dataset tops out below this page size, and seeding is a one-shot operator
 * action rather than an interactive list, so a second page would only hide a
 * dataset defect behind pagination (`PAGINATION_SPEC.md` §2 forbids unbounded
 * client-side collection).
 */
const PROVISIONING_LIST_QUERY = Object.freeze({ page: 1, page_size: 200 });

const CMS_PRESET_STORAGE_KEY = "sdkwork-mall-pc-default-data:cms-preset";

function toCmsConfig(shape: MallDefaultDataCmsConfigShape): MallCmsConfig {
  return {
    banners: shape.banners.map((banner) => ({ ...banner })),
    floors: shape.floors.map((floor) => ({ ...floor })),
    hotKeywords: shape.hotKeywords.map((keyword) => ({ ...keyword })),
    updatedAt: shape.updatedAt,
  };
}

function readCmsPresetMarker(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return readAccountScopedItem(CMS_PRESET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeCmsPresetMarker(presetId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    writeAccountScopedItem(CMS_PRESET_STORAGE_KEY, presetId);
  } catch {
    // A blocked storage write only means the preset may be reapplied; the
    // storefront configuration itself has already been written.
  }
}

/**
 * Minimal client source the admin-product port needs.
 *
 * Declared narrowly so the adapter can be exercised with a stub client in tests
 * without fabricating the whole SDK inventory.
 */
export interface SdkworkMallPcDefaultDataClientSource {
  readonly commerceBackendClient?: { readonly commerce: object };
  readonly shopBackendClient?: {
    readonly catalog: SdkworkShopBackendClient["catalog"];
  };
}

/**
 * Adapts the backend clients onto the provisioning port.
 *
 * The catalog section comes from the Shop backend authority client; the rest of
 * the domains come from the federated commerce transport.
 */
export function createSdkworkMallPcDefaultDataPort(
  sdkClients: SdkworkMallPcDefaultDataClientSource,
): MallDefaultDataPort | null {
  const backendClient = sdkClients.commerceBackendClient;
  const shopCatalog = sdkClients.shopBackendClient?.catalog;
  if (!backendClient || !shopCatalog) {
    return null;
  }
  const commerce = createSdkCommandPortAdapter<MallDefaultDataBackendCommerce>(
    backendClient.commerce,
    { commandPaths: BACKEND_COMMAND_PATHS },
  );
  const catalog = createSdkworkShopCatalogNamespace(shopCatalog);

  return {
    catalog: {
      listBrands: () => catalog.brands.list({ ...PROVISIONING_LIST_QUERY }),
      createBrand: (body) => catalog.brands.create(body),
      listAttributes: () => catalog.attributes.management.list({ ...PROVISIONING_LIST_QUERY }),
      createAttribute: (body) => catalog.attributes.create(body),
      listAttributeValues: (query) => catalog.attributeValues.list(query),
      listCategoryAttributes: () => catalog.categoryAttributes.list({ ...PROVISIONING_LIST_QUERY }),
      createCategoryAttribute: (body) => catalog.categoryAttributes.create(body),
      listPriceLists: () => catalog.priceLists.list({ ...PROVISIONING_LIST_QUERY }),
      createPriceList: (body) => catalog.priceLists.create(body),
      listPriceListItems: () => catalog.priceListItems.list({ page: 1, pageSize: 200 }),
      createPriceListItem: (body) => catalog.priceListItems.create(body),
      listCategories: () => catalog.categories.management.list({ ...PROVISIONING_LIST_QUERY }),
      createCategory: (body) => catalog.categories.create(body),
      listProducts: () => catalog.products.management.list({ ...PROVISIONING_LIST_QUERY }),
      createProduct: (body) => catalog.products.create(body),
      publishProduct: (productId, expectedVersion) =>
        catalog.products.publish(productId, expectedVersion),
      listSkus: () => catalog.skus.list({ ...PROVISIONING_LIST_QUERY }),
      createSku: (body) => catalog.skus.create(body),
    },
    shops: {
      listShops: () => commerce.shops.management.list({ ...PROVISIONING_LIST_QUERY }),
      createShop: (body) => commerce.shops.create(body),
    },
    promotions: {
      listOffers: () => commerce.promotions.offers.management.list({ ...PROVISIONING_LIST_QUERY }),
      createOffer: (body) => commerce.promotions.offers.create(body),
    },
    memberships: {
      listPlans: () => commerce.memberships.plans.management.list({ ...PROVISIONING_LIST_QUERY }),
      createPlan: (body) => commerce.memberships.plans.create(body),
      listPackageGroups: () =>
        commerce.memberships.packageGroups.management.list({ ...PROVISIONING_LIST_QUERY }),
      createPackageGroup: (body) => commerce.memberships.packageGroups.create(body),
      listPackages: () => commerce.memberships.packages.management.list({ ...PROVISIONING_LIST_QUERY }),
      createPackage: (body) => commerce.memberships.packages.create(body),
    },
    cms: {
      read: () => readMallCmsConfig(),
      write: (config) => writeMallCmsConfig(toCmsConfig(config)),
      readAppliedPreset: readCmsPresetMarker,
      markAppliedPreset: writeCmsPresetMarker,
    },
  };
}

/**
 * Wires the default-data provider for the running mall PC surface.
 *
 * When no backend API is configured the provider is cleared instead of
 * registered, so the admin surface reports "not configured" rather than issuing
 * requests that cannot succeed.
 */
export function configureSdkworkMallPcDefaultDataProvider(input: {
  readonly environment: string;
  readonly locale: string;
  readonly sdkClients: SdkworkMallPcSdkClientInventory;
}): void {
  const port = createSdkworkMallPcDefaultDataPort(input.sdkClients);
  if (!port) {
    configureMallDefaultDataProvider(null);
    return;
  }
  const locale: MallDefaultDataLocale = input.locale === "en-US" ? "en-US" : "zh-CN";
  configureMallDefaultDataProvider({
    defaultLocale: locale,
    environment: resolveMallDefaultDataEnvironment(input.environment),
    port,
  });
}
