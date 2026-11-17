import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SdkworkBackendClient as SdkworkShopBackendClient } from "@sdkwork/shop-backend-sdk";

import { createSdkworkMallPcDefaultDataPort } from "./default-data-remote";

interface StubFederatedCommerce {
  shops: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
  promotions: {
    offers: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
  };
  memberships: {
    plans: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
    packageGroups: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
    packages: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
  };
}

interface StubShopCatalog {
  attributes: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
  attributeValues: { list: ReturnType<typeof vi.fn> };
  categories: {
    management: { list: ReturnType<typeof vi.fn> };
    retrieve: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  categoryAttributes: { list: ReturnType<typeof vi.fn> };
  media: { list: ReturnType<typeof vi.fn> };
  priceListItems: { list: ReturnType<typeof vi.fn> };
  priceLists: { list: ReturnType<typeof vi.fn> };
  products: {
    management: { list: ReturnType<typeof vi.fn> };
    retrieve: ReturnType<typeof vi.fn>;
    attributes: { update: ReturnType<typeof vi.fn> };
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
  };
  skus: {
    list: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

const publishCalls: unknown[][] = [];

function createStubShopCatalog(): StubShopCatalog {
  const list = () => vi.fn(async (_params: unknown) => ({ items: [], pageInfo: { mode: "offset" } }));
  const create = () => vi.fn(async (_body: unknown) => ({ id: "created-1", version: 4 }));

  return {
    attributes: { management: { list: list() }, create: create() },
    attributeValues: { list: list() },
    categories: {
      management: { list: list() },
      retrieve: vi.fn(async (_id: string) => ({ id: "created-1" })),
      create: create(),
      update: vi.fn(async (_id: string, _body: unknown, _version: number) => ({ id: "created-1" })),
      delete: vi.fn(async (_id: string, _version: number) => undefined),
    },
    categoryAttributes: { list: list() },
    media: { list: list() },
    priceListItems: { list: list() },
    priceLists: { list: list() },
    products: {
      management: { list: list() },
      retrieve: vi.fn(async (_id: string) => ({ id: "created-1" })),
      attributes: { update: vi.fn(async () => ({ id: "created-1" })) },
      create: create(),
      update: vi.fn(async (_id: string, _body: unknown, _version: number) => ({ id: "created-1" })),
      delete: vi.fn(async (_id: string, _version: number) => undefined),
      publish: vi.fn(async (productId: string, expectedVersion: number) => {
        publishCalls.push([productId, expectedVersion]);
        return { id: productId, version: expectedVersion + 1, status: "active" };
      }),
      archive: vi.fn(async (_id: string, _version: number) => ({ id: "created-1" })),
    },
    skus: {
      list: list(),
      retrieve: vi.fn(async (_id: string) => ({ id: "created-1" })),
      create: create(),
      update: vi.fn(async (_id: string, _body: unknown, _version: number) => ({ id: "created-1" })),
      delete: vi.fn(async (_id: string, _version: number) => undefined),
    },
  };
}

function createStubCommerce(): StubFederatedCommerce {
  // One required parameter mirrors the generated SDK method arity, which the
  // command-port adapter uses to decide whether to append idempotency params.
  const list = () => vi.fn(async (_params: unknown) => ({ data: { items: [] } }));
  const create = () => vi.fn(async (_body: unknown) => ({ data: { item: { id: "created-1" } } }));

  return {
    shops: { management: { list: list() }, create: create() },
    promotions: { offers: { management: { list: list() }, create: create() } },
    memberships: {
      plans: { management: { list: list() }, create: create() },
      packageGroups: { management: { list: list() }, create: create() },
      packages: { management: { list: list() }, create: create() },
    },
  };
}

describe("mall default data port adapter", () => {
  beforeEach(() => {
    publishCalls.length = 0;
    window.localStorage.clear();
  });

  it("returns null when the authority or the federated client is missing", () => {
    const commerce = createStubCommerce();
    const catalog = createStubShopCatalog();
    expect(createSdkworkMallPcDefaultDataPort({})).toBeNull();
    expect(createSdkworkMallPcDefaultDataPort({ shopBackendClient: { catalog: catalog as unknown as SdkworkShopBackendClient["catalog"] } })).toBeNull();
    expect(createSdkworkMallPcDefaultDataPort({ commerceBackendClient: { commerce } })).toBeNull();
  });

  it("maps catalog reads and writes onto the authority namespaces", async () => {
    const catalog = createStubShopCatalog();
    const port = createSdkworkMallPcDefaultDataPort({
      commerceBackendClient: { commerce: createStubCommerce() },
      shopBackendClient: { catalog: catalog as unknown as SdkworkShopBackendClient["catalog"] },
    });
    expect(port).not.toBeNull();

    await port?.catalog.listCategories();
    await port?.catalog.listProducts();
    await port?.catalog.listSkus();
    await port?.catalog.createCategory({ categoryNo: "MALL-CAT-DIGITAL" });
    await port?.catalog.createProduct({ productNo: "MALL-SPU-AURORA-X1-PRO" });
    await port?.catalog.createSku({ skuNo: "MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN" });
    await port?.catalog.publishProduct("spu-1", 4);

    expect(catalog.categories.management.list).toHaveBeenCalledWith({ page: 1, pageSize: 200 });
    expect(catalog.products.management.list).toHaveBeenCalledTimes(1);
    expect(catalog.skus.list).toHaveBeenCalledTimes(1);
    expect(catalog.categories.create).toHaveBeenCalledWith({ categoryNo: "MALL-CAT-DIGITAL" });
    expect(catalog.products.create).toHaveBeenCalledWith({ productNo: "MALL-SPU-AURORA-X1-PRO" });
    expect(catalog.skus.create).toHaveBeenCalledWith({
      skuNo: "MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN",
    });
    // Publishing is the authority `products.publish` command carrying the row
    // version as the generated transport's `ifMatch` precondition; no
    // idempotency body is injected.
    expect(publishCalls[0]?.[0]).toBe("spu-1");
    expect(publishCalls[0]?.[1]).toEqual({ ifMatch: "4" });
  });

  it("maps shop, promotion and membership operations onto the federated transport", async () => {
    const commerce = createStubCommerce();
    const port = createSdkworkMallPcDefaultDataPort({
      commerceBackendClient: { commerce },
      shopBackendClient: { catalog: createStubShopCatalog() as unknown as SdkworkShopBackendClient["catalog"] },
    });

    await port?.shops.listShops();
    await port?.shops.createShop({ shopName: "星野商城自营旗舰店" });
    await port?.promotions.listOffers();
    await port?.promotions.createOffer({ code: "MALL-SECKILL-DIGITAL" });
    await port?.memberships.listPlans();
    await port?.memberships.createPlan({ code: "MALL-MEMBER-GOLD" });
    await port?.memberships.listPackageGroups();
    await port?.memberships.createPackageGroup({ code: "MALL-MEMBER-YEARLY" });
    await port?.memberships.listPackages();
    await port?.memberships.createPackage({ code: "MALL-PKG-GOLD-YEARLY" });

    expect(commerce.shops.create).toHaveBeenCalledWith({ shopName: "星野商城自营旗舰店" });
    expect(commerce.promotions.offers.create).toHaveBeenCalledWith({ code: "MALL-SECKILL-DIGITAL" });
    expect(commerce.memberships.plans.create).toHaveBeenCalledWith({ code: "MALL-MEMBER-GOLD" });
    expect(commerce.memberships.packageGroups.create).toHaveBeenCalledWith({
      code: "MALL-MEMBER-YEARLY",
    });
    expect(commerce.memberships.packages.create).toHaveBeenCalledWith({
      code: "MALL-PKG-GOLD-YEARLY",
    });
  });

  it("walks every catalog page so idempotency lookups see the whole environment", async () => {
    const catalog = createStubShopCatalog();
    const rows = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `spu-${offset + index}`,
        productNo: `MALL-SPU-${offset + index}`,
      }));
    catalog.products.management.list = vi.fn(async (params: unknown) => {
      const page = (params as { page: number }).page;
      return {
        items: page === 1 ? rows(200, 0) : page === 2 ? rows(150, 200) : [],
        pageInfo: { mode: "offset" },
      };
    });

    const port = createSdkworkMallPcDefaultDataPort({
      commerceBackendClient: { commerce: createStubCommerce() },
      shopBackendClient: { catalog: catalog as unknown as SdkworkShopBackendClient["catalog"] },
    });
    expect(port).not.toBeNull();

    const result = (await port?.catalog.listProducts()) as { items: unknown[] };

    expect(result.items).toHaveLength(350);
    expect(catalog.products.management.list).toHaveBeenCalledTimes(2);
    expect(catalog.products.management.list).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 200 });
    expect(catalog.products.management.list).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 200 });
  });

  it("tracks the CMS preset marker through local storage", () => {
    const port = createSdkworkMallPcDefaultDataPort({
      commerceBackendClient: { commerce: createStubCommerce() },
      shopBackendClient: { catalog: createStubShopCatalog() as unknown as SdkworkShopBackendClient["catalog"] },
    });
    expect(port?.cms.readAppliedPreset()).toBeNull();

    port?.cms.markAppliedPreset("v1:zh-CN");
    expect(port?.cms.readAppliedPreset()).toBe("v1:zh-CN");

    const config = port?.cms.read();
    expect(config?.banners.length).toBeGreaterThan(0);
    if (!port || !config) {
      throw new Error("port or CMS config missing");
    }
    port.cms.write({ ...config, updatedAt: "2026-01-01T00:00:00.000Z" });
    port.cms.markAppliedPreset("v1:en-US");
    expect(port.cms.readAppliedPreset()).toBe("v1:en-US");
  });
});
