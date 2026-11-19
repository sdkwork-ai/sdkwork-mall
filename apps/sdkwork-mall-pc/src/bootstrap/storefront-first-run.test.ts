import { afterEach, describe, expect, it } from "vitest";

import {
  configureMallDefaultDataProvider,
  runMallDefaultDataInitialization,
} from "@sdkwork/mall-pc-admin-product/default-data";
import {
  configureSdkworkHomeRemotePort,
  loadMallHomeSnapshot,
} from "@sdkwork/mall-pc-home";

/**
 * End-to-end regression for "a fresh install opens an empty mall".
 *
 * The fake below is a minimal in-memory commerce authority: it stores exactly
 * the entities the provisioning plan creates, and the home reads are wired to
 * the same store, so this test fails if any link of the chain breaks —
 * dataset → plan payloads → stored rows → storefront projection.
 */
interface FakeRow {
  [key: string]: unknown;
}

interface FakeCommerceState {
  attributeValues: FakeRow[];
  attributes: FakeRow[];
  brands: FakeRow[];
  categories: FakeRow[];
  categoryAttributes: FakeRow[];
  cms: Record<string, unknown> | null;
  cmsPreset: string | null;
  offers: FakeRow[];
  packageGroups: FakeRow[];
  packages: FakeRow[];
  plans: FakeRow[];
  priceListItems: FakeRow[];
  priceLists: FakeRow[];
  products: FakeRow[];
  shops: FakeRow[];
  skus: FakeRow[];
}

function createFakeCommerce() {
  const state: FakeCommerceState = {
    attributeValues: [],
    attributes: [],
    brands: [],
    categories: [],
    categoryAttributes: [],
    cms: null,
    cmsPreset: null,
    offers: [],
    packageGroups: [],
    packages: [],
    plans: [],
    priceListItems: [],
    priceLists: [],
    products: [],
    shops: [],
    skus: [],
  };
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;
  const insert = (rows: FakeRow[], body: Record<string, unknown>, prefix: string) => {
    const id = nextId(prefix);
    rows.push({ ...body, id });
    return { item: { id, version: 1 } };
  };
  const list = (rows: FakeRow[]) => Promise.resolve({ items: [...rows] });

  const port = {
    catalog: {
      listBrands: () => list(state.brands),
      createBrand: (body: Record<string, unknown>) => Promise.resolve(insert(state.brands, body, "brand")),
      listAttributes: () => list(state.attributes),
      createAttribute: (body: Record<string, unknown>) => {
        const id = nextId("attr");
        state.attributes.push({ ...body, id });
        const values = Array.isArray(body.values) ? (body.values as string[]) : [];
        for (const value of values) {
          state.attributeValues.push({ attributeId: id, displayValue: value, id: nextId("attrvalue") });
        }
        return Promise.resolve({ item: { id, version: 1 } });
      },
      listAttributeValues: (params?: Record<string, unknown>) =>
        Promise.resolve({
          items: state.attributeValues.filter((row) => row.attributeId === params?.attributeId),
        }),
      listCategoryAttributes: () => list(state.categoryAttributes),
      createCategoryAttribute: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.categoryAttributes, body, "catattr")),
      listPriceLists: () => list(state.priceLists),
      createPriceList: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.priceLists, body, "pricelist")),
      listPriceListItems: () => list(state.priceListItems),
      createPriceListItem: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.priceListItems, body, "priceitem")),
      listCategories: () => list(state.categories),
      createCategory: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.categories, body, "category")),
      listProducts: () => list(state.products),
      createProduct: (body: Record<string, unknown>) => {
        const id = nextId("product");
        state.products.push({ ...body, id, status: "draft" });
        return Promise.resolve({ item: { id, version: 1 } });
      },
      publishProduct: (productId: string, expectedVersion: number) => {
        const product = state.products.find((row) => row.id === productId);
        if (!product) {
          return Promise.reject(new Error(`unknown product ${productId}`));
        }
        if (product.version !== undefined && product.version !== expectedVersion) {
          return Promise.reject(new Error("version mismatch"));
        }
        product.status = "active";
        return Promise.resolve({ item: { id: productId, version: expectedVersion + 1 } });
      },
      listSkus: () => list(state.skus),
      createSku: (body: Record<string, unknown>) =>
        Promise.resolve(
          insert(state.skus, { ...body, status: "draft", salesStatus: "inactive" }, "sku"),
        ),
      retrieveSku: (skuId: string) => {
        const record = state.skus.find((row) => row.id === skuId);
        return record ? Promise.resolve({ item: record }) : Promise.reject(new Error(`unknown sku ${skuId}`));
      },
      updateSku: (skuId: string, body: Record<string, unknown>, expectedVersion: number) => {
        const record = state.skus.find((row) => row.id === skuId);
        if (!record) {
          return Promise.reject(new Error(`unknown sku ${skuId}`));
        }
        Object.assign(record, body);
        record.salesStatus = record.status === "active" ? "active" : "inactive";
        record.version = expectedVersion + 1;
        return Promise.resolve({ item: record });
      },
    },
    shops: {
      listShops: () => list(state.shops),
      createShop: (body: Record<string, unknown>) => Promise.resolve(insert(state.shops, body, "shop")),
    },
    promotions: {
      listOffers: () => list(state.offers),
      createOffer: (body: Record<string, unknown>) => Promise.resolve(insert(state.offers, body, "offer")),
    },
    memberships: {
      listPlans: () => list(state.plans),
      createPlan: (body: Record<string, unknown>) => Promise.resolve(insert(state.plans, body, "plan")),
      listPackageGroups: () => list(state.packageGroups),
      createPackageGroup: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.packageGroups, body, "packagegroup")),
      listPackages: () => list(state.packages),
      createPackage: (body: Record<string, unknown>) =>
        Promise.resolve(insert(state.packages, body, "package")),
    },
    cms: {
      read: () => ({
        banners: [],
        floors: [],
        hotKeywords: [],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      write: (config: unknown) => {
        state.cms = config as Record<string, unknown>;
      },
      readAppliedPreset: () => state.cmsPreset,
      markAppliedPreset: (presetId: string) => {
        state.cmsPreset = presetId;
      },
    },
  };

  return { port, state };
}

function wireStorefrontToFake(state: FakeCommerceState): void {
  configureSdkworkHomeRemotePort({
    listCategories: () =>
      Promise.resolve({
        data: {
          items: state.categories
            .filter((row) => !row.parentId)
            .map((row) => ({ id: row.id, name: row.name })),
          pageInfo: { mode: "offset" },
        },
      }),
    listShops: () =>
      Promise.resolve({
        data: {
          items: state.shops.map((row) => ({ id: row.id, name: row.shopName })),
          pageInfo: { mode: "offset" },
        },
      }),
    listSpus: () =>
      Promise.resolve({
        data: {
          items: state.products
            .filter((row) => row.status === "active")
            .map((row) => ({
              id: row.id,
              title: row.title,
              subtitle: row.subtitle,
            })),
          pageInfo: { mode: "offset" },
        },
      }),
  });
}

afterEach(() => {
  configureMallDefaultDataProvider(null);
  configureSdkworkHomeRemotePort(null);
});

describe("fresh install storefront", () => {
  it("opens empty, then renders a populated mall once default data is provisioned", async () => {
    const { port, state } = createFakeCommerce();
    configureMallDefaultDataProvider({
      defaultLocale: "zh-CN",
      environment: "development",
      port,
    });
    wireStorefrontToFake(state);

    // 1. A brand-new install: every read succeeds and the catalog is empty.
    const before = await loadMallHomeSnapshot();
    expect(before.isEmpty).toBe(true);
    expect(before.issues).toEqual([]);

    // 2. Provisioning runs the authored dataset through the fake authority.
    const report = await runMallDefaultDataInitialization();
    expect(report.ok).toBe(true);
    expect(report.summary.created).toBeGreaterThan(0);
    expect(report.summary.failed).toBe(0);

    // 3. The storefront now reads real rows: categories, products and shops.
    const after = await loadMallHomeSnapshot();
    expect(after.isEmpty).toBe(false);
    expect(after.issues).toEqual([]);
    expect(after.categories.length).toBeGreaterThan(0);
    expect(after.hotProducts.length).toBeGreaterThan(0);
    expect(after.newProducts.length).toBeGreaterThan(0);
    expect(after.featuredShops.length).toBeGreaterThan(0);
    expect(after.hotProducts.every((product) => product.title.length > 0)).toBe(true);

    // 4. Every seeded SPU is published, so storefront listings are not dead ends.
    expect(state.products.every((row) => row.status === "active")).toBe(true);
    expect(state.skus.length).toBeGreaterThan(state.products.length);
    // 5. Every seeded SKU is active too: a published product whose SKUs stayed
    //    draft renders a PDP with an empty spec picker.
    expect(state.skus.every((row) => row.status === "active" && row.salesStatus === "active")).toBe(true);
  });

  it("is idempotent: a second run creates nothing and the storefront stays populated", async () => {
    const { port, state } = createFakeCommerce();
    configureMallDefaultDataProvider({ defaultLocale: "zh-CN", environment: "demo", port });
    wireStorefrontToFake(state);

    const first = await runMallDefaultDataInitialization();
    expect(first.ok).toBe(true);
    const second = await runMallDefaultDataInitialization();
    expect(second.ok).toBe(true);
    expect(second.summary.created).toBe(0);

    const snapshot = await loadMallHomeSnapshot();
    expect(snapshot.isEmpty).toBe(false);
    expect(snapshot.hotProducts.length).toBeGreaterThan(0);
  });

  it("seeds the production reference slice without demo products", async () => {
    const { port, state } = createFakeCommerce();
    configureMallDefaultDataProvider({ defaultLocale: "zh-CN", environment: "production", port });
    wireStorefrontToFake(state);

    const report = await runMallDefaultDataInitialization();
    expect(report.ok).toBe(true);
    expect(report.profile).toBe("minimal");
    expect(state.products).toHaveLength(0);
    // Structure still exists, which is what the production profile promises.
    expect(state.categories.length).toBeGreaterThan(0);
    expect(state.shops.length).toBeGreaterThan(0);
  });
});
