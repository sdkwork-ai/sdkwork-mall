import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureSdkworkHomeRemotePort,
  type SdkworkHomeRemotePort,
} from "../src/home-remote-port";
import {
  loadMallHomeSnapshot,
  MallHomeUnavailableError,
} from "../src/home-service";

type Section = "categories" | "shops" | "spus";

function createPort(handlers: Partial<Record<Section, () => Promise<unknown>>>): SdkworkHomeRemotePort {
  const fallback = () => Promise.resolve({ items: [] });
  return {
    listCategories: handlers.categories ?? fallback,
    listShops: handlers.shops ?? fallback,
    listSpus: handlers.spus ?? fallback,
  };
}

function rejectWith(message: string): () => Promise<unknown> {
  return () => Promise.reject(new Error(message));
}

afterEach(() => {
  configureSdkworkHomeRemotePort(null);
  vi.restoreAllMocks();
});

describe("loadMallHomeSnapshot", () => {
  it("reports an empty catalog as empty rather than failing", async () => {
    configureSdkworkHomeRemotePort(createPort({}));

    const snapshot = await loadMallHomeSnapshot();

    expect(snapshot.isEmpty).toBe(true);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.categories).toEqual([]);
    expect(snapshot.hotProducts).toEqual([]);
    expect(snapshot.newProducts).toEqual([]);
    expect(snapshot.featuredShops).toEqual([]);
  });

  it("throws when every section read fails so an outage is not shown as an empty mall", async () => {
    configureSdkworkHomeRemotePort(
      createPort({
        categories: rejectWith("connect ECONNREFUSED"),
        shops: rejectWith("connect ECONNREFUSED"),
        spus: rejectWith("connect ECONNREFUSED"),
      }),
    );

    await expect(loadMallHomeSnapshot()).rejects.toBeInstanceOf(MallHomeUnavailableError);
  });

  it("keeps working sections and records the failed ones", async () => {
    configureSdkworkHomeRemotePort(
      createPort({
        categories: () =>
          Promise.resolve({
            items: [{ id: "cat-1", name: "手机数码" }],
          }),
        shops: rejectWith("shops unavailable"),
        spus: rejectWith("spus unavailable"),
      }),
    );

    const snapshot = await loadMallHomeSnapshot();

    expect(snapshot.isEmpty).toBe(false);
    expect(snapshot.categories).toEqual([{ id: "cat-1", name: "手机数码" }]);
    expect(snapshot.issues.length).toBeGreaterThan(0);
    expect(snapshot.issues.every((issue) => issue.section !== "categories")).toBe(true);
  });

  it("treats a non-zero business envelope as a section failure", async () => {
    configureSdkworkHomeRemotePort(
      createPort({
        categories: () => Promise.resolve({ code: 40001, message: "invalid token" }),
        shops: () => Promise.resolve({ code: 40001, message: "invalid token" }),
        spus: () => Promise.resolve({ code: 40001, message: "invalid token" }),
      }),
    );

    await expect(loadMallHomeSnapshot()).rejects.toMatchObject({
      name: "MallHomeUnavailableError",
    });
  });

  it("unwraps the success envelope and maps product cards", async () => {
    configureSdkworkHomeRemotePort(
      createPort({
        categories: () => Promise.resolve({ code: 0, data: { items: [{ id: "cat-1", name: "数码" }] } }),
        shops: () => Promise.resolve({ code: 0, data: { items: [{ id: "shop-1", name: "自营旗舰店" }] } }),
        spus: () =>
          Promise.resolve({
            code: 0,
            data: {
              items: [
                {
                  id: "spu-1",
                  title: "星野 X1 Pro",
                  minorUnitExponent: "2",
                  salePriceMinor: "429900",
                  listPriceMinor: "469900",
                  imageUrl: "https://cdn.example.com/p.png",
                },
              ],
            },
          }),
      }),
    );

    const snapshot = await loadMallHomeSnapshot();

    expect(snapshot.isEmpty).toBe(false);
    expect(snapshot.newProducts[0]).toMatchObject({
      id: "spu-1",
      priceCny: 4299,
      listPriceCny: 4699,
      title: "星野 X1 Pro",
    });
    expect(snapshot.featuredShops[0]).toMatchObject({ id: "shop-1", name: "自营旗舰店" });
  });

  it("reads the product shelf once and splits it into new and curated shelves", async () => {
    const listSpus = vi.fn(async () => ({
      data: {
        items: Array.from({ length: 12 }, (_, index) => ({
          id: `spu-${index + 1}`,
          title: `商品 ${index + 1}`,
        })),
      },
    }));
    configureSdkworkHomeRemotePort({
      listCategories: async () => ({ items: [] }),
      listShops: async () => ({ items: [] }),
      listSpus,
    });

    const snapshot = await loadMallHomeSnapshot();

    // The catalog cannot sort by sales/rating, so two sorted reads produced the
    // same products. One read feeds both shelves without duplication.
    expect(listSpus).toHaveBeenCalledTimes(1);
    expect(listSpus).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 16, sort: "newest" }),
    );
    expect(snapshot.newProducts.map((product) => product.id)).toEqual([
      "spu-1",
      "spu-2",
      "spu-3",
      "spu-4",
      "spu-5",
      "spu-6",
      "spu-7",
      "spu-8",
    ]);
    expect(snapshot.hotProducts.map((product) => product.id)).toEqual([
      "spu-9",
      "spu-10",
      "spu-11",
      "spu-12",
    ]);
  });
});
