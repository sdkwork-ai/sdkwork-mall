import { readDefaultDataId, readDefaultDataItems, readDefaultDataString } from "./port";
import type { MallDefaultDataCmsConfigShape, MallDefaultDataPort } from "./port";
import type {
  MallDefaultDataDataset,
  MallDefaultDataDomain,
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataProfile,
} from "./types";

/** Prefix of the CMS preset marker; bump the version when the preset shape changes. */
export const MALL_DEFAULT_DATA_CMS_PRESET_VERSION = "v1";

export function buildMallCmsPresetId(locale: MallDefaultDataLocale): string {
  return `${MALL_DEFAULT_DATA_CMS_PRESET_VERSION}:${locale}`;
}

/**
 * Projects the dataset CMS block onto the storefront CMS configuration.
 *
 * This runs client-side (the CMS store is local), so it is the one step that
 * makes the storefront look complete without any backend write. It only runs
 * once per locale: later operator edits are preserved.
 */
export function buildMallCmsConfigFromDataset(
  dataset: MallDefaultDataDataset,
  now: () => Date = () => new Date(),
): MallDefaultDataCmsConfigShape {
  return {
    banners: dataset.cms.banners
      .map((banner) => ({
        enabled: true,
        id: `mall-cms-banner-${banner.key}`,
        linkUrl: banner.linkUrl,
        sortOrder: banner.sortOrder,
        subtitle: banner.subtitle,
        title: banner.title,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    floors: dataset.cms.floors
      .map((floor) => ({
        enabled: true,
        id: `mall-cms-floor-${floor.key}`,
        productQuery: floor.productQuery,
        sortOrder: floor.sortOrder,
        title: floor.title,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    hotKeywords: dataset.cms.hotKeywords
      .map((keyword) => ({
        enabled: true,
        id: `mall-cms-keyword-${keyword.key}`,
        keyword: keyword.keyword,
        sortOrder: keyword.sortOrder,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    updatedAt: now().toISOString(),
  };
}

function indexByNaturalKey(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const record of records) {
    const id = readDefaultDataString(record, ["id"]);
    if (!id) {
      continue;
    }
    for (const key of keys) {
      const value = readDefaultDataString(record, [key]);
      if (value && !index.has(value)) {
        index.set(value, id);
      }
    }
    const metadata = record.metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const seedKey = readDefaultDataString(metadata as Record<string, unknown>, [
        "sdkworkMallSeedKey",
      ]);
      if (seedKey && !index.has(seedKey)) {
        index.set(seedKey, id);
      }
    }
  }
  return index;
}

/* ------------------------------------------------------------------------- */
/* Natural keys                                                              */
/* ------------------------------------------------------------------------- */

/** Stable server-side identity for an authored key; never localized. */
export function buildMallDefaultDataCode(prefix: string, key: string): string {
  return `${prefix}-${key.toUpperCase().replace(/[^A-Z0-9]+/gu, "-")}`;
}

export const MALL_CATEGORY_NO_PREFIX = "MALL-CAT";
export const MALL_SPU_NO_PREFIX = "MALL-SPU";
export const MALL_SKU_NO_PREFIX = "MALL-SKU";
export const MALL_SEED_METADATA_KEY = "sdkworkMallSeedKey";

export function buildMallCategoryNo(key: string): string {
  return buildMallDefaultDataCode(MALL_CATEGORY_NO_PREFIX, key);
}

export function buildMallSpuNo(key: string): string {
  return buildMallDefaultDataCode(MALL_SPU_NO_PREFIX, key);
}

export function buildMallSkuNo(key: string): string {
  return buildMallDefaultDataCode(MALL_SKU_NO_PREFIX, key);
}

/* ------------------------------------------------------------------------- */
/* Request bodies                                                            */
/* ------------------------------------------------------------------------- */

export function buildMallCategoryCreateBody(
  input: {
    readonly key: string;
    readonly name: string;
    readonly parentId: string | null;
    readonly sortOrder: number;
  },
): Record<string, unknown> {
  return {
    categoryNo: buildMallCategoryNo(input.key),
    parentId: input.parentId,
    name: input.name,
    status: "active",
    sortOrder: String(input.sortOrder),
  };
}

export function buildMallShopCreateBody(
  shop: MallDefaultDataDataset["shops"][number],
  organizationId: string,
): Record<string, unknown> {
  return {
    organizationId,
    shopName: shop.name,
    shopType: shop.shopType,
    businessModel: shop.businessModel,
    defaultCurrencyCode: shop.defaultCurrencyCode,
    defaultLocale: "zh-CN",
    timezone: shop.timezone,
    operationConfig: {
      [MALL_SEED_METADATA_KEY]: shop.key,
      description: shop.description,
      managedBy: "sdkwork-mall-default-data",
    },
  };
}

export function buildMallProductCreateBody(
  input: {
    readonly key: string;
    readonly brand: string;
    readonly categoryId: string;
    readonly description: string;
    readonly productType: MallDefaultDataDataset["products"][number]["productType"];
    readonly subtitle: string;
    readonly title: string;
    readonly keywords: readonly string[];
    readonly shopKey: string;
    readonly currencyCode: string;
  },
): Record<string, unknown> {
  return {
    brand: input.brand,
    categoryIds: [input.categoryId],
    description: input.description,
    productType: input.productType,
    spuNo: buildMallSpuNo(input.key),
    status: "active",
    subtitle: input.subtitle,
    title: input.title,
    metadata: {
      [MALL_SEED_METADATA_KEY]: input.key,
      keywords: input.keywords,
      shopKey: input.shopKey,
      currencyCode: input.currencyCode,
      managedBy: "sdkwork-mall-default-data",
    },
  };
}

export function buildMallSkuCreateBody(
  input: {
    readonly key: string;
    readonly barcode: string;
    readonly currencyCode: string;
    readonly listPrice: string;
    readonly price: string;
    readonly productId: string;
    readonly title: string;
  },
): Record<string, unknown> {
  return {
    attributes: [],
    barcode: input.barcode,
    defaultCurrencyCode: input.currencyCode,
    defaultPriceAmount: input.price,
    fulfillmentType: "physical",
    image: null,
    listPriceAmount: input.listPrice,
    productId: input.productId,
    salesUnit: null,
    skuNo: buildMallSkuNo(input.key),
    status: "active",
    taxCategory: null,
    title: input.title,
  };
}

export function buildMallOfferCreateBody(
  offer: MallDefaultDataDataset["offers"][number],
  profile: MallDefaultDataProfile,
  environment: MallDefaultDataEnvironment,
): Record<string, unknown> {
  // Production campaigns always start as drafts for marketing review, even when
  // an operator intentionally requests a richer profile there. Every
  // non-production environment seeds live campaigns so the storefront and
  // activity pages are exercisable end to end.
  const status = profile === "minimal" || environment === "production" ? "draft" : "active";
  return {
    code: offer.code,
    description: offer.description,
    status,
    title: offer.title,
  };
}

export function buildMallMembershipPlanCreateBody(
  plan: MallDefaultDataDataset["membership"]["plans"][number],
): Record<string, unknown> {
  return {
    benefits: plan.benefits,
    code: plan.code,
    name: plan.name,
    rank: plan.rank,
    status: "active",
  };
}

export function buildMallMembershipPackageGroupCreateBody(
  group: MallDefaultDataDataset["membership"]["packageGroups"][number],
): Record<string, unknown> {
  return {
    billingCycle: group.billingCycle,
    code: group.code,
    description: group.description,
    durationDays: group.durationDays,
    name: group.name,
    sortWeight: group.sortWeight,
    status: "active",
  };
}

export function buildMallMembershipPackageCreateBody(
  entry: MallDefaultDataDataset["membership"]["packages"][number],
  planId: string,
  groupId: string,
): Record<string, unknown> {
  return {
    code: entry.code,
    currencyCode: entry.currencyCode,
    durationDays: entry.durationDays,
    groupId,
    levelId: planId,
    name: entry.name,
    priceAmount: entry.priceAmount,
    status: "active",
  };
}

/* ------------------------------------------------------------------------- */
/* Step contract                                                             */
/* ------------------------------------------------------------------------- */

/** Mutable lookup state shared by the plan steps (created or pre-existing ids). */
export interface MallDefaultDataExecutionState {
  readonly categoryIdByKey: Map<string, string>;
  readonly shopIdByKey: Map<string, string>;
  readonly productIdByKey: Map<string, string>;
  readonly planIdByKey: Map<string, string>;
  readonly packageGroupIdByKey: Map<string, string>;
}

export function createMallDefaultDataExecutionState(): MallDefaultDataExecutionState {
  return {
    categoryIdByKey: new Map(),
    shopIdByKey: new Map(),
    productIdByKey: new Map(),
    planIdByKey: new Map(),
    packageGroupIdByKey: new Map(),
  };
}

export interface MallDefaultDataStepOutcome {
  readonly status: "created" | "skipped";
  readonly created: number;
  readonly skipped: number;
  readonly details: readonly string[];
}

export interface MallDefaultDataStepContext {
  readonly port: MallDefaultDataPort;
  readonly dataset: MallDefaultDataDataset;
  readonly profile: MallDefaultDataProfile;
  readonly environment: MallDefaultDataEnvironment;
  readonly dryRun: boolean;
  readonly organizationId: string;
  readonly state: MallDefaultDataExecutionState;
  /** Throws when the caller aborted the run. */
  readonly assertActive: () => void;
}

export interface MallDefaultDataStep {
  readonly id: string;
  readonly domain: MallDefaultDataDomain;
  readonly title: string;
  /** Number of authored entities the step provisions. */
  readonly entityCount: number;
  readonly run: (context: MallDefaultDataStepContext) => Promise<MallDefaultDataStepOutcome>;
}

/* ------------------------------------------------------------------------- */
/* Steps                                                                     */
/* ------------------------------------------------------------------------- */

async function provisionCategories(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.catalog.listCategories()),
    ["categoryNo", "category_no"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const category of context.dataset.categories) {
    context.assertActive();
    const rootNo = buildMallCategoryNo(category.key);
    let rootId = existing.get(rootNo) ?? "";
    if (rootId) {
      skipped += 1;
    } else if (context.dryRun) {
      details.push(`+ ${rootNo} ${category.name} (dry run)`);
      created += 1;
    } else {
      const response = await context.port.catalog.createCategory(
        buildMallCategoryCreateBody({
          key: category.key,
          name: category.name,
          parentId: null,
          sortOrder: category.sortOrder,
        }),
      );
      rootId = readDefaultDataId(response);
      created += 1;
      details.push(`+ ${rootNo} ${category.name}`);
    }
    if (rootId) {
      context.state.categoryIdByKey.set(category.key, rootId);
    }

    for (const child of category.children) {
      context.assertActive();
      const childNo = buildMallCategoryNo(child.key);
      let childId = existing.get(childNo) ?? "";
      if (childId) {
        skipped += 1;
      } else if (context.dryRun) {
        details.push(`+ ${childNo} ${child.name} (dry run)`);
        created += 1;
      } else if (!rootId) {
        throw new Error(`cannot create ${childNo}: parent ${rootNo} has no id`);
      } else {
        const response = await context.port.catalog.createCategory(
          buildMallCategoryCreateBody({
            key: child.key,
            name: child.name,
            parentId: rootId,
            sortOrder: child.sortOrder,
          }),
        );
        childId = readDefaultDataId(response);
        created += 1;
        details.push(`+ ${childNo} ${child.name}`);
      }
      if (childId) {
        context.state.categoryIdByKey.set(child.key, childId);
      }
    }
  }

  const missing = context.dataset.categories
    .flatMap((category) => [category.key, ...category.children.map((child) => child.key)])
    .filter((key) => !context.state.categoryIdByKey.has(key));
  if (!context.dryRun && missing.length > 0) {
    throw new Error(
      `category provisioning left ${missing.length} categories without an id: ${missing.join(", ")}`,
    );
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionShops(context: MallDefaultDataStepContext): Promise<MallDefaultDataStepOutcome> {
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.shops.listShops()),
    ["shopName", "shop_name", "name"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const shop of context.dataset.shops) {
    context.assertActive();
    const existingId = existing.get(shop.name) ?? "";
    if (existingId) {
      skipped += 1;
      context.state.shopIdByKey.set(shop.key, existingId);
      continue;
    }
    if (context.dryRun) {
      details.push(`+ ${shop.name} (dry run)`);
      created += 1;
      continue;
    }
    const response = await context.port.shops.createShop(
      buildMallShopCreateBody(shop, context.organizationId),
    );
    const shopId = readDefaultDataId(response);
    created += 1;
    details.push(`+ ${shop.name}`);
    if (shopId) {
      context.state.shopIdByKey.set(shop.key, shopId);
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionProducts(context: MallDefaultDataStepContext): Promise<MallDefaultDataStepOutcome> {
  if (context.dataset.products.length === 0) {
    return { status: "skipped", created: 0, skipped: 0, details: [] };
  }
  const [productResponse, skuResponse] = await Promise.all([
    context.port.catalog.listProducts(),
    context.port.catalog.listSkus(),
  ]);
  const existingProducts = indexByNaturalKey(readDefaultDataItems(productResponse), [
    "spuNo",
    "spu_no",
  ]);
  const existingSkus = indexByNaturalKey(readDefaultDataItems(skuResponse), ["skuNo", "sku_no"]);
  const currencyCode = context.dataset.shops[0]?.defaultCurrencyCode ?? "CNY";
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const product of context.dataset.products) {
    context.assertActive();
    const spuNo = buildMallSpuNo(product.key);
    let productId = existingProducts.get(spuNo) ?? "";
    if (productId) {
      skipped += 1;
    } else if (context.dryRun) {
      details.push(`+ ${spuNo} ${product.title} (dry run)`);
      created += 1;
    } else {
      const categoryId = context.state.categoryIdByKey.get(product.categoryKey);
      if (!categoryId) {
        throw new Error(`cannot create ${spuNo}: category ${product.categoryKey} has no id`);
      }
      const response = await context.port.catalog.createProduct(
        buildMallProductCreateBody({
          brand: product.brand,
          categoryId,
          currencyCode,
          description: product.description,
          keywords: product.keywords,
          key: product.key,
          productType: product.productType,
          shopKey: product.shopKey,
          subtitle: product.subtitle,
          title: product.title,
        }),
      );
      productId = readDefaultDataId(response);
      created += 1;
      details.push(`+ ${spuNo} ${product.title}`);
    }
    if (!productId) {
      if (context.dryRun) {
        continue;
      }
      throw new Error(`product ${spuNo} was created without a resource id`);
    }
    context.state.productIdByKey.set(product.key, productId);

    for (const sku of product.skus) {
      context.assertActive();
      const skuNo = buildMallSkuNo(sku.key);
      if (existingSkus.has(skuNo)) {
        skipped += 1;
        continue;
      }
      if (context.dryRun) {
        details.push(`+ ${skuNo} ${sku.title} (dry run)`);
        created += 1;
        continue;
      }
      await context.port.catalog.createSku(
        buildMallSkuCreateBody({
          barcode: sku.barcode,
          currencyCode,
          key: sku.key,
          listPrice: sku.listPrice,
          price: sku.price,
          productId,
          title: sku.title,
        }),
      );
      created += 1;
      details.push(`+ ${skuNo} ${sku.title}`);
    }

    if (!context.dryRun) {
      // Publishing is idempotent on the server; a released product becomes
      // visible in storefront search, category and detail pages.
      await context.port.catalog.publishProduct(productId);
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionOffers(context: MallDefaultDataStepContext): Promise<MallDefaultDataStepOutcome> {
  if (context.dataset.offers.length === 0) {
    return { status: "skipped", created: 0, skipped: 0, details: [] };
  }
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.promotions.listOffers()),
    ["code", "offerCode", "offer_code"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const offer of context.dataset.offers) {
    context.assertActive();
    if (existing.has(offer.code)) {
      skipped += 1;
      continue;
    }
    if (context.dryRun) {
      details.push(`+ ${offer.code} ${offer.title} (dry run)`);
      created += 1;
      continue;
    }
    await context.port.promotions.createOffer(
      buildMallOfferCreateBody(offer, context.profile, context.environment),
    );
    created += 1;
    details.push(`+ ${offer.code} ${offer.title}`);
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionMembershipPlans(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.memberships.listPlans()),
    ["code"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const plan of context.dataset.membership.plans) {
    context.assertActive();
    const existingId = existing.get(plan.code) ?? "";
    if (existingId) {
      skipped += 1;
      context.state.planIdByKey.set(plan.key, existingId);
      continue;
    }
    if (context.dryRun) {
      details.push(`+ ${plan.code} ${plan.name} (dry run)`);
      created += 1;
      continue;
    }
    const response = await context.port.memberships.createPlan(
      buildMallMembershipPlanCreateBody(plan),
    );
    const planId = readDefaultDataId(response);
    created += 1;
    details.push(`+ ${plan.code} ${plan.name}`);
    if (planId) {
      context.state.planIdByKey.set(plan.key, planId);
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionMembershipPackageGroups(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.memberships.listPackageGroups()),
    ["code"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const group of context.dataset.membership.packageGroups) {
    context.assertActive();
    const existingId = existing.get(group.code) ?? "";
    if (existingId) {
      skipped += 1;
      context.state.packageGroupIdByKey.set(group.key, existingId);
      continue;
    }
    if (context.dryRun) {
      details.push(`+ ${group.code} ${group.name} (dry run)`);
      created += 1;
      continue;
    }
    const response = await context.port.memberships.createPackageGroup(
      buildMallMembershipPackageGroupCreateBody(group),
    );
    const groupId = readDefaultDataId(response);
    created += 1;
    details.push(`+ ${group.code} ${group.name}`);
    if (groupId) {
      context.state.packageGroupIdByKey.set(group.key, groupId);
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionMembershipPackages(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.memberships.listPackages()),
    ["code"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const entry of context.dataset.membership.packages) {
    context.assertActive();
    if (existing.has(entry.code)) {
      skipped += 1;
      continue;
    }
    if (context.dryRun) {
      details.push(`+ ${entry.code} ${entry.name} (dry run)`);
      created += 1;
      continue;
    }
    const planId = context.state.planIdByKey.get(entry.planKey);
    const groupId = context.state.packageGroupIdByKey.get(entry.groupKey);
    if (!planId || !groupId) {
      throw new Error(
        `cannot create ${entry.code}: missing plan (${entry.planKey}) or package group (${entry.groupKey}) id`,
      );
    }
    await context.port.memberships.createPackage(
      buildMallMembershipPackageCreateBody(entry, planId, groupId),
    );
    created += 1;
    details.push(`+ ${entry.code} ${entry.name}`);
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionCmsContent(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const presetId = buildMallCmsPresetId(context.dataset.locale);
  if (context.dryRun) {
    return {
      status: "created",
      created: 1,
      skipped: 0,
      details: [`~ storefront CMS preset ${presetId} (dry run)`],
    };
  }
  if (context.port.cms.readAppliedPreset() === presetId) {
    return { status: "skipped", created: 0, skipped: 1, details: [`= CMS preset ${presetId} already applied`] };
  }
  const current = context.port.cms.read();
  context.port.cms.write(buildMallCmsConfigFromDataset(context.dataset));
  context.port.cms.markAppliedPreset(presetId);
  return {
    status: "created",
    created: 1,
    skipped: 0,
    details: [
      `~ storefront CMS preset ${presetId}`,
      `  banners ${current.banners.length} -> ${context.dataset.cms.banners.length}`,
      `  floors ${current.floors.length} -> ${context.dataset.cms.floors.length}`,
    ],
  };
}

const CMS_STEP: MallDefaultDataStep = {
  id: "cms.storefront",
  domain: "cms",
  title: "Storefront CMS content",
  entityCount: 1,
  run: provisionCmsContent,
};

/**
 * Builds the ordered, deterministic provisioning plan.
 *
 * Order is a hard dependency chain: leaf categories need their parent id, SKUs
 * need their product id, and membership packages need both the plan and the
 * package-group id. The sequence is stable for the same dataset + profile, so a
 * rerun after a partial failure resumes the same order.
 */
export function buildMallDefaultDataPlan(
  dataset: MallDefaultDataDataset,
  profile: MallDefaultDataProfile,
): readonly MallDefaultDataStep[] {
  const categoryCount = dataset.categories.reduce(
    (total, category) => total + 1 + category.children.length,
    0,
  );
  const skuCount = dataset.products.reduce((total, product) => total + product.skus.length, 0);

  const steps: MallDefaultDataStep[] = [
    {
      id: "catalog.categories",
      domain: "catalog",
      title: "Catalog category tree",
      entityCount: categoryCount,
      run: provisionCategories,
    },
    {
      id: "shops.stores",
      domain: "shop",
      title: "Storefront shops",
      entityCount: dataset.shops.length,
      run: provisionShops,
    },
    {
      id: "catalog.products",
      domain: "catalog",
      title: "Products and SKUs",
      entityCount: dataset.products.length + skuCount,
      run: provisionProducts,
    },
    {
      id: "promotions.offers",
      domain: "promotion",
      title: "Marketing offers",
      entityCount: dataset.offers.length,
      run: provisionOffers,
    },
    {
      id: "membership.plans",
      domain: "membership",
      title: "Membership tiers",
      entityCount: dataset.membership.plans.length,
      run: provisionMembershipPlans,
    },
    {
      id: "membership.package-groups",
      domain: "membership",
      title: "Membership package groups",
      entityCount: dataset.membership.packageGroups.length,
      run: provisionMembershipPackageGroups,
    },
    {
      id: "membership.packages",
      domain: "membership",
      title: "Membership packages",
      entityCount: dataset.membership.packages.length,
      run: provisionMembershipPackages,
    },
    CMS_STEP,
  ];

  void profile;
  return steps.filter((step) => step.entityCount > 0);
}
