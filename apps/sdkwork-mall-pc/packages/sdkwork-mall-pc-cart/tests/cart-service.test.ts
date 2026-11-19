import { afterEach, describe, expect, it, vi } from "vitest";

import { configureSdkworkCartRemotePort } from "../src/cart-remote-port";
import { loadMallCart } from "../src/cart-service";

function configureCart(response: unknown) {
  const retrieveCurrentCart = vi.fn(async () => response);
  configureSdkworkCartRemotePort({
    createCheckoutOrder: vi.fn(async () => ({})),
    createCheckoutQuote: vi.fn(async () => ({})),
    createCheckoutSession: vi.fn(async () => ({})),
    createDiscountApplication: vi.fn(async () => ({})),
    createWalletHold: vi.fn(async () => ({})),
    deleteCartItem: vi.fn(async () => ({})),
    listAddresses: vi.fn(async () => ({ data: { items: [] } })),
    listPaymentMethods: vi.fn(async () => ({ data: { items: [] } })),
    listUserCoupons: vi.fn(async () => ({ data: { items: [] } })),
    payOrder: vi.fn(async () => ({})),
    retrieveCurrentCart,
    retrieveOrderPaymentSuccess: vi.fn(async () => ({})),
    retrievePointsAccount: vi.fn(async () => ({})),
    retrieveWalletOverview: vi.fn(async () => ({})),
    setDefaultAddress: vi.fn(async () => ({})),
    updateCartItem: vi.fn(async () => ({})),
  });
  return { retrieveCurrentCart };
}

afterEach(() => {
  configureSdkworkCartRemotePort(null);
});

describe("loadMallCart", () => {
  it("unwraps the v3 `data.item` cart envelope", async () => {
    configureCart({
      code: 0,
      data: {
        item: {
          id: "cart-1",
          items: [
            {
              id: "line-1",
              spuId: "spu-1",
              skuId: "sku-1",
              quantity: 2,
              unitPrice: "4299.00",
              spu: { title: "AURORA X1", imageUrl: "https://cdn.example/x1.png" },
              sku: { name: "曜石黑" },
            },
          ],
        },
      },
      traceId: "trace-1",
    });

    const cart = await loadMallCart();

    expect(cart.id).toBe("cart-1");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      title: "AURORA X1",
      skuName: "曜石黑",
      quantity: 2,
      unitPriceCny: 4299,
      lineTotalCny: 8598,
    });
    expect(cart.totalAmountCny).toBe(8598);
  });

  it("accepts the flat dev-double cart body", async () => {
    configureCart({
      data: {
        id: "cart-2",
        items: [
          {
            id: "line-2",
            productId: "spu-2",
            skuId: "sku-2",
            quantity: 1,
            priceCny: 89,
            title: "东北五常大米 10kg",
          },
        ],
      },
    });

    await expect(loadMallCart()).resolves.toMatchObject({
      id: "cart-2",
      totalAmountCny: 89,
      items: [{ productId: "spu-2", unitPriceCny: 89, lineTotalCny: 89 }],
    });
  });

  it("keeps an unparseable price null instead of rendering 0.00", async () => {
    configureCart({
      data: { items: [{ id: "line-3", quantity: 1, unitPrice: "not-a-number" }] },
    });

    const cart = await loadMallCart();
    expect(cart.items[0]?.unitPriceCny).toBeNull();
    expect(cart.items[0]?.lineTotalCny).toBeNull();
  });
});
