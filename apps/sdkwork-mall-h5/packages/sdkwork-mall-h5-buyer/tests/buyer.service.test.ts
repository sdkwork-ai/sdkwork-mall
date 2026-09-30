import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureSdkworkCommerceServiceProvider } from "@sdkwork/mall-commerce-service";

import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  resetCommerceServiceMockSession,
} from "../../../../sdkwork-mall-pc/tests/test-utils/commerce-service-mock";
import {
  createMallH5Address,
  deleteMallH5Address,
  listMallH5Addresses,
  setDefaultMallH5Address,
} from "../src/addresses-service";
import {
  claimMallH5Coupon,
  listMallH5ClaimableCoupons,
  listMallH5UserCoupons,
  redeemMallH5CouponCode,
} from "../src/coupons-service";

describe("sdkwork-mall-h5-buyer services", () => {
  beforeEach(() => {
    configureCommerceServiceMockSession({ authToken: "h5-buyer-auth-token" });
  });

  afterEach(() => {
    resetCommerceServiceMockSession();
    configureSdkworkCommerceServiceProvider(null);
  });

  function useCommerceMock(overrides: Parameters<typeof createCommerceServiceMock>[0]) {
    configureSdkworkCommerceServiceProvider(() => createCommerceServiceMock(overrides));
  }

  it("maps, creates, defaults, and deletes addresses through the commerce facade", async () => {
    const addressRecord = {
      addressLine: "杭州市西湖区测试路 1 号",
      id: "ADDR-1",
      isDefault: true,
      receiverName: "张三",
      receiverPhone: "13800000000",
    };
    useCommerceMock({
      addresses: {
        list: vi.fn().mockResolvedValue({ code: 0, data: { items: [addressRecord] } }),
        create: vi.fn().mockResolvedValue({ code: 0 }),
        delete: vi.fn().mockResolvedValue({ code: 0 }),
        defaultSelection: { create: vi.fn().mockResolvedValue({ code: 0 }) },
      },
    } as never);

    await expect(listMallH5Addresses()).resolves.toEqual([
      {
        addressLine: "杭州市西湖区测试路 1 号",
        id: "ADDR-1",
        isDefault: true,
        receiverName: "张三",
        receiverPhone: "13800000000",
      },
    ]);
    await expect(
      createMallH5Address({ addressLine: "杭州市西湖区测试路 2 号", receiverName: "李四", receiverPhone: "13900000000" }),
    ).resolves.toBeUndefined();
    await expect(setDefaultMallH5Address("ADDR-1")).resolves.toBeUndefined();
    await expect(deleteMallH5Address("ADDR-1")).resolves.toBeUndefined();
  });

  it("lists user coupons, claimable offers, claims, and redeems codes", async () => {
    useCommerceMock({
      promotions: {
        offers: {
          list: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              items: [
                { claimable: true, id: "OFFER-1", title: "新人券" },
                { id: "OFFER-2", title: "不可领" },
              ],
            },
          }),
        },
        userCoupons: {
          claims: { create: vi.fn().mockResolvedValue({ code: 0 }) },
          list: vi.fn().mockResolvedValue({
            code: 0,
            data: { items: [{ id: "UC-1", status: "available", title: "新人券" }] },
          }),
        },
        codes: { redemptions: { create: vi.fn().mockResolvedValue({ code: 0 }) } },
      },
    } as never);

    await expect(listMallH5UserCoupons()).resolves.toEqual([
      { id: "UC-1", status: "available", title: "新人券", validUntil: undefined },
    ]);
    await expect(listMallH5ClaimableCoupons()).resolves.toEqual([{ id: "OFFER-1", title: "新人券" }]);
    await expect(claimMallH5Coupon("OFFER-1")).resolves.toBeUndefined();
    await expect(redeemMallH5CouponCode("SAVE-2026")).resolves.toBeUndefined();
  });
});
