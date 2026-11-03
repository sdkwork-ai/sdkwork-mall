import enUSOverlayDocument from "./mall-default-data.en-US.json";
import zhCNDocument from "./mall-default-data.zh-CN.json";
import type {
  MallDefaultDataDataset,
  MallDefaultDataLocale,
  MallDefaultDataLocaleOverlay,
  MallDefaultDataProblem,
  MallDefaultDataValidation,
} from "../types";

/** Locales the dataset ships, base locale first. */
export const MALL_DEFAULT_DATA_LOCALES: readonly MallDefaultDataLocale[] = ["zh-CN", "en-US"];

/** Authored base locale; every other locale overlays it. */
export const MALL_DEFAULT_DATA_BASE_LOCALE: MallDefaultDataLocale = "zh-CN";

const AMOUNT_PATTERN = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{2})$/u;
const BARCODE_PATTERN = /^[0-9]{13}$/u;

/** Authored zh-CN dataset document. */
export const zhCnDefaultDataset = zhCNDocument as unknown as MallDefaultDataDataset;

/** Translated overlay document. */
export const enUsDefaultOverlay = enUSOverlayDocument as unknown as MallDefaultDataLocaleOverlay;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Validates the authored dataset.
 *
 * The dataset is provisioning input, so every defect must be reported before a
 * single write reaches the commerce API: duplicate natural keys would create
 * ambiguous lookups, dangling references would fail mid-plan, and malformed
 * amounts or barcodes would be rejected by the server after partial success.
 */
export function validateDefaultDataset(dataset: unknown): MallDefaultDataValidation {
  const problems: MallDefaultDataProblem[] = [];
  const fail = (path: string, message: string) => problems.push({ path, message });

  if (!isRecord(dataset)) {
    return { valid: false, problems: [{ path: "$", message: "dataset must be an object" }] };
  }
  if (dataset.schemaVersion !== 1) {
    fail("$.schemaVersion", "schemaVersion must be 1");
  }
  if (dataset.locale !== "zh-CN") {
    fail("$.locale", "authored dataset locale must be zh-CN");
  }

  const categoryKeys = new Set<string>();
  const rootKeys = new Set<string>();
  const childToRoot = new Map<string, string>();
  const categories = Array.isArray(dataset.categories) ? dataset.categories : [];
  if (categories.length === 0) {
    fail("$.categories", "at least one category is required");
  }
  categories.forEach((category, index) => {
    const path = `$.categories[${index}]`;
    if (!isRecord(category)) {
      fail(path, "category must be an object");
      return;
    }
    if (!isNonEmptyString(category.key)) {
      fail(`${path}.key`, "category key is required");
    } else if (rootKeys.has(category.key)) {
      fail(`${path}.key`, `duplicate category key ${category.key}`);
    } else {
      rootKeys.add(category.key);
      categoryKeys.add(category.key);
    }
    if (!isNonEmptyString(category.name)) {
      fail(`${path}.name`, "category name is required");
    }
    if (!isPositiveInteger(category.sortOrder)) {
      fail(`${path}.sortOrder`, "sortOrder must be a positive integer");
    }
    const children = Array.isArray(category.children) ? category.children : [];
    if (children.length === 0) {
      fail(`${path}.children`, "a root category must expose at least one child");
    }
    children.forEach((child, childIndex) => {
      const childPath = `${path}.children[${childIndex}]`;
      if (!isRecord(child)) {
        fail(childPath, "child category must be an object");
        return;
      }
      if (!isNonEmptyString(child.key)) {
        fail(`${childPath}.key`, "child category key is required");
      } else if (categoryKeys.has(child.key)) {
        fail(`${childPath}.key`, `duplicate category key ${child.key}`);
      } else {
        categoryKeys.add(child.key);
        if (isNonEmptyString(category.key)) {
          childToRoot.set(child.key, category.key);
        }
      }
      if (!isNonEmptyString(child.name)) {
        fail(`${childPath}.name`, "child category name is required");
      }
      if (!isPositiveInteger(child.sortOrder)) {
        fail(`${childPath}.sortOrder`, "sortOrder must be a positive integer");
      }
    });
  });

  const shopKeys = new Set<string>();
  const shops = Array.isArray(dataset.shops) ? dataset.shops : [];
  if (shops.length === 0) {
    fail("$.shops", "at least one shop is required");
  }
  shops.forEach((shop, index) => {
    const path = `$.shops[${index}]`;
    if (!isRecord(shop)) {
      fail(path, "shop must be an object");
      return;
    }
    if (!isNonEmptyString(shop.key)) {
      fail(`${path}.key`, "shop key is required");
    } else if (shopKeys.has(shop.key)) {
      fail(`${path}.key`, `duplicate shop key ${shop.key}`);
    } else {
      shopKeys.add(shop.key);
    }
    for (const field of ["name", "description", "shopType", "businessModel", "defaultCurrencyCode", "timezone"] as const) {
      if (!isNonEmptyString(shop[field])) {
        fail(`${path}.${field}`, `${field} is required`);
      }
    }
  });

  const productKeys = new Set<string>();
  const skuKeys = new Set<string>();
  const barcodes = new Set<string>();
  const products = Array.isArray(dataset.products) ? dataset.products : [];
  products.forEach((product, index) => {
    const path = `$.products[${index}]`;
    if (!isRecord(product)) {
      fail(path, "product must be an object");
      return;
    }
    if (!isNonEmptyString(product.key)) {
      fail(`${path}.key`, "product key is required");
    } else if (productKeys.has(product.key)) {
      fail(`${path}.key`, `duplicate product key ${product.key}`);
    } else {
      productKeys.add(product.key);
    }
    if (!isNonEmptyString(product.shopKey) || !shopKeys.has(product.shopKey)) {
      fail(`${path}.shopKey`, `product references unknown shop ${String(product.shopKey)}`);
    }
    if (!isNonEmptyString(product.categoryKey) || !childToRoot.has(product.categoryKey)) {
      fail(`${path}.categoryKey`, `product must reference a leaf category, got ${String(product.categoryKey)}`);
    }
    for (const field of ["brand", "title", "subtitle", "description", "productType"] as const) {
      if (!isNonEmptyString(product[field])) {
        fail(`${path}.${field}`, `${field} is required`);
      }
    }
    const skus = Array.isArray(product.skus) ? product.skus : [];
    if (skus.length === 0) {
      fail(`${path}.skus`, "a product must expose at least one SKU");
    }
    skus.forEach((sku, skuIndex) => {
      const skuPath = `${path}.skus[${skuIndex}]`;
      if (!isRecord(sku)) {
        fail(skuPath, "SKU must be an object");
        return;
      }
      if (!isNonEmptyString(sku.key)) {
        fail(`${skuPath}.key`, "SKU key is required");
      } else if (skuKeys.has(sku.key)) {
        fail(`${skuPath}.key`, `duplicate SKU key ${sku.key}`);
      } else {
        skuKeys.add(sku.key);
      }
      if (!isNonEmptyString(sku.title)) {
        fail(`${skuPath}.title`, "SKU title is required");
      }
      for (const amountField of ["price", "listPrice"] as const) {
        const amount = sku[amountField];
        if (!isNonEmptyString(amount) || !AMOUNT_PATTERN.test(amount)) {
          fail(`${skuPath}.${amountField}`, `${amountField} must be a decimal amount with two fraction digits`);
        }
      }
      const price = Number(sku.price);
      const listPrice = Number(sku.listPrice);
      if (Number.isFinite(price) && Number.isFinite(listPrice) && price > listPrice) {
        fail(`${skuPath}.price`, "sale price must not exceed the list price");
      }
      if (!isNonEmptyString(sku.barcode) || !BARCODE_PATTERN.test(sku.barcode)) {
        fail(`${skuPath}.barcode`, "barcode must be a 13-digit EAN-13 value");
      } else if (barcodes.has(sku.barcode)) {
        fail(`${skuPath}.barcode`, `duplicate barcode ${sku.barcode}`);
      } else {
        barcodes.add(sku.barcode);
      }
    });
  });

  const offerCodes = new Set<string>();
  const offers = Array.isArray(dataset.offers) ? dataset.offers : [];
  offers.forEach((offer, index) => {
    const path = `$.offers[${index}]`;
    if (!isRecord(offer)) {
      fail(path, "offer must be an object");
      return;
    }
    if (!isNonEmptyString(offer.code)) {
      fail(`${path}.code`, "offer code is required");
    } else if (offerCodes.has(offer.code)) {
      fail(`${path}.code`, `duplicate offer code ${offer.code}`);
    } else {
      offerCodes.add(offer.code);
    }
    for (const field of ["key", "title", "description", "activityType", "discountText", "highlight"] as const) {
      if (!isNonEmptyString(offer[field])) {
        fail(`${path}.${field}`, `${field} is required`);
      }
    }
  });

  const membership = isRecord(dataset.membership) ? dataset.membership : {};
  const plans = Array.isArray(membership.plans) ? membership.plans : [];
  const planByKey = new Map<string, number>();
  plans.forEach((plan, index) => {
    const path = `$.membership.plans[${index}]`;
    if (!isRecord(plan)) {
      fail(path, "membership plan must be an object");
      return;
    }
    if (!isNonEmptyString(plan.key) || !isNonEmptyString(plan.code)) {
      fail(path, "membership plan requires key and code");
      return;
    }
    if (planByKey.has(plan.key)) {
      fail(`${path}.key`, `duplicate membership plan key ${plan.key}`);
    }
    planByKey.set(plan.key, index);
    if (!isNonEmptyString(plan.name)) {
      fail(`${path}.name`, "membership plan name is required");
    }
    if (!isPositiveInteger(plan.rank)) {
      fail(`${path}.rank`, "membership plan rank must be a positive integer");
    }
    const benefits = Array.isArray(plan.benefits) ? plan.benefits : [];
    if (benefits.length === 0 || benefits.some((benefit) => !isNonEmptyString(benefit))) {
      fail(`${path}.benefits`, "membership plan benefits must be a non-empty string list");
    }
  });
  if (plans.length === 0) {
    fail("$.membership.plans", "at least one membership plan is required");
  }

  const groups = Array.isArray(membership.packageGroups) ? membership.packageGroups : [];
  const groupByKey = new Map<string, number>();
  groups.forEach((group, index) => {
    const path = `$.membership.packageGroups[${index}]`;
    if (!isRecord(group)) {
      fail(path, "membership package group must be an object");
      return;
    }
    if (!isNonEmptyString(group.key) || !isNonEmptyString(group.code)) {
      fail(path, "membership package group requires key and code");
      return;
    }
    if (groupByKey.has(group.key)) {
      fail(`${path}.key`, `duplicate package group key ${group.key}`);
    }
    groupByKey.set(group.key, index);
    if (group.billingCycle !== "monthly" && group.billingCycle !== "yearly") {
      fail(`${path}.billingCycle`, "billingCycle must be monthly or yearly");
    }
    if (!isPositiveInteger(group.durationDays)) {
      fail(`${path}.durationDays`, "durationDays must be a positive integer");
    }
  });
  if (groups.length === 0) {
    fail("$.membership.packageGroups", "at least one membership package group is required");
  }

  const packages = Array.isArray(membership.packages) ? membership.packages : [];
  const packageCodes = new Set<string>();
  packages.forEach((entry, index) => {
    const path = `$.membership.packages[${index}]`;
    if (!isRecord(entry)) {
      fail(path, "membership package must be an object");
      return;
    }
    if (!isNonEmptyString(entry.code)) {
      fail(`${path}.code`, "membership package code is required");
    } else if (packageCodes.has(entry.code)) {
      fail(`${path}.code`, `duplicate membership package code ${entry.code}`);
    } else {
      packageCodes.add(entry.code);
    }
    if (!isNonEmptyString(entry.planKey) || !planByKey.has(entry.planKey)) {
      fail(`${path}.planKey`, `membership package references unknown plan ${String(entry.planKey)}`);
    }
    if (!isNonEmptyString(entry.groupKey) || !groupByKey.has(entry.groupKey)) {
      fail(`${path}.groupKey`, `membership package references unknown package group ${String(entry.groupKey)}`);
    }
    if (!isNonEmptyString(entry.priceAmount) || !AMOUNT_PATTERN.test(entry.priceAmount)) {
      fail(`${path}.priceAmount`, "priceAmount must be a decimal amount with two fraction digits");
    }
    if (!isNonEmptyString(entry.currencyCode)) {
      fail(`${path}.currencyCode`, "currencyCode is required");
    }
    if (!isPositiveInteger(entry.durationDays)) {
      fail(`${path}.durationDays`, "durationDays must be a positive integer");
    }
  });

  const cms = isRecord(dataset.cms) ? dataset.cms : {};
  for (const [collection, minimum] of [
    ["banners", 1],
    ["floors", 1],
    ["hotKeywords", 1],
  ] as const) {
    const entries = Array.isArray(cms[collection]) ? cms[collection] : [];
    if (entries.length < minimum) {
      fail(`$.cms.${collection}`, `at least ${minimum} CMS ${collection} entry is required`);
    }
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const path = `$.cms.${collection}[${index}]`;
      if (!isRecord(entry)) {
        fail(path, "CMS entry must be an object");
        return;
      }
      if (!isNonEmptyString(entry.key) || seen.has(entry.key)) {
        fail(`${path}.key`, "CMS entry key must be unique and non-empty");
      } else {
        seen.add(entry.key);
      }
      if (!isPositiveInteger(entry.sortOrder)) {
        fail(`${path}.sortOrder`, "sortOrder must be a positive integer");
      }
    });
  }
  const banners = Array.isArray(cms.banners) ? cms.banners : [];
  banners.forEach((banner, index) => {
    if (!isRecord(banner)) {
      return;
    }
    for (const field of ["title", "subtitle", "linkUrl"] as const) {
      if (!isNonEmptyString(banner[field])) {
        fail(`$.cms.banners[${index}].${field}`, `${field} is required`);
      }
    }
  });
  const floors = Array.isArray(cms.floors) ? cms.floors : [];
  floors.forEach((floor, index) => {
    if (isRecord(floor) && !isNonEmptyString(floor.title)) {
      fail(`$.cms.floors[${index}].title`, "title is required");
    }
  });
  const keywords = Array.isArray(cms.hotKeywords) ? cms.hotKeywords : [];
  keywords.forEach((keyword, index) => {
    if (isRecord(keyword) && !isNonEmptyString(keyword.keyword)) {
      fail(`$.cms.hotKeywords[${index}].keyword`, "keyword is required");
    }
  });

  return { valid: problems.length === 0, problems };
}

/**
 * Applies a locale overlay to the authored dataset.
 *
 * `zh-CN` is returned unchanged. For `en-US` every authorable text field is
 * replaced when the overlay carries it, and falls back to the authored text
 * otherwise, so a partially translated dataset still provisions coherently.
 */
export function resolveDefaultDataset(
  locale: MallDefaultDataLocale = MALL_DEFAULT_DATA_BASE_LOCALE,
  base: MallDefaultDataDataset = zhCnDefaultDataset,
  overlay: MallDefaultDataLocaleOverlay = enUsDefaultOverlay,
): MallDefaultDataDataset {
  if (locale === "zh-CN") {
    return base;
  }
  const pick = (value: string, translated: string | undefined) =>
    translated && translated.trim() ? translated : value;

  return {
    ...base,
    locale,
    categories: base.categories.map((category) => ({
      ...category,
      name: pick(category.name, overlay.categories[category.key]),
      children: category.children.map((child) => ({
        ...child,
        name: pick(child.name, overlay.categories[child.key]),
      })),
    })),
    shops: base.shops.map((shop) => ({
      ...shop,
      name: pick(shop.name, overlay.shops[shop.key]?.name),
      description: pick(shop.description, overlay.shops[shop.key]?.description),
    })),
    products: base.products.map((product) => {
      const translated = overlay.products[product.key];
      return {
        ...product,
        title: pick(product.title, translated?.title),
        subtitle: pick(product.subtitle, translated?.subtitle),
        description: pick(product.description, translated?.description),
        skus: product.skus.map((sku) => ({
          ...sku,
          title: pick(sku.title, translated?.skus?.[sku.key]),
        })),
      };
    }),
    offers: base.offers.map((offer) => ({
      ...offer,
      title: pick(offer.title, overlay.offers[offer.key]?.title),
      description: pick(offer.description, overlay.offers[offer.key]?.description),
    })),
    membership: {
      plans: base.membership.plans.map((plan) => ({
        ...plan,
        name: pick(plan.name, overlay.membership.plans[plan.key]?.name),
        benefits: overlay.membership.plans[plan.key]?.benefits?.length
          ? overlay.membership.plans[plan.key]?.benefits ?? plan.benefits
          : plan.benefits,
      })),
      packageGroups: base.membership.packageGroups.map((group) => ({
        ...group,
        name: pick(group.name, overlay.membership.packageGroups[group.key]?.name),
        description: pick(group.description, overlay.membership.packageGroups[group.key]?.description),
      })),
      packages: base.membership.packages.map((entry) => ({
        ...entry,
        name: pick(entry.name, overlay.membership.packages[entry.key]?.name),
      })),
    },
    cms: {
      banners: base.cms.banners.map((banner) => ({
        ...banner,
        title: pick(banner.title, overlay.cms.banners[banner.key]?.title),
        subtitle: pick(banner.subtitle, overlay.cms.banners[banner.key]?.subtitle),
      })),
      floors: base.cms.floors.map((floor) => ({
        ...floor,
        title: pick(floor.title, overlay.cms.floors[floor.key]),
      })),
      hotKeywords: base.cms.hotKeywords.map((keyword) => ({
        ...keyword,
        keyword: pick(keyword.keyword, overlay.cms.hotKeywords[keyword.key]),
      })),
    },
  };
}
