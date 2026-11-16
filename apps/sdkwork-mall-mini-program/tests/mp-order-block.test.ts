/**
 * Contracts for the order block projection.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (order row). The mall order service must
 * reach the order block through the runtime, pass idempotency keys on commands,
 * and keep the view models the pages already render — without a single HTTP hop
 * of its own.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initializeMallMpRuntime,
  resetMallMpRuntime,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";
import {
  cancelOrder,
  confirmReceipt,
  getOrderDetail,
  getOrderStatistics,
  listOrders,
  payOrder,
} from "../src/services/order-service";

const ENVIRONMENT = {
  appApiBaseUrl: "https://api.test/app/v3/api",
  deploymentProfile: "standalone",
  environment: "development",
  profileId: "standalone.development",
} as const;

interface FakeOrderClient {
  orders: {
    cancellations: { create: ReturnType<typeof vi.fn> };
    list: ReturnType<typeof vi.fn>;
    payments: { create: ReturnType<typeof vi.fn> };
    paymentSuccess: { retrieve: ReturnType<typeof vi.fn> };
    receipts: { create: ReturnType<typeof vi.fn> };
    retrieve: ReturnType<typeof vi.fn>;
    statistics: { retrieve: ReturnType<typeof vi.fn> };
  };
}

function bootWithFakeOrderClient(overrides: Partial<FakeOrderClient["orders"]> = {}) {
  resetMallMpRuntime();
  const host = createMemoryHost();
  const runtime = initializeMallMpRuntime({ environment: { ...ENVIRONMENT }, host });
  const orders = {
    list: vi.fn(async () => ({
      items: [
        { orderId: "o-1", subject: "机械键盘", status: "PENDING_PAYMENT", totalAmount: 399, createdAt: "2026-11-16T10:00:00Z" },
      ],
      pageInfo: { mode: "offset", page: 1, pageSize: 20, totalItems: 21, totalPages: 2, hasMore: true },
    })),
    retrieve: vi.fn(async (orderId: string) => ({
      orderId,
      subject: "机械键盘",
      status: "PENDING_SHIPMENT",
      totalAmount: 399,
      paidAmount: 359,
      paymentMethod: "wechat_native",
      createdAt: "2026-11-16T10:00:00Z",
      shipmentIds: ["s-1"],
      items: [
        { id: "i-1", spuId: "spu-1", quantity: 1, unitPrice: 399, spu: { title: "机械键盘", imageUrl: "a.jpg" }, sku: { name: "青轴" } },
      ],
    })),
    statistics: { retrieve: vi.fn(async () => ({ totalOrders: 3, pendingPayment: 1, pendingShipment: 1, pendingReceipt: 0, completed: 1 })) },
    payments: { create: vi.fn(async () => ({ paymentId: "p-9" })) },
    cancellations: { create: vi.fn(async () => ({ accepted: true })) },
    receipts: { create: vi.fn(async () => ({ accepted: true })) },
    paymentSuccess: { retrieve: vi.fn(async () => ({ paid: true })) },
    ...overrides,
  };
  (runtime as unknown as { orderClient: FakeOrderClient }).orderClient = { orders };
  return { host, runtime, orders };
}

describe("order block projection", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("maps a page of orders and its paging without any HTTP hop", async () => {
    const { host, orders } = bootWithFakeOrderClient();

    const page = await listOrders({ page: 1, pageSize: 20, status: "PENDING_PAYMENT" });

    expect(orders.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, status: "PENDING_PAYMENT" });
    expect(page.orders[0]).toMatchObject({ id: "o-1", subject: "机械键盘", totalAmountCny: 399 });
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(21);
    expect(host.recorder.http).toHaveLength(0);
  });

  it("keeps the detail view model the pages render", async () => {
    const { orders } = bootWithFakeOrderClient();

    const detail = await getOrderDetail("o-1");

    expect(orders.retrieve).toHaveBeenCalledWith("o-1");
    expect(detail).toMatchObject({
      id: "o-1",
      paidAmountCny: 359,
      paymentMethod: "wechat_native",
      shipmentIds: ["s-1"],
      status: "PENDING_SHIPMENT",
    });
    expect(detail.items[0]).toMatchObject({ id: "i-1", priceCny: 399, quantity: 1, skuName: "青轴", title: "机械键盘" });
  });

  it("passes an idempotency key on every order command", async () => {
    const { orders } = bootWithFakeOrderClient();

    await expect(payOrder("o-1", "wechat_native")).resolves.toBe("p-9");
    await cancelOrder("o-1");
    await confirmReceipt("o-1");

    expect(orders.payments.create).toHaveBeenCalledWith(
      "o-1",
      { paymentMethod: "wechat_native" },
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(orders.cancellations.create).toHaveBeenCalledWith(
      "o-1",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
      {},
    );
    expect(orders.receipts.create).toHaveBeenCalledWith(
      "o-1",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
      {},
    );
  });

  it("reads order statistics from the block", async () => {
    const { orders } = bootWithFakeOrderClient();

    await expect(getOrderStatistics()).resolves.toEqual({
      completed: 1,
      pendingPayment: 1,
      pendingReceipt: 0,
      pendingShipment: 1,
      totalOrders: 3,
    });
    expect(orders.statistics.retrieve).toHaveBeenCalledTimes(1);
  });
});

export type { MallMpRuntime };
