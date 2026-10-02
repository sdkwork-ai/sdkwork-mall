import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureSdkworkAfterSalesRemotePort,
  type SdkworkAfterSalesRemotePort,
} from "../src/after-sales-remote-port";
import {
  createEmptyAfterSalesForm,
  createMallAfterSalesRequest,
  listMallAfterSalesRows,
  loadMallAfterSalesOrderContext,
  revokeMallAfterSalesRequest,
  validateAfterSalesForm,
} from "../src/after-sales-service";

function usePort(overrides: Partial<SdkworkAfterSalesRemotePort> = {}): SdkworkAfterSalesRemotePort {
  const port: SdkworkAfterSalesRemotePort = {
    createAfterSalesRequest: vi.fn().mockResolvedValue({ code: 0 }),
    listAfterSalesEvents: vi.fn().mockResolvedValue({ code: 0, data: { items: [] } }),
    listAfterSalesRequests: vi.fn().mockResolvedValue({ code: 0, data: { items: [] } }),
    listReturnShipments: vi.fn().mockResolvedValue({ code: 0, data: { items: [] } }),
    retrieveAfterSalesRequest: vi.fn().mockResolvedValue({ code: 0, data: {} }),
    retrieveOrder: vi.fn().mockResolvedValue({ code: 0, data: {} }),
    updateAfterSalesRequest: vi.fn().mockResolvedValue({ code: 0 }),
    ...overrides,
  };
  configureSdkworkAfterSalesRemotePort(port);
  return port;
}

describe("sdkwork-mall-pc-after-sales service", () => {
  afterEach(() => {
    configureSdkworkAfterSalesRemotePort(null);
  });

  it("loads the order context with tolerant amount mapping", async () => {
    const port = usePort({
      retrieveOrder: vi.fn().mockResolvedValue({
        code: 0,
        data: {
          items: [
            { id: "oi-1", priceCny: "12.50", quantity: 2, spu: { title: "SDKWork Book 14" } },
          ],
          orderId: "ORDER-9",
          paidAmount: "25.00",
          status: "PAID",
          totalAmount: 26,
        },
      }),
    });

    await expect(loadMallAfterSalesOrderContext(" ORDER-9 ")).resolves.toEqual({
      items: [{ orderItemId: "oi-1", priceCny: 12.5, quantity: 2, title: "SDKWork Book 14" }],
      orderId: "ORDER-9",
      paidAmountCny: 25,
      status: "PAID",
      totalAmountCny: 26,
    });
    expect(port.retrieveOrder).toHaveBeenCalledWith("ORDER-9");
  });

  it("creates after-sales requests with the wire-contract body", async () => {
    const port = usePort();
    const form = {
      ...createEmptyAfterSalesForm(),
      description: "划痕明显",
      evidenceFiles: [{ id: "f1", name: "proof.png", size: 1024 }],
      orderId: "ORDER-9",
      reason: "商品与描述不符",
      requestedAmountCny: "25.00",
      requestType: "return" as const,
    };

    await expect(
      createMallAfterSalesRequest(form, {
        items: [{ orderItemId: "oi-1", priceCny: 12.5, quantity: 2, title: "SDKWork Book 14" }],
        orderId: "ORDER-9",
        paidAmountCny: 25,
        status: "PAID",
        totalAmountCny: 26,
      }),
    ).resolves.toBeUndefined();
    expect(port.createAfterSalesRequest).toHaveBeenCalledWith({
      afterSalesType: "return",
      currencyCode: "CNY",
      description: "商品与描述不符\n划痕明显",
      evidenceSnapshot: [{ fileName: "proof.png", fileSize: 1024 }],
      items: [{ orderItemId: "oi-1", refundAmount: "25.00", requestedQuantity: 2 }],
      orderId: "ORDER-9",
      reasonCode: "buyer-request",
      requestedAmount: "25.00",
    });
  });

  it("maps wire rows with string amounts and revokes through status updates", async () => {
    const port = usePort({
      listAfterSalesRequests: vi.fn().mockResolvedValue({
        code: 0,
        data: {
          items: [
            {
              afterSalesNo: "AS100001",
              afterSalesType: "refund",
              description: "不想要了",
              id: "AS-1",
              orderId: "ORDER-9",
              requestedAmount: "25.00",
              status: "PENDING",
            },
          ],
        },
      }),
    });

    const rows = await listMallAfterSalesRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      requestedAmountCny: 25,
      status: "pending",
      statusLabel: "待审核",
      type: "refund",
      typeLabel: "仅退款",
    });
    expect(rows[0].reason).toContain("不想要了");

    await expect(revokeMallAfterSalesRequest("AS-1")).resolves.toBeUndefined();
    expect(port.updateAfterSalesRequest).toHaveBeenCalledWith("AS-1", { status: "CANCELLED" });
  });

  it("validates the form before any network call", () => {
    const errors = validateAfterSalesForm(createEmptyAfterSalesForm());
    expect(Object.keys(errors)).toEqual(["orderId", "reason", "requestedAmountCny"]);
  });
});
