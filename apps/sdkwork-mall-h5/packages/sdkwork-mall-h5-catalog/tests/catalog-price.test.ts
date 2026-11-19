import { afterEach, describe, expect, it } from "vitest";

import { configureSdkworkCommerceServiceProvider } from "@sdkwork/mall-commerce-service";

import {
  retrieveMallH5ProductDetail,
  searchMallH5Products,
} from "../src/catalog-service";

/**
 * The catalog read model publishes canonical money as `salePriceMinor` plus
 * `minorUnitExponent` (both decimal strings). A card that reads only the legacy
 * decimal `priceCny` shows “询价” against the real backend, so this test pins
 * the conversion and the legacy fallback.
 */
function installFakeCommerce(payload: Record<string, unknown>) {
  configureSdkworkCommerceServiceProvider(
    () =>
      ({
        catalog: {
          products: {
            list: async () => ({ code: 0, data: payload }),
            retrieve: async () => ({ code: 0, data: payload }),
          },
        },
      }) as never,
  );
}

afterEach(() => {
  configureSdkworkCommerceServiceProvider(null);
});

describe("H5 catalog prices", () => {
  it("converts the canonical minor-unit price and totalItems", async () => {
    installFakeCommerce({
      items: [
        {
          id: "spu-1",
          name: "手机",
          brandName: "PolarDay",
          imageUrl: "https://cdn.example/phone.png",
          salePriceMinor: "625190",
          minorUnitExponent: "2",
        },
      ],
      pageInfo: { totalItems: "1" },
    });

    const page = await searchMallH5Products({});

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: "spu-1",
      brand: "PolarDay",
      imageUrl: "https://cdn.example/phone.png",
      priceCny: 6251.9,
      title: "手机",
    });
  });

  it("falls back to the legacy decimal price when minor fields are absent", async () => {
    installFakeCommerce({
      items: [{ id: "spu-2", name: "耳机", priceCny: 3999 }],
      pageInfo: { total: 1 },
    });

    const page = await searchMallH5Products({});

    expect(page.items[0]?.priceCny).toBe(3999);
  });

  it("converts product and SKU prices in the detail read", async () => {
    installFakeCommerce({
      id: "spu-1",
      title: "手机",
      salePriceMinor: "100",
      minorUnitExponent: "2",
      skus: [
        { id: "sku-1", salePriceMinor: "625190", minorUnitExponent: "2" },
      ],
    });

    const detail = await retrieveMallH5ProductDetail("spu-1");

    expect(detail?.priceCny).toBe(1);
    expect(detail?.skus[0]).toMatchObject({ id: "sku-1", priceCny: 6251.9 });
  });
});
