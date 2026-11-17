import {
  configureMallDefaultDataBootstrapper,
  configureMallDefaultDataProvider,
  ensureMallDefaultDataConfigured,
} from "@sdkwork/mall-pc-admin-product/default-data/provider";
import {
  resolveMallDefaultDataEnvironment,
  resolveMallDefaultDataProfile,
} from "@sdkwork/mall-pc-admin-product/default-data/profiles";
import type {
  MallDefaultDataCmsConfigShape,
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataPort,
  MallDefaultDataProfile,
} from "@sdkwork/mall-pc-admin-product/default-data";
import {
  configureMallHomeSeedProvider,
  type MallHomeSeedOutcome,
} from "@sdkwork/mall-pc-home/home-seed";
import { readRuntimeEnv } from "@sdkwork/sdk-common";
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
import type { SdkworkMallPcSessionStore } from "./sessionStore";

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
 * Provisioning lookups must see the whole environment.
 *
 * Seeding is idempotent only if the plan can tell "this natural key is already
 * provisioned" for every row — a catalog larger than one page would otherwise be
 * re-created on every rerun. The walk is bounded (200 pages × 200 rows) so a
 * mispaginating backend fails loudly instead of looping, and it stays on the
 * one-shot operator path rather than an interactive list.
 */
const PROVISIONING_PAGE_SIZE = 200;
const PROVISIONING_MAX_PAGES = 200;

interface ProvisioningPageQuery {
  readonly page: number;
  readonly pageSize?: number;
  readonly page_size?: number;
  readonly [key: string]: unknown;
}

function readListItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      return readListItems(items);
    }
  }
  if (Array.isArray(record.items)) {
    return readListItems(record.items);
  }
  return [];
}

async function collectAllPages(
  list: (query: ProvisioningPageQuery) => Promise<unknown>,
  options: {
    readonly pageSizeKey?: "pageSize" | "page_size";
    readonly fixed?: Record<string, unknown>;
  } = {},
): Promise<{ items: Record<string, unknown>[] }> {
  const pageSizeKey = options.pageSizeKey ?? "page_size";
  const items: Record<string, unknown>[] = [];
  for (let page = 1; page <= PROVISIONING_MAX_PAGES; page += 1) {
    const query: ProvisioningPageQuery = {
      ...(options.fixed ?? {}),
      page,
      [pageSizeKey]: PROVISIONING_PAGE_SIZE,
    };
    const pageItems = readListItems(await list(query));
    items.push(...pageItems);
    if (pageItems.length < PROVISIONING_PAGE_SIZE) {
      break;
    }
  }
  return { items };
}

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

  const catalogPageSize = { pageSizeKey: "pageSize" } as const;
  const federatedPageSize = { pageSizeKey: "page_size" } as const;

  return {
    catalog: {
      listBrands: () => collectAllPages((query) => catalog.brands.list(query), catalogPageSize),
      createBrand: (body) => catalog.brands.create(body),
      listAttributes: () =>
        collectAllPages((query) => catalog.attributes.management.list(query), catalogPageSize),
      createAttribute: (body) => catalog.attributes.create(body),
      listAttributeValues: (query) => catalog.attributeValues.list(query),
      listCategoryAttributes: () =>
        collectAllPages((query) => catalog.categoryAttributes.list(query), catalogPageSize),
      createCategoryAttribute: (body) => catalog.categoryAttributes.create(body),
      listPriceLists: () =>
        collectAllPages((query) => catalog.priceLists.list(query), catalogPageSize),
      createPriceList: (body) => catalog.priceLists.create(body),
      listPriceListItems: () =>
        collectAllPages((query) => catalog.priceListItems.list(query), catalogPageSize),
      createPriceListItem: (body) => catalog.priceListItems.create(body),
      listCategories: () =>
        collectAllPages((query) => catalog.categories.management.list(query), catalogPageSize),
      createCategory: (body) => catalog.categories.create(body),
      listProducts: () =>
        collectAllPages((query) => catalog.products.management.list(query), catalogPageSize),
      createProduct: (body) => catalog.products.create(body),
      publishProduct: (productId, expectedVersion) =>
        catalog.products.publish(productId, expectedVersion),
      listSkus: () => collectAllPages((query) => catalog.skus.list(query), catalogPageSize),
      createSku: (body) => catalog.skus.create(body),
    },
    shops: {
      listShops: () =>
        collectAllPages((query) => commerce.shops.management.list(query), federatedPageSize),
      createShop: (body) => commerce.shops.create(body),
    },
    promotions: {
      listOffers: () =>
        collectAllPages((query) => commerce.promotions.offers.management.list(query), federatedPageSize),
      createOffer: (body) => commerce.promotions.offers.create(body),
    },
    memberships: {
      listPlans: () =>
        collectAllPages((query) => commerce.memberships.plans.management.list(query), federatedPageSize),
      createPlan: (body) => commerce.memberships.plans.create(body),
      listPackageGroups: () =>
        collectAllPages(
          (query) => commerce.memberships.packageGroups.management.list(query),
          federatedPageSize,
        ),
      createPackageGroup: (body) => commerce.memberships.packageGroups.create(body),
      listPackages: () =>
        collectAllPages((query) => commerce.memberships.packages.management.list(query), federatedPageSize),
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
  readonly session?: SdkworkMallPcSessionStore;
}): void {
  const port = createSdkworkMallPcDefaultDataPort(input.sdkClients);
  if (!port) {
    configureMallDefaultDataProvider(null);
    configureMallDefaultDataBootstrapper(null);
    configureMallHomeSeedProvider(null);
    return;
  }
  const locale: MallDefaultDataLocale = input.locale === "en-US" ? "en-US" : "zh-CN";
  const environment = resolveMallDefaultDataEnvironment(input.environment);
  const providerInput = { defaultLocale: locale, environment, port };

  // The provisioning engine owns the multi-megabyte dataset chunk, so it is
  // registered lazily: the admin console and the first-run seed both call
  // `ensureMallDefaultDataConfigured()` and only then download the engine.
  configureMallDefaultDataBootstrapper(async () => {
    configureMallDefaultDataProvider(providerInput);
  });

  // Storefront first-run recovery: the same provisioning plan, reachable from
  // the home page instead of only from the admin console. A brand-new install
  // must never present an unexplained empty mall to the first visitor.
  const policy = resolveSdkworkMallPcSeedPolicy(environment);
  configureMallHomeSeedProvider({
    // Both conditions are evaluated per attempt: the environment policy is
    // static, but the session is not. An anonymous visitor must never trigger
    // backend writes, and a visitor who signs in later still gets the automatic
    // pass on the next empty read.
    automatic: () => policy.automatic && hasMallSessionCredentials(input.session),
    isSignedIn: () => hasMallSessionCredentials(input.session),
    profile: policy.profile,
    run: (options) => runStorefrontSeedInitialization(environment, options?.profile),
  });
}

/** Whether the storefront has credentials to attempt backend provisioning. */
function hasMallSessionCredentials(session: SdkworkMallPcSessionStore | undefined): boolean {
  if (!session) {
    return true;
  }
  const snapshot = session.getSnapshot();
  return Boolean(
    snapshot.accessToken?.trim() ||
      snapshot.authToken?.trim() ||
      snapshot.refreshToken?.trim(),
  );
}

/** Runtime flag forcing a provisioning profile (`minimal`/`standard`/`demo`). */
export const MALL_SEED_PROFILE_ENV_KEY = "SDKWORK_MALL_SEED_PROFILE";

/** Runtime flag allowing automatic first-run provisioning in any profile. */
export const MALL_SEED_AUTOMATIC_ENV_KEY = "SDKWORK_MALL_AUTO_SEED";

export interface SdkworkMallPcSeedPolicy {
  /** Whether the storefront may provision without an operator click. */
  readonly automatic: boolean;
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
}

function readRuntimeFlag(key: string): boolean | undefined {
  const raw = readRuntimeEnv(key)?.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return undefined;
}

/**
 * Resolves whether the storefront seeds itself and which slice it writes.
 *
 * Non-production environments seed automatically with their environment
 * profile (`demo` or `standard`). Production defaults to the `minimal` reference
 * slice and never writes on its own; an operator can opt into a richer slice
 * with `SDKWORK_MALL_SEED_PROFILE`, which also makes the run eligible for
 * automatic provisioning because that is an explicit deployment decision.
 */
export function resolveSdkworkMallPcSeedPolicy(
  environment: MallDefaultDataEnvironment,
): SdkworkMallPcSeedPolicy {
  const profile = resolveMallDefaultDataProfile(
    environment,
    readRuntimeEnv(MALL_SEED_PROFILE_ENV_KEY) ?? null,
  );
  const explicitAutomatic = readRuntimeFlag(MALL_SEED_AUTOMATIC_ENV_KEY);
  return {
    automatic: explicitAutomatic ?? profile !== "minimal",
    environment,
    profile,
  };
}

async function runStorefrontSeedInitialization(
  environment: MallDefaultDataEnvironment,
  profileOverride?: MallDefaultDataProfile,
): Promise<MallHomeSeedOutcome> {
  const policy = resolveSdkworkMallPcSeedPolicy(environment);
  await ensureMallDefaultDataConfigured();
  // Lazy on purpose: the dataset is a large chunk that a storefront visitor must
  // not download unless this environment actually needs provisioning.
  const { runMallDefaultDataInitialization } = await import(
    "@sdkwork/mall-pc-admin-product/default-data"
  );
  const report = await runMallDefaultDataInitialization({
    profile: profileOverride ?? policy.profile,
  });
  if (!report.ok) {
    const failed = report.steps.find((step) => step.status === "failed");
    return {
      created: report.summary.created,
      message: failed
        ? `${failed.title}：${failed.message ?? "执行失败"}`
        : "默认数据初始化未完成，请在管理后台查看失败步骤。",
      state: "failed",
    };
  }
  return { created: report.summary.created, state: "succeeded" };
}
