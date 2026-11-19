import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadMallProductDetail,
  retrieveMallCategory,
} from "../src/catalog-service";
import { configureSdkworkCatalogRemotePort } from "../src/catalog-remote-port";

function configureRetrieveSpu(response: unknown): void {
  configureSdkworkCatalogRemotePort({
    createCartItem: vi.fn(async () => ({})),
    updateCartItem: vi.fn(async () => ({})),
    listPromotionOffers: vi.fn(async () => ({})),
    retrieveCategory: vi.fn(async () => ({})),
    retrieveSpu: vi.fn(async () => response),
  });
}

afterEach(() => {
  configureSdkworkCatalogRemotePort(null);
});

describe("loadMallProductDetail", () => {
  it("unwraps the v3 `data.item` resource envelope", async () => {
    // The authority answers `{ code, data: { item }, traceId }`; reading fields
    // off the wrapper is what emptied the PDP (title 商品, price 询价, no SKUs).
    configureRetrieveSpu({
      code: 0,
      data: {
        item: {
          id: "spu-1",
          name: "AURORA X1 Pro",
          categoryId: "cat-phone",
          title: "AURORA X1 Pro 旗舰手机",
          subtitle: "影像旗舰",
          description: "一英寸大底",
          brandName: "PolarDay",
          attributes: [
            {
              attributeId: "8",
              attributeNo: "storage",
              attributeName: "存储容量",
              displayValue: "12GB+256GB",
            },
            {
              attributeId: "9",
              attributeNo: "color",
              attributeName: "配色",
              displayValue: "曜石黑",
            },
          ],
          media: [{ id: "media-1", resourceSnapshot: { url: "https://cdn.example/x1.png" } }],
          skus: [
            {
              id: "sku-1",
              name: "12GB+256GB 曜石黑",
              currencyCode: "CNY",
              minorUnitExponent: "2",
              salePriceMinor: "625190",
              listPriceMinor: "705600",
              stock: 7,
              attributeValues: [
                {
                  attributeId: "8",
                  attributeNo: "storage",
                  attributeValueId: "8001",
                  valueCode: "256",
                  displayValue: "12GB+256GB",
                },
                {
                  attributeId: "9",
                  attributeNo: "color",
                  attributeValueId: "9001",
                  valueCode: "obsidian",
                  displayValue: "曜石黑",
                },
              ],
            },
            {
              id: "sku-2",
              name: "16GB+512GB 白云",
              minorUnitExponent: "2",
              salePriceMinor: "0",
              attributeValues: [
                {
                  attributeId: "8",
                  attributeNo: "storage",
                  attributeValueId: "8002",
                  valueCode: "512",
                  displayValue: "16GB+512GB",
                },
              ],
            },
          ],
        },
      },
      traceId: "trace-1",
    });

    const detail = await loadMallProductDetail("spu-1");

    expect(detail.id).toBe("spu-1");
    expect(detail.categoryId).toBe("cat-phone");
    expect(detail.title).toBe("AURORA X1 Pro 旗舰手机");
    expect(detail.subtitle).toBe("影像旗舰");
    expect(detail.description).toBe("一英寸大底");
    expect(detail.brand).toBe("PolarDay");
    expect(detail.priceCny).toBe(6251.9);
    expect(detail.listPriceCny).toBe(7056);
    expect(detail.images).toEqual(["https://cdn.example/x1.png"]);
    expect(detail.specifications).toEqual([
      { label: "存储容量", value: "12GB+256GB" },
      { label: "配色", value: "曜石黑" },
    ]);
    expect(detail.attributeLabels["id:8"]).toBe("存储容量");
    expect(detail.attributeLabels["no:color"]).toBe("配色");

    expect(detail.skus).toHaveLength(2);
    expect(detail.skus[0]).toMatchObject({
      id: "sku-1",
      name: "12GB+256GB 曜石黑",
      priceCny: 6251.9,
      listPriceCny: 7056,
      stock: 7,
    });
    expect(detail.skus[0]?.attributes).toEqual([
      {
        axisKey: "id:8",
        attributeId: "8",
        attributeNo: "storage",
        valueId: "8001",
        valueCode: "256",
        valueLabel: "12GB+256GB",
      },
      {
        axisKey: "id:9",
        attributeId: "9",
        attributeNo: "color",
        valueId: "9001",
        valueCode: "obsidian",
        valueLabel: "曜石黑",
      },
    ]);
    // A zero sale price is a real price (`0`), not "missing".
    expect(detail.skus[1]?.priceCny).toBe(0);
  });

  it("still accepts a flat resource body from the dev double", async () => {
    configureRetrieveSpu({
      data: {
        id: "spu-2",
        title: "SDKWork Phone X1",
        priceCny: 3999,
        imageUrl: "https://cdn.example/phone.png",
        skus: [
          { id: "sku-black", title: "曜石黑", priceCny: 3999, stock: 50 },
          { id: "sku-white", title: "皓月白", priceCny: 4099, stock: 0 },
        ],
      },
    });

    const detail = await loadMallProductDetail("spu-2");

    expect(detail.title).toBe("SDKWork Phone X1");
    expect(detail.priceCny).toBe(3999);
    expect(detail.images).toEqual(["https://cdn.example/phone.png"]);
    expect(detail.skus.map((sku) => sku.name)).toEqual(["曜石黑", "皓月白"]);
    // No axis rows: the page degrades to a flat SKU picker instead of inventing
    // specification groups.
    expect(detail.skus[0]?.attributes).toEqual([]);
    expect(detail.specifications).toEqual([]);
  });

  it("keeps a product with no SKU payload readable and honestly empty", async () => {
    configureRetrieveSpu({
      code: 0,
      data: { item: { id: "spu-3", name: "只有商品主数据", status: "active" } },
      traceId: "trace-3",
    });

    const detail = await loadMallProductDetail("spu-3");

    expect(detail.title).toBe("只有商品主数据");
    expect(detail.skus).toEqual([]);
    expect(detail.priceCny).toBeNull();
  });
});

describe("retrieveMallCategory", () => {
  it("unwraps the category resource envelope", async () => {
    configureSdkworkCatalogRemotePort({
      createCartItem: vi.fn(async () => ({})),
      updateCartItem: vi.fn(async () => ({})),
      listPromotionOffers: vi.fn(async () => ({})),
      retrieveCategory: vi.fn(async () => ({
        code: 0,
        data: { item: { id: "cat-1", name: "手机数码" } },
        traceId: "trace-2",
      })),
      retrieveSpu: vi.fn(async () => ({})),
    });

    await expect(retrieveMallCategory("cat-1")).resolves.toEqual({
      id: "cat-1",
      name: "手机数码",
    });
  });
});
