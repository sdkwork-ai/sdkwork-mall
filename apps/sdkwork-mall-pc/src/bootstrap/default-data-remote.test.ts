import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSdkworkMallPcDefaultDataPort } from "./default-data-remote";

interface StubCommerce {
  catalog: {
    categories: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
    products: { management: { list: ReturnType<typeof vi.fn> }; create: ReturnType<typeof vi.fn> };
    spus: { publish: ReturnType<typeof vi.fn> };
    skus: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
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

const publishCalls: unknown[][] = [];

function createStubCommerce(): StubCommerce {
  // One required parameter mirrors the generated SDK method arity, which the
  // command-port adapter uses to decide whether to append idempotency params.
  const list = () => vi.fn(async (_params: unknown) => ({ data: { items: [] } }));
  const create = () => vi.fn(async (_body: unknown) => ({ data: { item: { id: "created-1" } } }));

  return {
    catalog: {
      categories: { management: { list: list() }, create: create() },
      products: { management: { list: list() }, create: create() },
      spus: {
        publish: vi.fn(async (_spuId: string, body: unknown, params: unknown) => {
          publishCalls.push([_spuId, body, params]);
          return { data: { item: { id: "spu-1" } } };
        }),
      },
      skus: { list: list(), create: create() },
    },
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
    window.localStorage.clear();
  });

  it("returns null when no backend API is configured", () => {
    expect(createSdkworkMallPcDefaultDataPort({})).toBeNull();
  });

  it("maps catalog reads and writes onto the commerce namespaces", async () => {
    const commerce = createStubCommerce();
    const port = createSdkworkMallPcDefaultDataPort({ commerceBackendClient: { commerce } });
    expect(port).not.toBeNull();

    await port?.catalog.listCategories();
    await port?.catalog.listProducts();
    await port?.catalog.listSkus();
    await port?.catalog.createCategory({ categoryNo: "MALL-CAT-DIGITAL" });
    await port?.catalog.createProduct({ spuNo: "MALL-SPU-AURORA-X1-PRO" });
    await port?.catalog.createSku({ skuNo: "MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN" });
    await port?.catalog.publishProduct("spu-1");

    expect(commerce.catalog.categories.management.list).toHaveBeenCalledWith({ page: 1, pageSize: 200 });
    expect(commerce.catalog.products.management.list).toHaveBeenCalledTimes(1);
    expect(commerce.catalog.skus.list).toHaveBeenCalledTimes(1);
    expect(commerce.catalog.categories.create).toHaveBeenCalledWith({ categoryNo: "MALL-CAT-DIGITAL" });
    expect(commerce.catalog.products.create).toHaveBeenCalledWith({ spuNo: "MALL-SPU-AURORA-X1-PRO" });
    expect(commerce.catalog.skus.create).toHaveBeenCalledWith({
      skuNo: "MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN",
    });
    expect(publishCalls[0]?.[0]).toBe("spu-1");
    expect(publishCalls[0]?.[2]).toMatchObject({ idempotencyKey: expect.any(String) });
  });

  it("maps shop, promotion and membership operations", async () => {
    const commerce = createStubCommerce();
    const port = createSdkworkMallPcDefaultDataPort({ commerceBackendClient: { commerce } });

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

  it("tracks the CMS preset marker through local storage", () => {
    const commerce = createStubCommerce();
    const port = createSdkworkMallPcDefaultDataPort({ commerceBackendClient: { commerce } });
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
