import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureSdkworkCommerceServiceProvider,
  type SdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import {
  configureSdkworkOrderAppServiceProvider,
  configureSdkworkOrderSessionTokenProvider,
} from "@sdkwork/order-service";

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
  cancelMallH5AfterSalesRequest,
  createMallH5AfterSalesRequest,
  listMallH5AfterSalesRequests,
  loadMallH5AfterSalesOrderContext,
} from "../src/aftersales-service";
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
    configureSdkworkCommerceServiceProvider(
      (): SdkworkCommerceService => createCommerceServiceMock(overrides) as SdkworkCommerceService,
    );
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

  it("loads the after-sales order context from the order service", async () => {
    configureSdkworkOrderSessionTokenProvider(() => ({ authToken: "auth-token" }));
    configureSdkworkOrderAppServiceProvider(() => ({
      orders: {
        retrieve: vi.fn().mockResolvedValue({
          code: 0,
          data: {
            orderId: "ORDER-1",
            paidAmount: "88.50",
            status: "PAID",
            totalAmount: 90,
            items: [
              { id: "oi-1", priceCny: 44.25, quantity: 2, spu: { title: "SDKWork Phone X1" } },
            ],
          },
        }),
      },
    } as never));

    await expect(loadMallH5AfterSalesOrderContext("ORDER-1")).resolves.toEqual({
      items: [{ orderItemId: "oi-1", priceCny: 44.25, quantity: 2, title: "SDKWork Phone X1" }],
      orderId: "ORDER-1",
      paidAmountCny: 88.5,
      status: "PAID",
      totalAmountCny: 90,
    });
    configureSdkworkOrderAppServiceProvider(null);
  });

  it("creates after-sales requests with the wire-contract body and cancels them", async () => {
    configureSdkworkOrderSessionTokenProvider(() => ({ authToken: "auth-token" }));
    const createSpy = vi.fn().mockResolvedValue({ code: 0, data: { id: "AS-1" } });
    const updateSpy = vi.fn().mockResolvedValue({ code: 0 });
    const listSpy = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [
          {
            afterSalesNo: "AS100001",
            afterSalesType: "refund",
            createdAt: "2026-10-03T00:00:00Z",
            id: "AS-1",
            orderId: "ORDER-1",
            reasonCode: "quality-issue",
            requestedAmount: "88.50",
            status: "PENDING",
          },
        ],
      },
    });
    useCommerceMock({
      afterSales: {
        requests: { list: listSpy, create: createSpy, update: updateSpy },
      },
    } as never);

    await expect(listMallH5AfterSalesRequests()).resolves.toEqual([
      {
        afterSalesNo: "AS100001",
        createdAt: "2026-10-03T00:00:00Z",
        description: undefined,
        id: "AS-1",
        orderId: "ORDER-1",
        reason: "quality-issue",
        requestedAmountCny: 88.5,
        status: "pending",
        statusLabel: "待审核",
        type: "refund",
        typeLabel: "仅退款",
      },
    ]);

    await expect(
      createMallH5AfterSalesRequest({
        description: "屏幕划痕",
        items: [{ orderItemId: "oi-1", refundAmountCny: 88.5, requestedQuantity: 2 }],
        orderId: "ORDER-1",
        reasonCode: "quality-issue",
        requestedAmountCny: 88.5,
        type: "refund",
      }),
    ).resolves.toBeUndefined();
    expect(createSpy).toHaveBeenCalledWith({
      afterSalesType: "refund",
      currencyCode: "CNY",
      description: "屏幕划痕",
      items: [{ orderItemId: "oi-1", refundAmount: "88.50", requestedQuantity: 2 }],
      orderId: "ORDER-1",
      reasonCode: "quality-issue",
      requestedAmount: "88.50",
    });

    await expect(cancelMallH5AfterSalesRequest("AS-1")).resolves.toBeUndefined();
    expect(updateSpy).toHaveBeenCalledWith("AS-1", { status: "CANCELLED" });
  });
});
