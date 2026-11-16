/**
 * Contracts for the marketing / after-sales block projections.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (promotion, addresses, after-sales,
 * invoices, shops rows). Each service must reach its block through the runtime,
 * pass idempotency keys on commands, and add no HTTP hop of its own.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeMallMpRuntime, resetMallMpRuntime } from "@sdkwork/mall-mp-core";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";
import {
  cancelRequest,
  createRequest,
  createReturnShipment,
  listAfterSalesEvents,
  listRequests,
} from "../src/services/aftersales-service";
import { listAddresses, setDefaultAddress } from "../src/services/address-service";
import { listInvoices } from "../src/services/invoice-service";
import { listActivities, listShops, retrieveShop } from "../src/services/marketing-service";
import { claimCoupon, listOffers, redeemCouponCode } from "../src/services/promotion-service";

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
  return { host, runtime };
}

function installCommerce(runtime: ReturnType<typeof boot>["runtime"], commerce: Record<string, unknown>) {
  (runtime as unknown as { commerceClient: Record<string, unknown> }).commerceClient = commerce;
}

describe("marketing block projections", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("lists offers and claims coupons through the promotions block", async () => {
    const { host, runtime } = boot();
    const promotions = {
      offers: {
        list: vi.fn(async () => ({
          data: {
            items: [
              { id: "o-1", title: "周年庆", discountText: "满 200 减 30", highlight: "限时", endAt: "2026-12-01", couponStockId: "s-1" },
            ],
          },
        })),
        retrieve: vi.fn(),
      },
      userCoupons: { claims: { create: vi.fn(async () => ({ data: { accepted: true } })) } },
      codes: { redemptions: { create: vi.fn(async () => ({ data: { accepted: true } })) } },
    };
    installCommerce(runtime, { promotions });

    const offers = await listOffers();
    await claimCoupon("o-1");
    await redeemCouponCode("MALL30");

    expect(offers[0]).toMatchObject({ id: "o-1", claimable: true, discountText: "满 200 减 30" });
    expect(promotions.userCoupons.claims.create).toHaveBeenCalledWith({ offerId: "o-1" });
    expect(promotions.codes.redemptions.create).toHaveBeenCalledWith({ code: "MALL30" });
    expect(host.recorder.http).toHaveLength(0);
  });

  it("reads the address book and marks the default through the addresses block", async () => {
    const { runtime } = boot();
    const addresses = {
      list: vi.fn(async () => ({ data: { items: [{ id: "a-1", receiverName: "李明", receiverPhone: "13800000000", addressLine: "上海市浦东新区 1 号", isDefault: true }] } })),
      defaultSelection: { create: vi.fn(async () => ({ data: { accepted: true } })) },
    };
    installCommerce(runtime, { addresses });

    const rows = await listAddresses();
    await setDefaultAddress("a-1");

    expect(rows[0]).toMatchObject({ id: "a-1", isDefault: true, receiverName: "李明" });
    expect(addresses.defaultSelection.create).toHaveBeenCalledWith("a-1", {});
  });

  it("reads invoices and shops through their blocks", async () => {
    const { runtime } = boot();
    const invoices = { mine: { list: vi.fn(async () => ({ data: { items: [{ id: "inv-1", title: "SDKWork", titleType: "company", status: "issued", amount: 99 }] } })) } };
    const shops = {
      list: vi.fn(async () => ({ data: { items: [{ id: "s-1", name: "官方旗舰店", rating: 4.9 }] } })),
      retrieve: vi.fn(async () => ({ data: { id: "s-1", name: "官方旗舰店", rating: 4.9 } })),
    };
    const catalog = { products: { list: vi.fn(async () => ({ data: { items: [{ id: "p-1", title: "机械键盘", price: 399 }] } })) } };
    const promotions = { offers: { list: vi.fn(async () => ({ data: { items: [{ id: "o-1", title: "周年庆", endAt: "2026-12-01" }] } })), retrieve: vi.fn() } };
    installCommerce(runtime, { catalog, invoices, promotions, shops });

    const invoiceRows = await listInvoices();
    const shopRows = await listShops(4);
    const detail = await retrieveShop("s-1");
    const activities = await listActivities();

    expect(invoiceRows[0]).toMatchObject({ id: "inv-1", status: "issued" });
    expect(shopRows[0]).toMatchObject({ id: "s-1", name: "官方旗舰店", rating: 4.9 });
    expect(detail?.products[0]).toMatchObject({ id: "p-1", priceCny: 399 });
    expect(activities[0]).toMatchObject({ id: "o-1", phase: "active" });
    expect(shops.list).toHaveBeenCalledWith({ page: 1, pageSize: 4, operationStatus: "active" });
  });
});

describe("after-sales block projection", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("lists, creates, cancels, reads the timeline and returns goods through the block", async () => {
    const { host, runtime } = boot();
    const afterSales = {
      requests: {
        list: vi.fn(async () => ({
          data: {
            items: [{ id: "as-1", afterSalesNo: "AS20261116", status: "APPROVED", afterSalesType: "return", requestedAmount: "99.00" }],
          },
        })),
        create: vi.fn(async () => ({ data: { id: "as-2" } })),
        update: vi.fn(async () => ({ data: { id: "as-1", status: "CANCELLED" } })),
      },
      events: { list: vi.fn(async () => ({ data: { items: [{ eventType: "approved", createdAt: "2026-11-16T10:00:00Z" }] } })) },
      returnShipments: { create: vi.fn(async () => ({ data: { id: "rs-1" } })) },
    };
    installCommerce(runtime, { afterSales });

    const rows = await listRequests(1, 50);
    await createRequest({
      orderId: "o-1",
      afterSalesType: "return",
      reasonCode: "quality-issue",
      requestedAmountCny: 99,
      items: [{ orderItemId: "i-1", requestedQuantity: 1 }],
    });
    await cancelRequest("as-1");
    const events = await listAfterSalesEvents("as-1");
    await createReturnShipment({ carrierCode: "SF", requestId: "as-1", trackingNo: "SF1" });

    expect(rows[0]).toMatchObject({ id: "as-1", returnable: true, revokable: false, type: "return" });
    expect(afterSales.requests.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o-1", requestedAmount: "99.00", currencyCode: "CNY" }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(afterSales.requests.update).toHaveBeenCalledWith("as-1", { status: "CANCELLED" });
    expect(events[0]).toEqual({ action: "approved", at: "2026-11-16T10:00:00Z" });
    expect(afterSales.returnShipments.create).toHaveBeenCalledWith(
      "as-1",
      expect.objectContaining({ carrierCode: "SF", shipmentDirection: "buyer_return", trackingNo: "SF1" }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(host.recorder.http).toHaveLength(0);
  });
});
