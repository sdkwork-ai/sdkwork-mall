import { describe, expect, it } from "vitest";

import { buildCheckoutOrderBody } from "../src/services/cart-service";
import {
  buildReturnShipmentBody,
  buildReturnShipmentRequest,
  RETURN_CARRIERS,
} from "../src/services/aftersales-service";

/**
 * Money-path payload regression tests.
 *
 * The contract tests prove the fields exist in source; these prove the wire
 * bodies are actually assembled correctly (invoice gating, delivery/gift-card
 * fields, scoped cart ids, trimmed tracking number, idempotency header).
 */
describe("mini-program checkout order body", () => {
  it("sends invoice, delivery, gift-card and scoped cart fields", () => {
    const body = buildCheckoutOrderBody(
      {
        buyerRemark: "请轻放",
        cartItemIds: ["ci-1", "ci-2"],
        couponId: "coupon-1",
        deliveryMethod: "express",
        giftCardCode: "GC-12345678",
        invoiceForm: {
          taxNumber: "91310000MA1FL0000X",
          title: "SDKWork 科技有限公司",
          titleType: "company",
        },
        needInvoice: true,
      },
      { quoteId: "quote-1" },
    );

    expect(body).toEqual({
      buyerRemark: "请轻放",
      cartItemIds: ["ci-1", "ci-2"],
      deliveryMethod: "express",
      giftCardCode: "GC-12345678",
      invoiceForm: {
        taxNumber: "91310000MA1FL0000X",
        title: "SDKWork 科技有限公司",
        titleType: "company",
      },
      needInvoice: true,
      quoteId: "quote-1",
    });
    // The coupon is applied per order after creation, never in this body.
    expect(body).not.toHaveProperty("couponId");
  });

  it("omits invoice details and empty cart ids when no invoice is requested", () => {
    const body = buildCheckoutOrderBody(
      {
        cartItemIds: [],
        invoiceForm: { title: "ignored", titleType: "personal" },
        needInvoice: false,
      },
      { quoteId: "" },
    );

    expect(body).toEqual({
      buyerRemark: undefined,
      cartItemIds: undefined,
      deliveryMethod: undefined,
      giftCardCode: undefined,
      invoiceForm: undefined,
      needInvoice: false,
      quoteId: undefined,
    });
  });

  it("defaults needInvoice to false for legacy callers", () => {
    const body = buildCheckoutOrderBody({}, { quoteId: "q" });
    expect(body.needInvoice).toBe(false);
    expect(body.quoteId).toBe("q");
  });
});

describe("mini-program return-shipment payload", () => {
  it("trims the tracking number and marks the buyer return direction", () => {
    expect(
      buildReturnShipmentBody({
        carrierCode: "SF",
        carrierName: "顺丰速运",
        requestId: "as-1",
        trackingNo: "  SF123456789  ",
      }),
    ).toEqual({
      carrierCode: "SF",
      carrierName: "顺丰速运",
      shipmentDirection: "buyer_return",
      trackingNo: "SF123456789",
    });
  });

  it("posts to the request-scoped path with an idempotency key", () => {
    const request = buildReturnShipmentRequest(
      { carrierCode: "ZTO", requestId: "as-42", trackingNo: "ZT1" },
      "key-1",
    );

    expect(request.path).toBe("/after_sales/requests/as-42/return_shipments");
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "Idempotency-Key": "key-1" });
  });

  it("offers the buyer a carrier catalogue", () => {
    expect(RETURN_CARRIERS.map((carrier) => carrier.code)).toContain("SF");
    expect(RETURN_CARRIERS.length).toBeGreaterThan(1);
  });
});
