import { describe, expect, it } from "vitest";

import { resolveDefaultDataset, zhCnDefaultDataset } from "./dataset";
import { previewMallDefaultDataInitialization, configureMallDefaultDataProvider } from "./default-data-service";
import {
  buildMallCategoryCreateBody,
  buildMallCmsConfigFromDataset,
  buildMallCmsPresetId,
  buildMallDefaultDataPlan,
  buildMallSkuCreateBody,
  buildMallSpuNo,
} from "./plan";
import { createFakeMallDefaultDataPort } from "../../tests/default-data-fake-port";
import { selectMallDefaultDataSlice } from "./profiles";

describe("mall default data plan", () => {
  it("orders steps by their dependency chain", () => {
    const plan = buildMallDefaultDataPlan(zhCnDefaultDataset, "demo");
    expect(plan.map((step) => step.id)).toEqual([
      "catalog.categories",
      "shops.stores",
      "catalog.products",
      "promotions.offers",
      "membership.plans",
      "membership.package-groups",
      "membership.packages",
      "cms.storefront",
    ]);
  });

  it("counts every authored entity", () => {
    const plan = buildMallDefaultDataPlan(zhCnDefaultDataset, "demo");
    const categoryStep = plan.find((step) => step.id === "catalog.categories");
    const productStep = plan.find((step) => step.id === "catalog.products");
    const expectedCategories = zhCnDefaultDataset.categories.reduce(
      (total, category) => total + 1 + category.children.length,
      0,
    );
    const expectedProductEntities =
      zhCnDefaultDataset.products.length +
      zhCnDefaultDataset.products.reduce((total, product) => total + product.skus.length, 0);
    expect(categoryStep?.entityCount).toBe(expectedCategories);
    expect(productStep?.entityCount).toBe(expectedProductEntities);
  });

  it("drops catalog and campaign steps for the production profile", () => {
    const slice = selectMallDefaultDataSlice(zhCnDefaultDataset, "minimal");
    const plan = buildMallDefaultDataPlan(slice, "minimal");
    expect(plan.map((step) => step.id)).toEqual([
      "catalog.categories",
      "shops.stores",
      "membership.plans",
      "membership.package-groups",
      "membership.packages",
      "cms.storefront",
    ]);
  });

  it("builds portable category and SKU commands", () => {
    const category = buildMallCategoryCreateBody({
      key: "phone",
      name: "智能手机",
      parentId: "cat-1",
      sortOrder: 10,
    });
    expect(category).toEqual({
      categoryNo: "MALL-CAT-PHONE",
      parentId: "cat-1",
      name: "智能手机",
      status: "active",
      sortOrder: "10",
    });

    const sku = buildMallSkuCreateBody({
      barcode: "6900000000001",
      currencyCode: "CNY",
      key: "aurora-x1-pro-256-obsidian",
      listPrice: "4699.00",
      price: "4299.00",
      productId: "spu-1",
      title: "12GB+256GB 曜石黑",
    });
    expect(sku.skuNo).toBe("MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN");
    expect(sku.defaultPriceAmount).toBe("4299.00");
    expect(sku.listPriceAmount).toBe("4699.00");
    expect(sku.productId).toBe("spu-1");
    expect(buildMallSpuNo("aurora-x1-pro")).toBe("MALL-SPU-AURORA-X1-PRO");
  });

  it("projects the CMS block into a sorted storefront preset", () => {
    const config = buildMallCmsConfigFromDataset(resolveDefaultDataset("en-US"), () => new Date("2026-01-02T03:04:05Z"));
    expect(config.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(config.banners).toHaveLength(zhCnDefaultDataset.cms.banners.length);
    expect(config.floors).toHaveLength(zhCnDefaultDataset.cms.floors.length);
    expect(config.hotKeywords).toHaveLength(zhCnDefaultDataset.cms.hotKeywords.length);
    expect(config.banners.map((banner) => banner.sortOrder)).toEqual(
      [...config.banners.map((banner) => banner.sortOrder)].sort((left, right) => left - right),
    );
    expect(config.banners.every((banner) => banner.enabled)).toBe(true);
    expect(config.banners[0]?.title).toBeTruthy();
    expect(buildMallCmsPresetId("zh-CN")).toBe("v1:zh-CN");
  });
});

describe("mall default data plan preview", () => {
  it("previews the active environment without writing", () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "staging", defaultLocale: "zh-CN" });
    const preview = previewMallDefaultDataInitialization();
    expect(preview.environment).toBe("staging");
    expect(preview.profile).toBe("standard");
    expect(preview.steps.length).toBeGreaterThan(0);
    expect(preview.totals.categories).toBeGreaterThan(0);
    expect(preview.totals.products).toBeGreaterThan(0);
    expect(preview.totals.cmsEntries).toBeGreaterThan(0);
  });

  it("honors an explicit profile override", () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "production", defaultLocale: "zh-CN" });
    const preview = previewMallDefaultDataInitialization({ profile: "demo" });
    expect(preview.profile).toBe("demo");
    const productionPreview = previewMallDefaultDataInitialization();
    expect(productionPreview.profile).toBe("minimal");
    expect(productionPreview.totals.products).toBe(0);
  });
});
