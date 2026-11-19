import { afterEach, describe, expect, it, vi } from "vitest";

import { configureSdkworkSearchRemotePort } from "../src/search-remote-port";
import { searchMallProducts, searchMallShops } from "../src/search-service";

function configurePort(overrides: Partial<{
  listProducts: (query: Record<string, unknown>) => Promise<unknown>;
  listSpus: (query: Record<string, unknown>) => Promise<unknown>;
  listShops: (query: Record<string, unknown>) => Promise<unknown>;
}> = {}) {
  const listProducts = vi.fn(overrides.listProducts ?? (async () => ({ data: { items: [] } })));
  const listSpus = vi.fn(overrides.listSpus ?? (async () => ({ data: { items: [] } })));
  const listShops = vi.fn(overrides.listShops ?? (async () => ({ data: { items: [] } })));
  configureSdkworkSearchRemotePort({
    listCategories: vi.fn(async () => ({ data: { items: [] } })),
    listProducts,
    listSpus,
    listShops,
  });
  return { listProducts, listSpus, listShops };
}

afterEach(() => {
  configureSdkworkSearchRemotePort(null);
});

describe("searchMallProducts", () => {
  it("reads the v3 page total from pageInfo.totalItems (int64 string)", async () => {
    const { listSpus } = configurePort({
      listSpus: async () => ({
        code: 0,
        data: {
          items: [
            {
              id: "spu-1",
              title: "AURORA X1",
              salePrice: "4299.00",
              imageUrl: "https://cdn.example/x1.png",
            },
          ],
          pageInfo: {
            mode: "offset",
            page: 1,
            pageSize: 20,
            totalItems: "437",
            totalPages: 22,
            hasMore: true,
          },
        },
        traceId: "trace-1",
      }),
    });

    const result = await searchMallProducts({ page: 1, pageSize: 20, sort: "price-asc" });

    // Regression: reading only `payload.total` collapsed the total to the
    // current page length, so every storefront list rendered one page.
    expect(result.total).toBe(437);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "spu-1",
      priceCny: 4299,
      imageUrl: "https://cdn.example/x1.png",
    });
    expect(listSpus).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, sort: "price-asc" }),
    );
  });

  it("accepts the dev double's pageInfo.total and shop-scoped catalog reads", async () => {
    const { listProducts } = configurePort({
      listProducts: async () => ({
        code: 0,
        data: {
          items: [
            {
              id: "spu-2",
              title: "Book 14",
              minorUnitExponent: "2",
              salePriceMinor: "549900",
            },
          ],
          pageInfo: { page: 1, total: 12 },
        },
      }),
    });

    const result = await searchMallProducts({ shopId: "shop-1", page: 1, pageSize: 24 });

    expect(result.total).toBe(12);
    // 549900 minor units at exponent 2 -> 5499.00
    expect(result.items[0]?.priceCny).toBe(5499);
    expect(listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "shop-1", page: 1, pageSize: 24 }),
    );
  });

  it("falls back to the loaded row count when no page info is published", async () => {
    configurePort({
      listSpus: async () => ({ data: { items: [{ id: "a" }, { id: "b" }] } }),
    });

    await expect(searchMallProducts({})).resolves.toMatchObject({ total: 2 });
  });
});

describe("searchMallShops", () => {
  it("reads the canonical total and tolerates a missing one", async () => {
    configurePort({
      listShops: async () => ({
        data: {
          items: [{ id: "shop-1", shopName: "自营旗舰店" }],
          pageInfo: { totalItems: "9" },
        },
      }),
    });

    await expect(searchMallShops({ query: "自营" })).resolves.toMatchObject({
      total: 9,
      items: [{ id: "shop-1", name: "自营旗舰店" }],
    });
  });
});
