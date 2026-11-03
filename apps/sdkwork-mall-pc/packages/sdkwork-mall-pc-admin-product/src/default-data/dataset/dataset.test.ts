import { describe, expect, it } from "vitest";

import {
  MALL_DEFAULT_DATA_LOCALES,
  enUsDefaultOverlay,
  resolveDefaultDataset,
  validateDefaultDataset,
  zhCnDefaultDataset,
} from "./index";
import {
  resolveMallDefaultDataProfile,
  selectMallDefaultDataSlice,
} from "../profiles";

describe("mall default dataset", () => {
  it("accepts the authored dataset", () => {
    const validation = validateDefaultDataset(zhCnDefaultDataset);
    expect(validation.problems).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("authors a complete, professional mall surface", () => {
    const dataset = zhCnDefaultDataset;
    expect(dataset.categories.length).toBeGreaterThanOrEqual(8);
    expect(dataset.shops.length).toBeGreaterThanOrEqual(6);
    expect(dataset.products.length).toBeGreaterThanOrEqual(20);
    expect(dataset.offers.length).toBeGreaterThanOrEqual(4);
    expect(dataset.membership.plans.length).toBeGreaterThanOrEqual(3);
    expect(dataset.membership.packageGroups.length).toBeGreaterThanOrEqual(2);
    expect(dataset.membership.packages.length).toBeGreaterThanOrEqual(3);
    expect(dataset.cms.banners.length).toBeGreaterThanOrEqual(5);
    expect(dataset.cms.floors.length).toBeGreaterThanOrEqual(6);
    expect(dataset.cms.hotKeywords.length).toBeGreaterThanOrEqual(6);

    for (const product of dataset.products) {
      expect(product.skus.length).toBeGreaterThanOrEqual(1);
      expect(product.description.length).toBeGreaterThan(40);
      expect(product.keywords.length).toBeGreaterThanOrEqual(2);
    }
    for (const category of dataset.categories) {
      expect(category.children.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("rejects duplicate natural keys", () => {
    const broken = {
      ...zhCnDefaultDataset,
      categories: [
        ...zhCnDefaultDataset.categories,
        zhCnDefaultDataset.categories[0],
      ],
    };
    const validation = validateDefaultDataset(broken);
    expect(validation.valid).toBe(false);
    expect(validation.problems.some((problem) => problem.message.includes("duplicate category key"))).toBe(true);
  });

  it("rejects a sale price above the list price", () => {
    const product = zhCnDefaultDataset.products[0];
    const broken = {
      ...zhCnDefaultDataset,
      products: [
        {
          ...product,
          skus: [{ ...product.skus[0], price: "9999.00", listPrice: "1.00" }],
        },
        ...zhCnDefaultDataset.products.slice(1),
      ],
    };
    const validation = validateDefaultDataset(broken);
    expect(validation.valid).toBe(false);
    expect(validation.problems.some((problem) => problem.path.endsWith(".price"))).toBe(true);
  });

  it("rejects malformed amounts and barcodes", () => {
    const product = zhCnDefaultDataset.products[0];
    const broken = {
      ...zhCnDefaultDataset,
      products: [
        {
          ...product,
          skus: [{ ...product.skus[0], price: "12.5", barcode: "123" }],
        },
        ...zhCnDefaultDataset.products.slice(1),
      ],
    };
    const validation = validateDefaultDataset(broken);
    expect(validation.valid).toBe(false);
    expect(validation.problems.map((problem) => problem.path)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(".price"),
        expect.stringContaining(".barcode"),
      ]),
    );
  });

  it("translates every authored entity into the secondary locale", () => {
    const overlay = enUsDefaultOverlay;
    const missing: string[] = [];

    for (const category of zhCnDefaultDataset.categories) {
      if (!overlay.categories[category.key]) missing.push(`category:${category.key}`);
      for (const child of category.children) {
        if (!overlay.categories[child.key]) missing.push(`category:${child.key}`);
      }
    }
    for (const shop of zhCnDefaultDataset.shops) {
      if (!overlay.shops[shop.key]?.name) missing.push(`shop:${shop.key}.name`);
      if (!overlay.shops[shop.key]?.description) missing.push(`shop:${shop.key}.description`);
    }
    for (const product of zhCnDefaultDataset.products) {
      if (!overlay.products[product.key]?.title) missing.push(`product:${product.key}.title`);
      if (!overlay.products[product.key]?.subtitle) missing.push(`product:${product.key}.subtitle`);
      if (!overlay.products[product.key]?.description) missing.push(`product:${product.key}.description`);
      for (const sku of product.skus) {
        if (!overlay.products[product.key]?.skus?.[sku.key]) missing.push(`sku:${sku.key}`);
      }
    }
    for (const offer of zhCnDefaultDataset.offers) {
      if (!overlay.offers[offer.key]?.title) missing.push(`offer:${offer.key}.title`);
      if (!overlay.offers[offer.key]?.description) missing.push(`offer:${offer.key}.description`);
    }
    for (const plan of zhCnDefaultDataset.membership.plans) {
      if (!overlay.membership.plans[plan.key]?.name) missing.push(`plan:${plan.key}.name`);
      if (!overlay.membership.plans[plan.key]?.benefits?.length) missing.push(`plan:${plan.key}.benefits`);
    }
    for (const group of zhCnDefaultDataset.membership.packageGroups) {
      if (!overlay.membership.packageGroups[group.key]?.name) missing.push(`group:${group.key}.name`);
      if (!overlay.membership.packageGroups[group.key]?.description) missing.push(`group:${group.key}.description`);
    }
    for (const entry of zhCnDefaultDataset.membership.packages) {
      if (!overlay.membership.packages[entry.key]?.name) missing.push(`package:${entry.key}.name`);
    }
    for (const banner of zhCnDefaultDataset.cms.banners) {
      if (!overlay.cms.banners[banner.key]?.title) missing.push(`banner:${banner.key}.title`);
      if (!overlay.cms.banners[banner.key]?.subtitle) missing.push(`banner:${banner.key}.subtitle`);
    }
    for (const floor of zhCnDefaultDataset.cms.floors) {
      if (!overlay.cms.floors[floor.key]) missing.push(`floor:${floor.key}`);
    }
    for (const keyword of zhCnDefaultDataset.cms.hotKeywords) {
      if (!overlay.cms.hotKeywords[keyword.key]) missing.push(`keyword:${keyword.key}`);
    }

    expect(missing).toEqual([]);
  });

  it("keeps stable identities across locales", () => {
    const zh = resolveDefaultDataset("zh-CN");
    const en = resolveDefaultDataset("en-US");
    expect(en.locale).toBe("en-US");
    expect(en.products.map((product) => product.key)).toEqual(
      zh.products.map((product) => product.key),
    );
    expect(en.products[0]?.title).not.toBe(zh.products[0]?.title);
    expect(en.products[0]?.skus[0]?.barcode).toBe(zh.products[0]?.skus[0]?.barcode);
  });

  it("serves every locale in the supported list", () => {
    for (const locale of MALL_DEFAULT_DATA_LOCALES) {
      const dataset = resolveDefaultDataset(locale);
      expect(dataset.locale).toBe(locale);
      expect(dataset.products.length).toBe(zhCnDefaultDataset.products.length);
    }
  });
});

describe("mall default data profiles", () => {
  it("maps every environment to a profile", () => {
    expect(resolveMallDefaultDataProfile("development")).toBe("demo");
    expect(resolveMallDefaultDataProfile("demo")).toBe("demo");
    expect(resolveMallDefaultDataProfile("test")).toBe("standard");
    expect(resolveMallDefaultDataProfile("staging")).toBe("standard");
    expect(resolveMallDefaultDataProfile("production")).toBe("minimal");
    expect(resolveMallDefaultDataProfile("production", "demo")).toBe("demo");
  });

  it("keeps production to platform reference data", () => {
    const slice = selectMallDefaultDataSlice(zhCnDefaultDataset, "minimal");
    expect(slice.products).toEqual([]);
    expect(slice.offers).toEqual([]);
    expect(slice.shops.every((shop) => shop.businessModel === "self-operated")).toBe(true);
    expect(slice.categories.length).toBe(zhCnDefaultDataset.categories.length);
    expect(slice.membership.plans.length).toBe(zhCnDefaultDataset.membership.plans.length);
  });

  it("excludes demo-only entries from the standard profile only", () => {
    const standard = selectMallDefaultDataSlice(zhCnDefaultDataset, "standard");
    const demo = selectMallDefaultDataSlice(zhCnDefaultDataset, "demo");
    expect(standard.products.length).toBeLessThan(demo.products.length);
    expect(standard.products.every((product) => !product.demoOnly)).toBe(true);
    expect(standard.offers.every((offer) => !offer.demoOnly)).toBe(true);
    expect(demo.products.some((product) => product.demoOnly)).toBe(true);
  });

  it("never changes entity identity across profiles", () => {
    const keysFor = (profile: "minimal" | "standard" | "demo") =>
      selectMallDefaultDataSlice(zhCnDefaultDataset, profile).products.map((product) => product.key);
    const demoKeys = keysFor("demo");
    for (const key of keysFor("standard")) {
      expect(demoKeys).toContain(key);
    }
  });
});
