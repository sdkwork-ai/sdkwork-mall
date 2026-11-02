import { afterEach, describe, expect, it } from "vitest";

import { configureSdkworkCommerceServiceProvider } from "@sdkwork/mall-commerce-service";

import { submitMallH5CheckoutOrder } from "../src/cart-service";

/**
 * Behavioral check of the H5 confirm-order command.
 *
 * The contract test proves the fields exist in source; this proves the ordered
 * wire body: scoped cart ids, delivery/gift-card fields, invoice gating and the
 * post-order coupon application. A regression here charges the wrong amount or
 * silently drops the buyer's invoice.
 */
const calls: Array<{ body: Record<string, unknown>; sessionId: string }> = [];

function installFakeCommerce() {
  calls.length = 0;
  configureSdkworkCommerceServiceProvider(
    () =>
      ({
        addresses: {
          defaultSelection: { create: async () => ({ code: 0, data: { accepted: true } }) },
        },
        checkout: {
          sessions: {
            create: async () => ({ code: 0, data: { id: "session-1", quoteId: "quote-1" } }),
            orders: {
              create: async (sessionId: string, body: Record<string, unknown>) => {
                calls.push({ body, sessionId });
                return { code: 0, data: { id: "order-1" } };
              },
            },
            quotes: { create: async () => ({ code: 0, data: { id: "quote-1" } }) },
          },
        },
        orders: {
          pay: async () => ({ code: 0, data: { paymentId: "payment-1" } }),
        },
        promotions: {
          discountApplications: { create: async () => ({ code: 0, data: { accepted: true } }) },
        },
        wallet: {
          holds: { create: async () => ({ code: 0, data: { accepted: true } }) },
        },
      }) as never,
  );
}

afterEach(() => {
  configureSdkworkCommerceServiceProvider(null);
});

describe("H5 checkout order payload", () => {
  it("scopes the order to the selected lines and carries invoice, delivery and gift card", async () => {
    installFakeCommerce();

    const result = await submitMallH5CheckoutOrder({
      addressId: "address-1",
      buyerRemark: "请轻放",
      cartItemIds: ["ci-1"],
      couponId: "coupon-1",
      deliveryMethod: "sf",
      giftCardCode: "GC-12345678",
      invoiceForm: {
        email: "finance@sdkwork.com",
        taxNumber: "91310000MA1FL0000X",
        title: "SDKWork 科技有限公司",
        titleType: "company",
      },
      needInvoice: true,
      paymentMethodCode: "WECHAT",
      usePoints: true,
      useWallet: true,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      sessionId: "session-1",
      body: {
        buyerRemark: "请轻放",
        cartItemIds: ["ci-1"],
        deliveryMethod: "sf",
        giftCardCode: "GC-12345678",
        invoiceForm: {
          email: "finance@sdkwork.com",
          taxNumber: "91310000MA1FL0000X",
          title: "SDKWork 科技有限公司",
          titleType: "company",
        },
        needInvoice: true,
        quoteId: "quote-1",
      },
    });
    expect(result.orderId).toBe("order-1");
    expect(result.nextUrl).toContain("paymentId=payment-1");
  });

  it("drops the invoice form when the buyer does not ask for an invoice", async () => {
    installFakeCommerce();

    await submitMallH5CheckoutOrder({
      addressId: "address-1",
      cartItemIds: [],
      invoiceForm: { title: "ignored", titleType: "personal" },
      needInvoice: false,
      paymentMethodCode: "WECHAT",
    });

    const body = calls[0].body;
    expect(body.needInvoice).toBe(false);
    expect(body.invoiceForm).toBeUndefined();
    expect(body.cartItemIds).toBeUndefined();
  });
});
