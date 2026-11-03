import {
  buildMallCategoryNo,
  buildMallCmsPresetId,
  buildMallSkuNo,
  buildMallSpuNo,
} from "./plan";
import { readDefaultDataItems, readDefaultDataString } from "./port";
import type { MallDefaultDataPort } from "./port";
import type {
  MallDefaultDataDataset,
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataProfile,
} from "./types";

export type MallDefaultDataCheckStatus = "pass" | "warn" | "fail";

export interface MallDefaultDataCheck {
  readonly id: string;
  readonly label: string;
  readonly status: MallDefaultDataCheckStatus;
  readonly expected: number;
  readonly actual: number;
  readonly missing: readonly string[];
}

/** Coverage report proving the environment can run the mall end to end. */
export interface MallDefaultDataVerification {
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
  readonly locale: MallDefaultDataLocale;
  readonly checkedAt: string;
  readonly checks: readonly MallDefaultDataCheck[];
  readonly ok: boolean;
}

export interface MallDefaultDataVerificationOptions {
  readonly port: MallDefaultDataPort;
  readonly dataset: MallDefaultDataDataset;
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
  readonly locale: MallDefaultDataLocale;
  readonly now?: () => Date;
}

function collectNaturalKeys(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): Set<string> {
  const present = new Set<string>();
  for (const record of records) {
    for (const key of keys) {
      const value = readDefaultDataString(record, [key]);
      if (value) {
        present.add(value);
      }
    }
  }
  return present;
}

function buildCheck(
  id: string,
  label: string,
  expected: readonly string[],
  present: ReadonlySet<string>,
): MallDefaultDataCheck {
  const missing = expected.filter((key) => !present.has(key));
  const actual = expected.length - missing.length;
  const status: MallDefaultDataCheckStatus =
    missing.length === 0 ? "pass" : actual === 0 ? "fail" : "warn";
  return { id, label, status, expected: expected.length, actual, missing };
}

/**
 * Verifies that every entity the active profile requires is readable from the
 * environment. The check is intentionally read-only and idempotent: it is safe
 * to run against production from the admin console.
 */
export async function verifyMallDefaultData(
  options: MallDefaultDataVerificationOptions,
): Promise<MallDefaultDataVerification> {
  const now = options.now ?? (() => new Date());
  const { dataset, port } = options;
  const checks: MallDefaultDataCheck[] = [];

  const [categoryRecords, shopRecords, productRecords, skuRecords, offerRecords, planRecords, groupRecords, packageRecords] =
    await Promise.all([
      port.catalog.listCategories().then(readDefaultDataItems),
      port.shops.listShops().then(readDefaultDataItems),
      port.catalog.listProducts().then(readDefaultDataItems),
      port.catalog.listSkus().then(readDefaultDataItems),
      port.promotions.listOffers().then(readDefaultDataItems),
      port.memberships.listPlans().then(readDefaultDataItems),
      port.memberships.listPackageGroups().then(readDefaultDataItems),
      port.memberships.listPackages().then(readDefaultDataItems),
    ]);

  checks.push(
    buildCheck(
      "catalog.categories",
      "Catalog category tree",
      dataset.categories.flatMap((category) => [
        buildMallCategoryNo(category.key),
        ...category.children.map((child) => buildMallCategoryNo(child.key)),
      ]),
      collectNaturalKeys(categoryRecords, ["categoryNo", "category_no"]),
    ),
  );

  if (dataset.shops.length > 0) {
    checks.push(
      buildCheck(
        "shops.stores",
        "Storefront shops",
        dataset.shops.map((shop) => shop.name),
        collectNaturalKeys(shopRecords, ["shopName", "shop_name", "name"]),
      ),
    );
  }

  if (dataset.products.length > 0) {
    checks.push(
      buildCheck(
        "catalog.products",
        "Products",
        dataset.products.map((product) => buildMallSpuNo(product.key)),
        collectNaturalKeys(productRecords, ["spuNo", "spu_no"]),
      ),
    );
    checks.push(
      buildCheck(
        "catalog.skus",
        "SKUs",
        dataset.products.flatMap((product) =>
          product.skus.map((sku) => buildMallSkuNo(sku.key)),
        ),
        collectNaturalKeys(skuRecords, ["skuNo", "sku_no"]),
      ),
    );

    // Every leaf category and every storefront shop must carry at least one
    // product, otherwise its page is an empty-state dead end in a demo.
    const leaves = dataset.categories.flatMap((category) => category.children);
    const coveredCategories = new Set(dataset.products.map((product) => product.categoryKey));
    const coveredShops = new Set(dataset.products.map((product) => product.shopKey));
    const uncovered = [
      ...leaves
        .filter((leaf) => !coveredCategories.has(leaf.key))
        .map((leaf) => `category:${leaf.key}`),
      ...dataset.shops
        .filter((shop) => !coveredShops.has(shop.key))
        .map((shop) => `shop:${shop.key}`),
    ];
    const coverageActual = leaves.length + dataset.shops.length - uncovered.length;
    checks.push({
      id: "catalog.coverage",
      label: "Catalog coverage",
      status: uncovered.length === 0 ? "pass" : coverageActual === 0 ? "fail" : "warn",
      expected: leaves.length + dataset.shops.length,
      actual: coverageActual,
      missing: uncovered,
    });
  }

  if (dataset.offers.length > 0) {
    checks.push(
      buildCheck(
        "promotions.offers",
        "Marketing offers",
        dataset.offers.map((offer) => offer.code),
        collectNaturalKeys(offerRecords, ["code", "offerCode", "offer_code"]),
      ),
    );
  }

  if (dataset.membership.plans.length > 0) {
    checks.push(
      buildCheck(
        "membership.plans",
        "Membership tiers",
        dataset.membership.plans.map((plan) => plan.code),
        collectNaturalKeys(planRecords, ["code"]),
      ),
    );
  }

  if (dataset.membership.packageGroups.length > 0) {
    checks.push(
      buildCheck(
        "membership.package-groups",
        "Membership package groups",
        dataset.membership.packageGroups.map((group) => group.code),
        collectNaturalKeys(groupRecords, ["code"]),
      ),
    );
  }

  if (dataset.membership.packages.length > 0) {
    checks.push(
      buildCheck(
        "membership.packages",
        "Membership packages",
        dataset.membership.packages.map((entry) => entry.code),
        collectNaturalKeys(packageRecords, ["code"]),
      ),
    );
  }

  const cms = port.cms.read();
  const presetApplied = port.cms.readAppliedPreset() === buildMallCmsPresetId(options.locale);
  const cmsExpected = dataset.cms.banners.length + dataset.cms.floors.length;
  const cmsActual = cms.banners.length + cms.floors.length;
  checks.push({
    id: "cms.storefront",
    label: "Storefront CMS content",
    status: presetApplied ? "pass" : cmsActual >= cmsExpected ? "warn" : "fail",
    expected: cmsExpected,
    actual: cmsActual,
    missing: presetApplied ? [] : ["default-data CMS preset"],
  });

  return {
    environment: options.environment,
    profile: options.profile,
    locale: options.locale,
    checkedAt: now().toISOString(),
    checks,
    ok: checks.every((check) => check.status !== "fail"),
  };
}
