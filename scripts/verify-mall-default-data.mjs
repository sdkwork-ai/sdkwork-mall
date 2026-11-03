#!/usr/bin/env node
/**
 * Mall default data gate.
 *
 * Verifies, without any backend access, that the mall ships a complete and
 * coherent default dataset for every environment:
 *
 *  1. dataset integrity   - schema, unique natural keys, valid references,
 *                           decimal amounts, EAN-13 barcodes, list >= sale price
 *  2. locale parity       - every authored entity has an en-US translation
 *  3. profile coverage    - the five lifecycle environments map to profiles and
 *                           each profile keeps the entities its journeys need
 *  4. environment assets  - every declared environment has browser/desktop/
 *                           server/container runtime config examples and the
 *                           canonical build scripts (standalone + cloud)
 *
 * Behavioural checks (plan order, idempotency, verification coverage) live in
 * the package test suite: `pnpm test:vitest -- <package>`.
 *
 * Usage:
 *   node scripts/verify-mall-default-data.mjs           # human report
 *   node scripts/verify-mall-default-data.mjs --check   # exit 1 on any problem
 *   node scripts/verify-mall-default-data.mjs --json    # machine output
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const checkMode = args.has("--check");

const DATASET_DIR =
  "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/default-data/dataset";
const ZH_PATH = `${DATASET_DIR}/mall-default-data.zh-CN.json`;
const EN_PATH = `${DATASET_DIR}/mall-default-data.en-US.json`;
const APP_ROOT = "apps/sdkwork-mall-pc";

const REQUIRED_ENVIRONMENTS = ["development", "test", "demo", "staging", "production"];
const PROFILE_BY_ENVIRONMENT = {
  development: "demo",
  demo: "demo",
  test: "standard",
  staging: "standard",
  production: "minimal",
};
const BUILD_ENV_ALIASES = { development: "dev", test: "test", demo: "demo", staging: "staging", production: "prod" };

const AMOUNT = /^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/u;
const BARCODE = /^[0-9]{13}$/u;

const problems = [];
const summary = {};

function fail(area, message) {
  problems.push(`${area}: ${message}`);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(workspaceRoot, relativePath), "utf8"));
}

function checkDataset() {
  const dataset = readJson(ZH_PATH);
  summary.categories = (dataset.categories ?? []).reduce(
    (total, category) => total + 1 + (category.children?.length ?? 0),
    0,
  );
  summary.shops = dataset.shops?.length ?? 0;
  summary.products = dataset.products?.length ?? 0;
  summary.skus = (dataset.products ?? []).reduce(
    (total, product) => total + (product.skus?.length ?? 0),
    0,
  );
  summary.offers = dataset.offers?.length ?? 0;
  summary.membershipPlans = dataset.membership?.plans?.length ?? 0;
  summary.membershipPackages = dataset.membership?.packages?.length ?? 0;
  summary.cmsEntries =
    (dataset.cms?.banners?.length ?? 0) +
    (dataset.cms?.floors?.length ?? 0) +
    (dataset.cms?.hotKeywords?.length ?? 0);

  if (dataset.schemaVersion !== 1) fail("dataset", "schemaVersion must be 1");
  if (dataset.locale !== "zh-CN") fail("dataset", "authored dataset locale must be zh-CN");

  const categoryKeys = new Set();
  const leafKeys = new Set();
  for (const category of dataset.categories ?? []) {
    if (categoryKeys.has(category.key)) fail("dataset", `duplicate category key ${category.key}`);
    categoryKeys.add(category.key);
    if (!category.children?.length) fail("dataset", `category ${category.key} has no children`);
    for (const child of category.children ?? []) {
      if (categoryKeys.has(child.key)) fail("dataset", `duplicate category key ${child.key}`);
      categoryKeys.add(child.key);
      leafKeys.add(child.key);
    }
  }
  if (categoryKeys.size !== summary.categories) {
    fail("dataset", `category key count ${categoryKeys.size} != entity count ${summary.categories}`);
  }

  const shopKeys = new Set();
  for (const shop of dataset.shops ?? []) {
    if (shopKeys.has(shop.key)) fail("dataset", `duplicate shop key ${shop.key}`);
    shopKeys.add(shop.key);
    for (const field of ["name", "description", "shopType", "businessModel", "defaultCurrencyCode", "timezone"]) {
      if (!shop[field]) fail("dataset", `shop ${shop.key} is missing ${field}`);
    }
  }

  const productKeys = new Set();
  const skuKeys = new Set();
  const barcodes = new Set();
  for (const product of dataset.products ?? []) {
    if (productKeys.has(product.key)) fail("dataset", `duplicate product key ${product.key}`);
    productKeys.add(product.key);
    if (!shopKeys.has(product.shopKey)) fail("dataset", `product ${product.key} references unknown shop ${product.shopKey}`);
    if (!leafKeys.has(product.categoryKey)) {
      fail("dataset", `product ${product.key} references non-leaf category ${product.categoryKey}`);
    }
    for (const field of ["brand", "title", "subtitle", "description", "productType"]) {
      if (!product[field]) fail("dataset", `product ${product.key} is missing ${field}`);
    }
    if (!product.skus?.length) fail("dataset", `product ${product.key} has no SKUs`);
    for (const sku of product.skus ?? []) {
      if (skuKeys.has(sku.key)) fail("dataset", `duplicate SKU key ${sku.key}`);
      skuKeys.add(sku.key);
      if (!sku.title) fail("dataset", `SKU ${sku.key} has no title`);
      for (const amountField of ["price", "listPrice"]) {
        if (!AMOUNT.test(String(sku[amountField] ?? ""))) {
          fail("dataset", `SKU ${sku.key} ${amountField} must be a decimal amount`);
        }
      }
      if (Number(sku.price) > Number(sku.listPrice)) {
        fail("dataset", `SKU ${sku.key} sale price exceeds list price`);
      }
      if (!BARCODE.test(String(sku.barcode ?? ""))) fail("dataset", `SKU ${sku.key} barcode must be EAN-13`);
      if (barcodes.has(sku.barcode)) fail("dataset", `duplicate barcode ${sku.barcode}`);
      barcodes.add(sku.barcode);
    }
  }

  const offerCodes = new Set();
  for (const offer of dataset.offers ?? []) {
    if (offerCodes.has(offer.code)) fail("dataset", `duplicate offer code ${offer.code}`);
    offerCodes.add(offer.code);
    for (const field of ["key", "title", "description", "activityType", "discountText", "highlight"]) {
      if (!offer[field]) fail("dataset", `offer ${offer.code} is missing ${field}`);
    }
  }

  const planKeys = new Set();
  for (const plan of dataset.membership?.plans ?? []) {
    if (planKeys.has(plan.key)) fail("dataset", `duplicate membership plan key ${plan.key}`);
    planKeys.add(plan.key);
    if (!plan.benefits?.length) fail("dataset", `membership plan ${plan.key} has no benefits`);
    if (!Number.isInteger(plan.rank) || plan.rank < 1) fail("dataset", `membership plan ${plan.key} rank must be positive`);
  }
  const groupKeys = new Set();
  for (const group of dataset.membership?.packageGroups ?? []) {
    if (groupKeys.has(group.key)) fail("dataset", `duplicate package group key ${group.key}`);
    groupKeys.add(group.key);
    if (!["monthly", "yearly"].includes(group.billingCycle)) {
      fail("dataset", `package group ${group.key} billingCycle must be monthly or yearly`);
    }
  }
  const packageCodes = new Set();
  for (const entry of dataset.membership?.packages ?? []) {
    if (packageCodes.has(entry.code)) fail("dataset", `duplicate membership package code ${entry.code}`);
    packageCodes.add(entry.code);
    if (!planKeys.has(entry.planKey)) fail("dataset", `package ${entry.code} references unknown plan ${entry.planKey}`);
    if (!groupKeys.has(entry.groupKey)) fail("dataset", `package ${entry.code} references unknown group ${entry.groupKey}`);
    if (!AMOUNT.test(String(entry.priceAmount ?? ""))) {
      fail("dataset", `package ${entry.code} priceAmount must be a decimal amount`);
    }
  }

  for (const collection of ["banners", "floors", "hotKeywords"]) {
    const entries = dataset.cms?.[collection] ?? [];
    if (entries.length < 5) fail("dataset", `CMS ${collection} needs at least 5 entries, found ${entries.length}`);
    const keys = new Set();
    for (const entry of entries) {
      if (keys.has(entry.key)) fail("dataset", `duplicate CMS ${collection} key ${entry.key}`);
      keys.add(entry.key);
    }
  }
  return dataset;
}

function checkLocaleParity(dataset) {
  const overlay = readJson(EN_PATH);
  if (overlay.locale !== "en-US") fail("locale", "overlay locale must be en-US");
  const missing = [];
  const requireText = (value, label) => {
    if (typeof value !== "string" || !value.trim()) missing.push(label);
  };

  for (const category of dataset.categories ?? []) {
    requireText(overlay.categories?.[category.key], `category:${category.key}`);
    for (const child of category.children ?? []) {
      requireText(overlay.categories?.[child.key], `category:${child.key}`);
    }
  }
  for (const shop of dataset.shops ?? []) {
    requireText(overlay.shops?.[shop.key]?.name, `shop:${shop.key}.name`);
    requireText(overlay.shops?.[shop.key]?.description, `shop:${shop.key}.description`);
  }
  for (const product of dataset.products ?? []) {
    requireText(overlay.products?.[product.key]?.title, `product:${product.key}.title`);
    requireText(overlay.products?.[product.key]?.subtitle, `product:${product.key}.subtitle`);
    requireText(overlay.products?.[product.key]?.description, `product:${product.key}.description`);
    for (const sku of product.skus ?? []) {
      requireText(overlay.products?.[product.key]?.skus?.[sku.key], `sku:${sku.key}`);
    }
  }
  for (const offer of dataset.offers ?? []) {
    requireText(overlay.offers?.[offer.key]?.title, `offer:${offer.key}.title`);
    requireText(overlay.offers?.[offer.key]?.description, `offer:${offer.key}.description`);
  }
  for (const plan of dataset.membership?.plans ?? []) {
    requireText(overlay.membership?.plans?.[plan.key]?.name, `plan:${plan.key}.name`);
    if (!overlay.membership?.plans?.[plan.key]?.benefits?.length) missing.push(`plan:${plan.key}.benefits`);
  }
  for (const group of dataset.membership?.packageGroups ?? []) {
    requireText(overlay.membership?.packageGroups?.[group.key]?.name, `group:${group.key}.name`);
    requireText(overlay.membership?.packageGroups?.[group.key]?.description, `group:${group.key}.description`);
  }
  for (const entry of dataset.membership?.packages ?? []) {
    requireText(overlay.membership?.packages?.[entry.key]?.name, `package:${entry.key}.name`);
  }
  for (const banner of dataset.cms?.banners ?? []) {
    requireText(overlay.cms?.banners?.[banner.key]?.title, `banner:${banner.key}.title`);
    requireText(overlay.cms?.banners?.[banner.key]?.subtitle, `banner:${banner.key}.subtitle`);
  }
  for (const floor of dataset.cms?.floors ?? []) {
    requireText(overlay.cms?.floors?.[floor.key], `floor:${floor.key}`);
  }
  for (const keyword of dataset.cms?.hotKeywords ?? []) {
    requireText(overlay.cms?.hotKeywords?.[keyword.key], `keyword:${keyword.key}`);
  }

  summary.localeTranslations = summary.categories + summary.shops + summary.products + summary.skus +
    summary.offers + summary.membershipPlans + summary.membershipPackages + summary.cmsEntries;
  if (missing.length > 0) {
    fail("locale", `${missing.length} en-US translations missing: ${missing.slice(0, 8).join(", ")}`);
  }
}

function checkProfiles(dataset) {
  const demoOnlyProducts = (dataset.products ?? []).filter((product) => product.demoOnly).length;
  const demoOnlyOffers = (dataset.offers ?? []).filter((offer) => offer.demoOnly).length;
  if (demoOnlyProducts === 0 && demoOnlyOffers === 0) {
    fail("profile", "the dataset must carry demo-only entities so profiles are distinguishable");
  }

  for (const environment of REQUIRED_ENVIRONMENTS) {
    if (!PROFILE_BY_ENVIRONMENT[environment]) fail("profile", `environment ${environment} has no profile mapping`);
  }
  summary.profiles = Object.fromEntries(
    Object.entries(PROFILE_BY_ENVIRONMENT).map(([environment, profile]) => [environment, profile]),
  );
  summary.standardProducts = summary.products - demoOnlyProducts;
  summary.standardOffers = summary.offers - demoOnlyOffers;
}

function checkEnvironmentAssets() {
  const deploymentConfigPath = "etc/sdkwork.deployment.config.json";
  if (!existsSync(path.join(workspaceRoot, deploymentConfigPath))) {
    fail("environment", `missing ${deploymentConfigPath}`);
    return;
  }
  const deploymentConfig = readJson(deploymentConfigPath);
  const declared = Object.keys(deploymentConfig.environments ?? {});
  for (const environment of REQUIRED_ENVIRONMENTS) {
    if (!declared.includes(environment)) {
      fail("environment", `${deploymentConfigPath} must declare the ${environment} environment`);
    }
  }
  for (const environment of declared) {
    if (!REQUIRED_ENVIRONMENTS.includes(environment)) {
      fail("environment", `${deploymentConfigPath} declares an unmapped environment ${environment}`);
    }
    const assets = [
      `${APP_ROOT}/config/browser/runtime-env.${environment}.example.json`,
      `${APP_ROOT}/config/desktop/sdkwork-mall-pc.${environment}.toml.example`,
      `${APP_ROOT}/config/server/sdkwork-mall-pc.${environment}.toml.example`,
      `${APP_ROOT}/config/container/sdkwork-mall-pc.${environment}.toml.example`,
    ];
    for (const asset of assets) {
      if (!existsSync(path.join(workspaceRoot, asset))) {
        fail("environment", `${environment} is missing runtime config ${asset}`);
      }
    }
    const appManifest = readJson(`${APP_ROOT}/package.json`);
    const scripts = appManifest.scripts ?? {};
    const alias = BUILD_ENV_ALIASES[environment];
    for (const scriptName of [
      `build:${alias}`,
      `build:${alias}:cloud`,
    ]) {
      if (!scripts[scriptName]) {
        fail("environment", `${APP_ROOT}/package.json is missing the ${scriptName} build script`);
      }
    }
  }
}

let dataset = null;
try {
  dataset = checkDataset();
} catch (error) {
  fail("dataset", `cannot read the authored dataset: ${error instanceof Error ? error.message : String(error)}`);
}
if (dataset) {
  try {
    checkLocaleParity(dataset);
  } catch (error) {
    fail("locale", `cannot read the locale overlay: ${error instanceof Error ? error.message : String(error)}`);
  }
  checkProfiles(dataset);
}
try {
  checkEnvironmentAssets();
} catch (error) {
  fail("environment", `cannot read environment assets: ${error instanceof Error ? error.message : String(error)}`);
}

if (asJson) {
  process.stdout.write(`${JSON.stringify({ ok: problems.length === 0, summary, problems }, null, 2)}\n`);
} else {
  process.stdout.write("mall default data audit\n");
  if (dataset) {
    process.stdout.write(
      `  categories ${summary.categories} | shops ${summary.shops} | products ${summary.products} | ` +
        `skus ${summary.skus} | offers ${summary.offers} | membership ${summary.membershipPlans}/${summary.membershipPackages} | ` +
        `cms ${summary.cmsEntries}\n`,
    );
    process.stdout.write(
      `  profiles ${Object.entries(summary.profiles).map(([environment, profile]) => `${environment}=${profile}`).join(" ")}\n`,
    );
  }
  if (problems.length === 0) {
    process.stdout.write("  no problems found\n");
  } else {
    for (const problem of problems) {
      process.stdout.write(`  ✗ ${problem}\n`);
    }
  }
}

if (checkMode && problems.length > 0) {
  process.exitCode = 1;
}
