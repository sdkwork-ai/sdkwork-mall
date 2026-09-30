import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureOrderServiceMockSession,
  createOrderServiceMock,
  resetOrderServiceMockSession,
} from "../../../tests/test-utils/commerce-service-mock";
import {
  createSdkworkOrderService,
  type CreateSdkworkOrderServiceOptions,
  type SdkworkOrderMessagesOverrides,
} from "../src";

const productImage = {
  kind: "image",
  publicUrl: "https://cdn.sdkwork.ai/pro-annual.png",
  source: "external_url",
  url: "https://cdn.sdkwork.ai/pro-annual.png",
} as const;

describe("sdkwork-mall-pc-order service", () => {
  beforeEach(() => {
    configureOrderServiceMockSession({ authToken: "order-auth-token" });
  });

  afterEach(() => {
    resetOrderServiceMockSession();
  });

  it("maps orders, statistics, details, and payment actions into a reusable order center", async () => {
    const orderService = createOrderServiceMock({
      orders: {
        cancellations: {
          create: vi.fn().mockResolvedValue({
            code: 0,
          }),
        },
        retrieve: vi.fn().mockResolvedValue({
          code: 0,
          data: {
            createdAt: "2026-04-02T08:00:00.000Z",
            items: [
              {
                id: "ITEM-1",
                productImage,
                productName: "Pro Annual",
                quantity: 1,
                totalAmount: "699",
              },
            ],
            orderId: "ORDER-2",
            orderSn: "SN-ORDER-2",
            outTradeNo: "OUT-ORDER-2",
            paidAmount: "699",
            payTime: "2026-04-02T08:03:00.000Z",
            paymentMethod: "WECHAT",
            productImage,
            quantity: 1,
            remark: "Annual renewal",
            status: "PAID",
            statusName: "Paid",
            subject: "Pro Annual",
            totalAmount: "699",
            transactionId: "TXN-ORDER-2",
          },
        }),
        paymentSuccess: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              orderId: "ORDER-2",
              paid: true,
              status: "PAID",
              statusName: "Paid",
            },
          }),
        },
        statistics: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              completed: 8,
              pendingPayment: 1,
              pendingReceipt: 0,
              pendingShipment: 0,
              totalAmount: "2999",
              totalOrders: 9,
            },
          }),
        },
        status: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              orderId: "ORDER-2",
              status: "PAID",
              statusName: "Paid",
            },
          }),
        },
        list: vi.fn().mockResolvedValue({
          code: 0,
          data: {
            content: [
              {
                createdAt: "2026-04-02T08:00:00.000Z",
                discountAmount: "0",
                orderId: "ORDER-2",
                orderSn: "SN-ORDER-2",
                paidAmount: "699",
                payTime: "2026-04-02T08:03:00.000Z",
                paymentMethod: "WECHAT",
                quantity: 1,
                status: "PAID",
                statusName: "Paid",
                subject: "Pro Annual",
                totalAmount: "699",
              },
              {
                createdAt: "2026-04-03T09:00:00.000Z",
                discountAmount: "0",
                expireTime: "2026-04-03T09:30:00.000Z",
                orderId: "ORDER-3",
                orderSn: "SN-ORDER-3",
                paidAmount: "0",
                paymentMethod: "ALIPAY",
                quantity: 1,
                status: "PENDING_PAYMENT",
                statusName: "Pending payment",
                subject: "Pro Monthly",
                totalAmount: "199",
              },
            ],
          },
        }),
        payments: {
          create: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              amount: "199",
              orderId: "ORDER-3",
              outTradeNo: "OUT-ORDER-3",
              paymentId: "PAY-ORDER-3",
              paymentMethod: "ALIPAY",
              paymentParams: {
                payUrl: "https://pay.sdkwork.ai/alipay/ORDER-3",
              },
            },
          }),
        },
      },
    });

    const service = createSdkworkOrderService({
      orderService,
    });

    const dashboard = await service.getDashboard();
    const detail = await service.getOrderDetail("ORDER-2");

    expect(dashboard.statistics).toMatchObject({
      completed: 8,
      pendingPayment: 1,
      totalAmountCny: 2999,
      totalOrders: 9,
    });
    expect(dashboard.orders[0]).toMatchObject({
      id: "ORDER-3",
      status: "pending-payment",
      subject: "Pro Monthly",
    });
    expect(detail).toMatchObject({
      id: "ORDER-2",
      productImage,
      status: "paid",
      subject: "Pro Annual",
    });
    expect(detail.items[0]).toMatchObject({
      image: productImage,
      name: "Pro Annual",
    });
    expect(detail.timeline).toHaveLength(3);

    await expect(
      service.payOrder({
        orderId: "ORDER-3",
        paymentMethod: "ALIPAY",
      }),
    ).resolves.toMatchObject({
      amountCny: 199,
      orderId: "ORDER-3",
      paymentId: "PAY-ORDER-3",
      paymentMethod: "ALIPAY",
    });

    await expect(
      service.cancelOrder({
        cancelReason: "Switched plan",
        orderId: "ORDER-3",
      }),
    ).resolves.toEqual({
      cancelled: true,
      orderId: "ORDER-3",
    });
  });

  it("returns a guest-safe empty order dashboard without creating a client", async () => {
    resetOrderServiceMockSession();
    const service = createSdkworkOrderService();

    const dashboard = await service.getDashboard();

    expect(dashboard.orders).toEqual([]);
    expect(dashboard.statistics.totalOrders).toBe(0);
  });

  it("uses copy overrides for order fallbacks, auth errors, and payment failure messages", async () => {
    const orderService = createOrderServiceMock({
      orders: {
        retrieve: vi.fn().mockResolvedValue({
          code: 0,
          data: {
            createdAt: "2026-04-02T08:00:00.000Z",
            items: [
              {
                quantity: 1,
                totalAmount: "199",
              },
            ],
            orderId: "ORDER-9",
            status: "PENDING_PAYMENT",
            totalAmount: "199",
          },
        }),
        paymentSuccess: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: null,
          }),
        },
        statistics: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              totalOrders: 1,
            },
          }),
        },
        status: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              status: "PENDING_PAYMENT",
            },
          }),
        },
        list: vi.fn().mockResolvedValue({
          code: 0,
          data: {
            content: [
              {
                createdAt: "2026-04-02T08:00:00.000Z",
                orderId: "ORDER-9",
                status: "PENDING_PAYMENT",
                totalAmount: "199",
              },
            ],
          },
        }),
      },
    });

    const service = createSdkworkOrderService({
      orderService,
      messages: {
        service: {
          itemFallbackName: "Fallback order item",
          payFailed: "Unable to restart payment from overrides",
          signInRequired: "Override order auth required",
          summaryFallbackSubject: "Fallback order",
        },
        status: {
          pendingPayment: "Needs payment",
        },
      } satisfies SdkworkOrderMessagesOverrides,
    } satisfies CreateSdkworkOrderServiceOptions);

    const dashboard = await service.getDashboard();
    const detail = await service.getOrderDetail("ORDER-9");

    expect(dashboard.orders[0]).toMatchObject({
      statusLabel: "Needs payment",
      subject: "Fallback order",
    });
    expect(detail.items[0]?.name).toBe("Fallback order item");
    expect(detail.statusLabel).toBe("Needs payment");

    resetOrderServiceMockSession();
    const guestService = createSdkworkOrderService({
      messages: {
        service: {
          signInRequired: "Override order auth required",
        },
      } satisfies SdkworkOrderMessagesOverrides,
    } satisfies CreateSdkworkOrderServiceOptions);

    await expect(guestService.getOrderDetail("ORDER-9")).rejects.toThrow("Override order auth required");

    configureOrderServiceMockSession({ authToken: "order-auth-token" });
    const failingService = createSdkworkOrderService({
      orderService: createOrderServiceMock({
        orders: {
          payments: {
            create: vi.fn().mockResolvedValue({
              code: 5000,
            }),
          },
        },
      }),
      messages: {
        service: {
          payFailed: "Unable to restart payment from overrides",
        },
      } satisfies SdkworkOrderMessagesOverrides,
    } satisfies CreateSdkworkOrderServiceOptions);

    await expect(
      failingService.payOrder({
        orderId: "ORDER-9",
      }),
    ).rejects.toThrow("Unable to restart payment from overrides");
  });

  it("confirms receipt through the order receipts command", async () => {
    const receiptsCreate = vi.fn().mockResolvedValue({ code: 0 });
    const orderService = createSdkworkOrderService({
      orderService: createOrderServiceMock({
        orders: {
          receipts: {
            create: receiptsCreate,
          },
        },
      } as never),
    });

    await expect(
      orderService.confirmReceipt({ orderId: "ORDER-11" }),
    ).resolves.toEqual({ confirmed: true, orderId: "ORDER-11" });
    expect(receiptsCreate).toHaveBeenCalledWith(
      "ORDER-11",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("resolves shipments and tracking events for an order", async () => {
    const shipmentsRetrieve = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        carrierName: "SDKWork Express",
        shipmentId: "SHIP-1",
        shipmentNo: "SF123",
        statusName: "In transit",
      },
    });
    const trackingList = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        content: [
          { description: "Departed sorting center", occurredAt: "2026-04-03T09:00:00.000Z", statusName: "Transport" },
          { description: "Shipment created", occurredAt: "2026-04-02T18:00:00.000Z" },
        ],
      },
    });
    const orderService = createSdkworkOrderService({
      orderService: createOrderServiceMock({
        orders: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: { orderId: "ORDER-12", shipmentIds: ["SHIP-1"] },
          }),
        },
        shipments: {
          retrieve: shipmentsRetrieve,
          packages: { list: vi.fn().mockResolvedValue({ code: 0, data: { content: [] } }) },
          trackingEvents: { list: trackingList },
        },
      } as never),
    });

    const logistics = await orderService.getOrderLogistics({ orderId: "ORDER-12" });
    expect(logistics.orderId).toBe("ORDER-12");
    expect(logistics.shipments).toHaveLength(1);
    expect(logistics.shipments[0]).toMatchObject({
      carrier: "SDKWork Express",
      shipmentId: "SHIP-1",
      shipmentNo: "SF123",
      statusLabel: "In transit",
    });
    expect(logistics.shipments[0].trackingEvents[0].description).toBe("Departed sorting center");
    expect(trackingList).toHaveBeenCalledWith("SHIP-1", { page: 1, pageSize: 50 });
  });

  it("returns an empty logistics payload when the order has no shipments yet", async () => {
    const orderService = createSdkworkOrderService({
      orderService: createOrderServiceMock({
        orders: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: { orderId: "ORDER-13" },
          }),
        },
      } as never),
    });

    await expect(
      orderService.getOrderLogistics({ orderId: "ORDER-13" }),
    ).resolves.toEqual({ orderId: "ORDER-13", shipments: [] });
  });
});
