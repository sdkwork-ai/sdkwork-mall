import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureSdkworkCommerceServiceProvider,
  type SdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import { getShopMobileCartRuntime } from "@sdkwork/shop-mobile-react-shopping";

import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  resetCommerceServiceMockSession,
} from "../../../../sdkwork-mall-pc/tests/test-utils/commerce-service-mock";
import { configureSdkworkMallH5CartBrick } from "../src/cart-brick";

/**
 * Host adapter contract for the shop cart brick.
 *
 * The brick owns the cart surface; the mall cart package supplies the data
 * plane. These tests pin the mapping (price units, shop grouping, selection)
 * and the mutation wiring so the brick and the commerce facade cannot drift.
 */
const CART_LINES = [
  {
    id: "cart-1",
    imageUrl: "",
    lineTotalCny: 1999,
    priceCny: 1999,
    quantity: 1,
    shopId: "shop-1",
    shopName: "SDKWork 精选",
    sku: { title: "远峰蓝", priceCny: 1999 },
    skuName: "远峰蓝",
    spuId: "spu-1",
    title: "SDKWork Phone Lite 轻薄手机",
  },
  {
    id: "cart-2",
    imageUrl: "",
    lineTotalCny: 89,
    priceCny: 89,
    quantity: 2,
    shopId: "shop-1",
    shopName: "SDKWork 精选",
    sku: { title: "10kg 装", priceCny: 89 },
    skuName: "10kg 装",
    spuId: "spu-2",
    title: "东北五常大米 10kg",
  },
];

let updateSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;

function installCartServiceMock() {
  updateSpy = vi.fn().mockResolvedValue({ code: 0 });
  deleteSpy = vi.fn().mockResolvedValue({ code: 0 });
  const mock = createCommerceServiceMock({
    cart: {
      current: {
        retrieve: vi.fn().mockResolvedValue({
          code: 0,
          data: { id: "cart-current", items: CART_LINES },
        }),
      },
      items: {
        update: updateSpy,
        delete: deleteSpy,
      },
    },
  } as never);
  configureSdkworkCommerceServiceProvider(
    (): SdkworkCommerceService => mock as SdkworkCommerceService,
  );
}

function requireCartRuntime() {
  const runtime = getShopMobileCartRuntime();
  if (!runtime) {
    throw new Error("cart runtime was not composed");
  }
  return runtime;
}

describe("sdkwork-mall-h5 cart brick adapter", () => {
  beforeEach(() => {
    configureCommerceServiceMockSession({ authToken: "h5-cart-auth-token" });
    installCartServiceMock();
    configureSdkworkMallH5CartBrick();
  });

  afterEach(() => {
    resetCommerceServiceMockSession();
    configureSdkworkCommerceServiceProvider(null);
  });

  it("maps commerce cart lines into the brick model with yuan price strings", async () => {
    const items = await requireCartRuntime().getCart();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "cart-1",
      productId: "spu-1",
      shopName: "SDKWork 精选",
      checked: true,
      quantity: 1,
    });
    expect(items[0].product).toMatchObject({
      title: "SDKWork Phone Lite 轻薄手机",
      price: "1999.00",
      shopId: "shop-1",
    });
    expect(items[0].sku?.price).toBe("1999.00");
  });

  it("persists selection through the session-scoped runtime", async () => {
    const runtime = requireCartRuntime();
    await runtime.getCart();
    await runtime.toggleCheck("cart-1", false);

    const afterToggle = await runtime.getCart();
    expect(afterToggle.find((item) => item.id === "cart-1")?.checked).toBe(false);

    await runtime.toggleAllCheck(false);
    const afterAll = await runtime.getCart();
    expect(afterAll.every((item) => item.checked === false)).toBe(true);
  });

  it("forwards quantity updates and removals to the commerce cart commands", async () => {
    const runtime = requireCartRuntime();
    await runtime.getCart();

    await runtime.updateQuantity("cart-2", 3);
    expect(updateSpy).toHaveBeenCalledWith("cart-2", { quantity: 3 });

    await runtime.removeFromCart(["cart-1"]);
    expect(deleteSpy).toHaveBeenCalledWith("cart-1");
  });
});
