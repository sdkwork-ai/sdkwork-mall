import { decimalAmountToMinorUnits } from "../merchandiseContract";
import {
  readDefaultDataId,
  readDefaultDataItem,
  readDefaultDataItems,
  readDefaultDataString,
  readDefaultDataVersion,
} from "./port";
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
export const MALL_BRAND_NO_PREFIX = "MALL-BRAND";
export const MALL_SEED_METADATA_KEY = "sdkworkMallSeedKey";

export function buildMallCategoryNo(key: string): string {
  return buildMallDefaultDataCode(MALL_CATEGORY_NO_PREFIX, key);
}

export function buildMallBrandNo(key: string): string {
  return buildMallDefaultDataCode(MALL_BRAND_NO_PREFIX, key);
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
  // Authority `CreateCategoryRequest` closed body: categoryNo/name required,
  // no `status` (create defaults to active).
  return {
    categoryNo: buildMallCategoryNo(input.key),
    parentId: input.parentId,
    name: input.name,
    sortOrder: String(input.sortOrder),
  };
}

export function buildMallBrandCreateBody(input: {
  readonly key: string;
  readonly name: string;
  readonly description: string;
}): Record<string, unknown> {
  // Authority `CreateBrandRequest` closed body: brandNo/name required, no
  // `status` (create defaults to active).
  return {
    brandNo: buildMallBrandNo(input.key),
    name: input.name,
    description: input.description,
  };
}

/**
 * Creates one enum spec attribute with its dictionary seeded inline — the
 * authority turns every `values` entry into one attribute-value row at create
 * time, which is what a SKU's `attributeValueIds` reference.
 */
export function buildMallAttributeCreateBody(input: {
  readonly key: string;
  readonly attributeName: string;
  readonly values: readonly string[];
}): Record<string, unknown> {
  return {
    attributeNo: buildMallDefaultDataCode("MALL-ATTR", input.key),
    name: input.attributeName,
    valueType: "enum",
    inputHint: "select",
    values: [...input.values],
  };
}

export function buildMallCategoryAttributeCreateBody(input: {
  readonly categoryId: string;
  readonly attributeId: string;
}): Record<string, unknown> {
  // Authority `CreateCategoryAttributeRequest`: the binding identity is the
  // pair; role defaults to `parameter` server-side.
  return {
    categoryId: input.categoryId,
    attributeId: input.attributeId,
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
    readonly brandId: string | null;
    readonly categoryId: string;
    readonly description: string;
    readonly productType: MallDefaultDataDataset["products"][number]["productType"];
    readonly subtitle: string;
    readonly title: string;
  },
): Record<string, unknown> {
  // Authority `CreateProductRequest` closed body: productNo/title/productType/
  // categoryId required. The brand rides the authority brand_id column the
  // dataset resolves by key; lifecycle rides the `products.publish` command the
  // plan issues after the SKU loop; dataset keywords/shopKey stay draft-local
  // until the authority grows a carrier for them.
  return {
    productNo: buildMallSpuNo(input.key),
    title: input.title,
    subtitle: input.subtitle || undefined,
    description: input.description || undefined,
    productType: input.productType,
    categoryId: input.categoryId,
    ...(input.brandId ? { brandId: input.brandId } : {}),
  };
}

export function buildMallSkuCreateBody(
  input: {
    readonly key: string;
    readonly currencyCode: string;
    readonly listPrice: string;
    readonly price: string;
    readonly productId: string;
    readonly title: string;
    readonly productType: MallDefaultDataDataset["products"][number]["productType"];
    readonly attributeValueIds: readonly string[];
  },
): Record<string, unknown> {
  // Authority `CreateSkuRequest` closed body: prices ride the minor-unit wire
  // rule (`salePriceMinor`/`listPriceMinor` as integer strings), no `status`
  // (create defaults to draft; the plan publishes at the product level), and
  // the fulfillment carrier follows the product type.
  const salePriceMinor = decimalAmountToMinorUnits(input.price);
  if (!salePriceMinor) {
    throw new Error(`cannot create sku ${input.key}: price ${input.price} is not a valid decimal amount`);
  }
  const listPriceMinor = decimalAmountToMinorUnits(input.listPrice);
  return {
    productId: input.productId,
    skuNo: buildMallSkuNo(input.key),
    name: input.title,
    title: input.title,
    salePriceMinor,
    ...(listPriceMinor ? { listPriceMinor } : {}),
    currencyCode: input.currencyCode,
    fulfillmentType: input.productType === "digital"
      ? "digital"
      : input.productType === "service"
        ? "service"
        : "physical",
    // A digital or service SKU has no physical unit to count.
    inventoryTracking: input.productType === "physical" ? "quantity" : "none",
    ...(input.attributeValueIds.length > 0 ? { attributeValueIds: [...input.attributeValueIds] } : {}),
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
  /** Brand authority ids, keyed by the dataset brand key. */
  readonly brandIdByKey: Map<string, string>;
  /** SKU authority ids, keyed by the dataset SKU key. */
  readonly skuIdByKey: Map<string, string>;
  /**
   * Spec dictionary value ids for SKU `attributeValueIds`, keyed by
   * `${categoryKey}::${attributeName}::${valueName}` — the same natural key the
   * dataset's SKU spec values are authored against.
   */
  readonly attributeValueIdByKey: Map<string, string>;
}

export function createMallDefaultDataExecutionState(): MallDefaultDataExecutionState {
  return {
    categoryIdByKey: new Map(),
    shopIdByKey: new Map(),
    productIdByKey: new Map(),
    planIdByKey: new Map(),
    packageGroupIdByKey: new Map(),
    brandIdByKey: new Map(),
    skuIdByKey: new Map(),
    attributeValueIdByKey: new Map(),
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

async function provisionBrands(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  if (context.dataset.brands.length === 0) {
    return { status: "skipped", created: 0, skipped: 0, details: [] };
  }
  const existing = indexByNaturalKey(
    readDefaultDataItems(await context.port.catalog.listBrands()),
    ["brandNo", "brand_no"],
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const brand of context.dataset.brands) {
    context.assertActive();
    const brandNo = buildMallBrandNo(brand.key);
    let brandId = existing.get(brandNo) ?? "";
    if (brandId) {
      skipped += 1;
    } else if (context.dryRun) {
      details.push(`+ ${brandNo} ${brand.name} (dry run)`);
      created += 1;
    } else {
      const response = await context.port.catalog.createBrand(
        buildMallBrandCreateBody(brand),
      );
      brandId = readDefaultDataId(response);
      created += 1;
      details.push(`+ ${brandNo} ${brand.name}`);
    }
    if (brandId) {
      context.state.brandIdByKey.set(brand.key, brandId);
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

async function provisionCategoryAttributes(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  if (context.dataset.categoryAttributes.length === 0) {
    return { status: "skipped", created: 0, skipped: 0, details: [] };
  }
  const [attributeResponse, bindingResponse] = await Promise.all([
    context.port.catalog.listAttributes(),
    context.port.catalog.listCategoryAttributes(),
  ]);
  // Attribute identity rides the business key (`attributeNo`); bindings are
  // keyed by their `categoryId:attributeId` pair.
  const existingAttributes = indexByNaturalKey(readDefaultDataItems(attributeResponse), [
    "attributeNo",
    "attribute_no",
  ]);
  const existingBindingKeys = new Set(
    readDefaultDataItems(bindingResponse)
      .map((record) => {
        const categoryId = readDefaultDataString(record, ["categoryId", "category_id"]);
        const attributeId = readDefaultDataString(record, ["attributeId", "attribute_id"]);
        return categoryId && attributeId ? `${categoryId}:${attributeId}` : "";
      })
      .filter(Boolean),
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const attribute of context.dataset.categoryAttributes) {
    context.assertActive();
    const attributeNo = buildMallDefaultDataCode("MALL-ATTR", attribute.key);
    const categoryId = context.state.categoryIdByKey.get(attribute.categoryKey) ?? "";
    // On a dry run the categories step wrote no ids, so the binding half of
    // this entry is reported as a dry-run create rather than resolved.
    if (context.dryRun) {
      details.push(`+ ${attributeNo} ${attribute.attributeName} (dry run)`);
      details.push(`+ 绑定 ${attribute.attributeName} -> ${attribute.categoryKey} (dry run)`);
      created += 2;
      continue;
    }
    if (!categoryId) {
      throw new Error(
        `cannot bind attribute ${attributeNo}: category ${attribute.categoryKey} has no id`,
      );
    }

    // Attributes are workspace-scoped (not per category), so the same attribute
    // name bound to several categories resolves to one attribute record.
    let attributeId = existingAttributes.get(attributeNo) ?? "";
    if (attributeId) {
      skipped += 1;
    } else {
      const response = await context.port.catalog.createAttribute(
        buildMallAttributeCreateBody({
          key: attribute.key,
          attributeName: attribute.attributeName,
          values: attribute.values,
        }),
      );
      attributeId = readDefaultDataId(response);
      created += 1;
      details.push(`+ ${attributeNo} ${attribute.attributeName}`);
    }
    if (!attributeId) {
      continue;
    }

    const bindingKey = `${categoryId}:${attributeId}`;
    if (existingBindingKeys.has(bindingKey)) {
      skipped += 1;
    } else {
      await context.port.catalog.createCategoryAttribute(
        buildMallCategoryAttributeCreateBody({ categoryId, attributeId }),
      );
      created += 1;
      details.push(`+ 绑定 ${attribute.attributeName} -> ${attribute.categoryKey}`);
    }

    if (!context.dryRun) {
      // The dictionary values created inline ride the attribute; resolve their
      // ids once so a spec-bearing SKU can reference them.
      const valueItems = readDefaultDataItems(
        await context.port.catalog.listAttributeValues({ attributeId, page: 1, pageSize: 200 }),
      );
      for (const value of valueItems) {
        const valueId = readDefaultDataString(value, ["id"]);
        const valueName = readDefaultDataString(value, ["displayValue", "display_value"]);
        const valueCode = readDefaultDataString(value, ["valueCode", "value_code"]);
        if (valueId && (valueName || valueCode)) {
          context.state.attributeValueIdByKey.set(
            `${attribute.categoryKey}::${attribute.attributeName}::${valueName || valueCode}`,
            valueId,
          );
        }
      }
    }
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

/**
 * Provisions the default retail price ladder.
 *
 * One closed price list per dataset currency (`MALL-PRICE-<CODE>`), then one
 * ladder entry per provisioned SKU at its sale price (`minQuantity = 1`). The
 * ladder is what a pricing engine reads before falling back to the SKU's own
 * `salePriceMinor`; seeding it keeps the admin price console from starting
 * empty. Items key off `state.skuIdByKey`, so a partial rerun resumes the
 * ladder instead of double-pricing a SKU.
 */
async function provisionPriceLists(
  context: MallDefaultDataStepContext,
): Promise<MallDefaultDataStepOutcome> {
  const currencyCode = context.dataset.shops[0]?.defaultCurrencyCode ?? "CNY";
  const priceListNo = `MALL-PRICE-${currencyCode}`;
  const skus = context.dataset.products.flatMap((product) =>
    product.skus.map((sku) => ({ ...sku, productKey: product.key })),
  );
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  context.assertActive();
  const existingLists = indexByNaturalKey(
    readDefaultDataItems(await context.port.catalog.listPriceLists()),
    ["priceListNo", "price_list_no"],
  );
  let priceListId = existingLists.get(priceListNo) ?? "";
  if (priceListId) {
    skipped += 1;
  } else if (context.dryRun) {
    details.push(`+ ${priceListNo} (dry run)`);
    created += 1;
  } else {
    const response = await context.port.catalog.createPriceList({
      priceListNo,
      currencyCode,
    });
    priceListId = readDefaultDataId(response);
    created += 1;
    details.push(`+ ${priceListNo}`);
  }
  if (!priceListId) {
    return { status: created > 0 ? "created" : "skipped", created, skipped, details };
  }

  const existingItems = new Set(
    readDefaultDataItems(await context.port.catalog.listPriceListItems())
      .map((record) => readDefaultDataString(record, ["skuId", "sku_id"]))
      .filter(Boolean),
  );

  for (const sku of skus) {
    context.assertActive();
    const skuId = context.state.skuIdByKey.get(sku.key) ?? "";
    if (!skuId || existingItems.has(skuId)) {
      skipped += 1;
      continue;
    }
    const priceMinor = decimalAmountToMinorUnits(sku.price);
    if (!priceMinor) {
      throw new Error(`cannot price sku ${sku.key}: price ${sku.price} is not a valid decimal amount`);
    }
    if (context.dryRun) {
      details.push(`+ ${sku.key} @ ${priceMinor} (dry run)`);
      created += 1;
      continue;
    }
    await context.port.catalog.createPriceListItem({
      priceListId,
      skuId,
      priceMinor,
      minQuantity: "1",
    });
    created += 1;
  }

  return { status: created > 0 ? "created" : "skipped", created, skipped, details };
}

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
    // The authority resource key is `productNo`; legacy rows still carry
    // `spuNo`, so both spellings index the same provisioning key.
    "productNo",
    "product_no",
    "spuNo",
    "spu_no",
  ]);
  const existingSkus = indexByNaturalKey(readDefaultDataItems(skuResponse), ["skuNo", "sku_no"]);
  // A guarded activation needs the row version, and the list row already
  // carries it. Keeping the whole record avoids one retrieve per existing SKU
  // when a top-up rerun walks a catalog with thousands of variants.
  const existingSkuRecords = new Map<string, Record<string, unknown>>();
  for (const record of readDefaultDataItems(skuResponse)) {
    const skuNo = readDefaultDataString(record, ["skuNo", "sku_no"]);
    if (skuNo && !existingSkuRecords.has(skuNo)) {
      existingSkuRecords.set(skuNo, record);
    }
  }
  // Price-ladder provisioning keys off the dataset SKU key, so reruns resolve
  // pre-existing SKUs through the same natural key the create path used.
  const skuIdByDatasetKey = new Map<string, string>();
  for (const [naturalKey, id] of existingSkus) {
    for (const product of context.dataset.products) {
      for (const sku of product.skus) {
        if (buildMallSkuNo(sku.key) === naturalKey) {
          skuIdByDatasetKey.set(sku.key, id);
        }
      }
    }
  }
  // Guarded writes need the version each row carried at read time. A
  // provisioned row that is already live needs no publish at all — that is
  // what makes a rerun a no-op instead of a second lifecycle command.
  const existingVersionsById = new Map<string, number | null>();
  const activeProductIds = new Set<string>();
  for (const record of readDefaultDataItems(productResponse)) {
    const id = readDefaultDataString(record, ["id"]);
    if (!id) {
      continue;
    }
    existingVersionsById.set(id, readDefaultDataVersion(record));
    if (readDefaultDataString(record, ["status"]) === "active") {
      activeProductIds.add(id);
    }
  }
  const currencyCode = context.dataset.shops[0]?.defaultCurrencyCode ?? "CNY";
  const details: string[] = [];
  let created = 0;
  let skipped = 0;
  let activated = 0;

  /**
   * Makes one provisioned SKU purchasable.
   *
   * The authority inserts every SKU as `draft`/`inactive`, and
   * `products.publish` does not cascade to the SKUs (it only requires that a
   * non-deleted SKU exists). The storefront SKU read model lists `active` rows
   * only, so a seed that stops at product publish leaves the product visible
   * with an empty spec picker and nothing to buy. Activation is idempotent: an
   * already-active row is left untouched, and a guarded update carries the
   * version read (or re-read) from the row.
   */
  async function ensureSkuActive(
    skuNo: string,
    skuId: string,
    knownRecord?: Record<string, unknown>,
  ): Promise<void> {
    const known = knownRecord && knownRecord.id ? knownRecord : null;
    let record = known;
    if (!record || readDefaultDataVersion(record) === null) {
      record = readDefaultDataItem(await context.port.catalog.retrieveSku(skuId)) ?? record;
    }
    if (!record) {
      throw new Error(`cannot activate ${skuNo}: sku ${skuId} was not readable`);
    }
    if (
      readDefaultDataString(record, ["status"]) === "active" &&
      readDefaultDataString(record, ["salesStatus", "sales_status"]) === "active"
    ) {
      return;
    }
    const version = readDefaultDataVersion(record);
    if (version === null) {
      throw new Error(`cannot activate ${skuNo}: sku ${skuId} has no concurrency version`);
    }
    await context.port.catalog.updateSku(skuId, { status: "active" }, version);
    activated += 1;
  }

  for (const product of context.dataset.products) {
    context.assertActive();
    const spuNo = buildMallSpuNo(product.key);
    let productId = existingProducts.get(spuNo) ?? "";
    let productVersion = productId ? existingVersionsById.get(productId) ?? null : null;
    let needsPublish = !activeProductIds.has(productId);
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
      const brandId = context.state.brandIdByKey.get(product.brandKey) ?? "";
      const response = await context.port.catalog.createProduct(
        buildMallProductCreateBody({
          brandId: brandId || null,
          categoryId,
          description: product.description,
          key: product.key,
          productType: product.productType,
          subtitle: product.subtitle,
          title: product.title,
        }),
      );
      productId = readDefaultDataId(response);
      productVersion = readDefaultDataVersion(response);
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
        // Reruns still record the pre-existing id: the price-ladder step keys
        // its items off this state, so a partial rerun can resume the ladder.
        // A pre-existing row may predate SKU activation, so a top-up run also
        // makes it purchasable instead of only counting it as skipped.
        const existingSkuId = existingSkus.get(skuNo) ?? "";
        if (existingSkuId) {
          context.state.skuIdByKey.set(sku.key, existingSkuId);
          if (!context.dryRun) {
            await ensureSkuActive(skuNo, existingSkuId, existingSkuRecords.get(skuNo));
          }
        }
        skipped += 1;
        continue;
      }
      if (context.dryRun) {
        details.push(`+ ${skuNo} ${sku.title} (dry run)`);
        created += 1;
        continue;
      }
      const attributeValueIds = Object.entries(sku.values ?? {})
        .map(([attributeName, valueName]) =>
          context.state.attributeValueIdByKey.get(
            `${product.categoryKey}::${attributeName}::${valueName}`,
          ))
        .filter((valueId): valueId is string => Boolean(valueId));
      context.state.skuIdByKey.set(sku.key, skuIdByDatasetKey.get(sku.key) ?? "");
      const skuResponse = await context.port.catalog.createSku(
        buildMallSkuCreateBody({
          attributeValueIds,
          currencyCode,
          key: sku.key,
          listPrice: sku.listPrice,
          price: sku.price,
          productType: product.productType,
          productId,
          title: sku.title,
        }),
      );
      const createdSkuId = readDefaultDataId(skuResponse);
      if (createdSkuId) {
        context.state.skuIdByKey.set(sku.key, createdSkuId);
        // Create leaves the row a draft; the storefront only sells active SKUs.
        await ensureSkuActive(skuNo, createdSkuId, readDefaultDataItem(skuResponse) ?? undefined);
      }
      created += 1;
      details.push(`+ ${skuNo} ${sku.title}`);
    }

    if (!context.dryRun && needsPublish) {
      // Publishing rides the version recorded at read or create time: the
      // authority guards the lifecycle command with `If-Match`, so a row
      // without a version is a provisioning defect rather than a guessable
      // default. A released product becomes visible in storefront search,
      // category and detail pages.
      if (productVersion === null) {
        throw new Error(`product ${spuNo} was created without a concurrency version`);
      }
      await context.port.catalog.publishProduct(productId, productVersion);
    }
  }

  if (activated > 0) {
    // One summary line rather than thousands: the per-SKU detail would bury the
    // provisioning report on a catalog of this size.
    details.push(`~ 已激活 ${activated} 个可售 SKU`);
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
  const attributeEntityCount = dataset.categoryAttributes.reduce(
    // One attribute (with its dictionary) plus one category binding each.
    (total, attribute) => total + 2,
    0,
  );

  const steps: MallDefaultDataStep[] = [
    {
      id: "catalog.categories",
      domain: "catalog",
      title: "Catalog category tree",
      entityCount: categoryCount,
      run: provisionCategories,
    },
    {
      id: "catalog.brands",
      domain: "catalog",
      title: "Catalog brands",
      entityCount: dataset.brands.length,
      run: provisionBrands,
    },
    {
      id: "catalog.attributes",
      domain: "catalog",
      title: "Category spec attributes",
      entityCount: attributeEntityCount,
      run: provisionCategoryAttributes,
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
      id: "catalog.price-lists",
      domain: "catalog",
      title: "Retail price ladder",
      entityCount: 1 + skuCount,
      run: provisionPriceLists,
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
