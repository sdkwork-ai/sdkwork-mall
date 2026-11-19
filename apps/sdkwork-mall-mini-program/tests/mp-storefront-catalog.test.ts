/**
 * Storefront catalogue projection contract.
 *
 * Regression: the generated app SDK unwraps the `{ code, data }` envelope, so the
 * home page received `{ items, pageInfo }` — not `{ data: { items } }`. The old
 * reader took `.data` off that payload, every shelf resolved empty, and the home
 * page rendered a blank storefront with no error. These cases mock the payload the
 * SDK really resolves to, so the home page cannot silently regress again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeMallMpRuntime, resetMallMpRuntime } from "@sdkwork/mall-mp-core";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";
import { getProductDetail, listCategories, listProducts } from "../src/services/catalog-service";

const ENVIRONMENT = {
  appApiBaseUrl: "https://api.test/app/v3/api",
  deploymentProfile: "standalone",
  environment: "development",
  profileId: "standalone.development",
} as const;

function boot() {
  resetMallMpRuntime();
  const host = createMemoryHost();
  const runtime = initializeMallMpRuntime({ environment: { ...ENVIRONMENT }, host });
  return { runtime };
}

function installCommerce(runtime: ReturnType<typeof boot>["runtime"], commerce: Record<string, unknown>) {
  (runtime as unknown as { commerceClient: Record<string, unknown> }).commerceClient = commerce;
}

describe("storefront catalogue projection", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("projects the unwrapped payload the SDK resolves to", async () => {
    const { runtime } = boot();
    const catalog = {
      categories: {
        list: vi.fn(async () => ({
          items: [
            { id: "1000", name: "数码影音", parentId: null },
            { id: "1001", name: "家用电器", parentId: null },
          ],
          pageInfo: { mode: "offset", page: 1, pageSize: 50, totalItems: 2, hasMore: false },
        })),
      },
      products: {
        list: vi.fn(async () => ({
          items: [
            { id: "p-1", title: "无线降噪耳机", priceCny: 199.5, imageUrl: "https://cdn.test/p-1.png", salesCount: 42 },
            { id: "p-2", title: "机械键盘", priceCny: 399, sales: 8 },
          ],
          pageInfo: { mode: "offset", page: 1, pageSize: 10, totalItems: 2, hasMore: false },
        })),
        retrieve: vi.fn(async () => ({
          id: "p-1",
          title: "无线降噪耳机",
          price: 199.5,
          mainImage: "https://cdn.test/p-1.png",
          images: ["https://cdn.test/p-1.png", "https://cdn.test/p-1-2.png"],
          shopId: "s-1",
          shopName: "官方旗舰店",
          skus: [{ id: "sku-1", title: "黑色", priceCny: 199.5, stock: 12 }],
          specs: [{ name: "颜色", value: "黑色" }],
        })),
      },
    };
    installCommerce(runtime, { catalog });

    const categories = await listCategories();
    const products = await listProducts({ page: 1, pageSize: 10, sort: "sales" });
    const detail = await getProductDetail("p-1");

    expect(categories).toHaveLength(2);
    expect(categories[0]).toEqual({ id: "1000", name: "数码影音", parentId: "" });
    expect(products.items).toHaveLength(2);
    expect(products.items[0]).toMatchObject({ id: "p-1", title: "无线降噪耳机", priceCny: 199.5, sales: 42 });
    expect(products.total).toBe(2);
    expect(products.hasMore).toBe(false);
    expect(detail).toMatchObject({ id: "p-1", shopName: "官方旗舰店" });
    expect(detail?.images).toEqual(["https://cdn.test/p-1.png", "https://cdn.test/p-1-2.png"]);
    expect(catalog.products.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10, sort: "sales" }),
    );
  });

  it("keeps accepting the verbatim envelope shape", async () => {
    const { runtime } = boot();
    const catalog = {
      categories: {
        list: vi.fn(async () => ({ code: 0, data: { items: [{ id: "1002", name: "图书" }] }, traceId: "t-1" })),
      },
      products: {
        list: vi.fn(async () => ({ code: 0, data: { items: [{ id: "p-9", title: "纸书", price: 59 }] }, traceId: "t-2" })),
        retrieve: vi.fn(),
      },
    };
    installCommerce(runtime, { catalog });

    const categories = await listCategories();
    const products = await listProducts();

    expect(categories[0]).toEqual({ id: "1002", name: "图书", parentId: "" });
    expect(products.items[0]).toMatchObject({ id: "p-9", priceCny: 59 });
  });

  it("surfaces a verbatim failure envelope as an error instead of an empty shelf", async () => {
    const { runtime } = boot();
    const catalog = {
      categories: {
        list: vi.fn(async () => ({ code: 40301, data: null, message: "没有权限" })),
      },
      products: { list: vi.fn(), retrieve: vi.fn() },
    };
    installCommerce(runtime, { catalog });

    await expect(listCategories()).rejects.toThrow("没有权限");
  });
});
