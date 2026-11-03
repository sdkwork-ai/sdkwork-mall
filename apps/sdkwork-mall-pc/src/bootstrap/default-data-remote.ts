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

import { createSdkCommandPortAdapter } from "./sdk-command-port-adapter";
import type { SdkworkMallPcSdkClientInventory } from "./sdkClients";

/**
 * Commerce backend operations the default-data plan calls.
 *
 * Declared explicitly instead of reusing the generated transport types so the
 * port stays a stable, testable seam: the app bootstrap owns the adapter, the
 * default-data package owns the workflow.
 */
interface MallDefaultDataBackendCommerce {
  readonly catalog: {
    readonly categories: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
    readonly products: {
      management: { list(params?: Record<string, unknown>): Promise<unknown> };
      create(body: Record<string, unknown>): Promise<unknown>;
    };
    readonly spus: {
      publish(spuId: string, body?: Record<string, unknown>, params?: Record<string, unknown>): Promise<unknown>;
    };
    readonly skus: {
      list(params?: Record<string, unknown>): Promise<unknown>;
      create(body: Record<string, unknown>): Promise<unknown>;
    };
  };
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
  "catalog.categories.create",
  "catalog.products.create",
  "catalog.skus.create",
  "catalog.spus.publish",
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
    return window.localStorage.getItem(CMS_PRESET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeCmsPresetMarker(presetId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CMS_PRESET_STORAGE_KEY, presetId);
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
}

/** Adapts the federated commerce backend client onto the provisioning port. */
export function createSdkworkMallPcDefaultDataPort(
  sdkClients: SdkworkMallPcDefaultDataClientSource,
): MallDefaultDataPort | null {
  const backendClient = sdkClients.commerceBackendClient;
  if (!backendClient) {
    return null;
  }
  const commerce = createSdkCommandPortAdapter<MallDefaultDataBackendCommerce>(
    backendClient.commerce,
    { commandPaths: BACKEND_COMMAND_PATHS },
  );

  return {
    catalog: {
      listCategories: () => commerce.catalog.categories.management.list({ ...PROVISIONING_LIST_QUERY }),
      createCategory: (body) => commerce.catalog.categories.create(body),
      listProducts: () => commerce.catalog.products.management.list({ ...PROVISIONING_LIST_QUERY }),
      createProduct: (body) => commerce.catalog.products.create(body),
      publishProduct: (productId) => commerce.catalog.spus.publish(productId),
      listSkus: () => commerce.catalog.skus.list({ ...PROVISIONING_LIST_QUERY }),
      createSku: (body) => commerce.catalog.skus.create(body),
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
