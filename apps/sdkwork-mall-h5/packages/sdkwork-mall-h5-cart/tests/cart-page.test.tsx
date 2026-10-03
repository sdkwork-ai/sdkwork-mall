import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureSdkworkCommerceServiceProvider,
  type SdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";

import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  resetCommerceServiceMockSession,
} from "../../../../sdkwork-mall-pc/tests/test-utils/commerce-service-mock";
import { SdkworkMallH5CartPage } from "../src/pages/CartPage";

const CART_LINES = [
  {
    id: "cart-1",
    imageUrl: "",
    lineTotalCny: 1999,
    priceCny: 1999,
    quantity: 1,
    shopId: "shop-1",
    shopName: "SDKWork 精选",
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
    skuName: "10kg 装",
    spuId: "spu-2",
    title: "东北五常大米 10kg",
  },
];

function renderCartPage() {
  return render(
    <MemoryRouter>
      <SdkworkMallH5CartPage />
    </MemoryRouter>,
  );
}

describe("sdkwork-mall-h5 cart page", () => {
  beforeEach(() => {
    configureCommerceServiceMockSession({ authToken: "h5-cart-auth-token" });
  });

  afterEach(() => {
    resetCommerceServiceMockSession();
    configureSdkworkCommerceServiceProvider(null);
  });

  function useCartMock(initialLines = CART_LINES) {
    let lines = [...initialLines];
    const deleteSpy = vi.fn().mockImplementation(async (cartItemId: string) => {
      lines = lines.filter((line) => line.id !== cartItemId);
      return { code: 0 };
    });
    const mock = createCommerceServiceMock({
      cart: {
        current: {
          retrieve: vi.fn().mockImplementation(async () => ({
            code: 0,
            data: { id: "cart-current", items: [...lines] },
          })),
        },
        items: {
          update: vi.fn().mockResolvedValue({ code: 0 }),
          delete: deleteSpy,
        },
      },
    } as never);
    configureSdkworkCommerceServiceProvider(
      (): SdkworkCommerceService => mock as SdkworkCommerceService,
    );
    return { mock, deleteSpy };
  }

  it("renders the toolbar, shop group, and the footer settlement bar", async () => {
    useCartMock();
    renderCartPage();

    expect(await screen.findByText("共 2 件")).toBeTruthy();
    expect(screen.getByText("SDKWork 精选")).toBeTruthy();
    expect(screen.getByText("去结算(2)")).toBeTruthy();
    expect(screen.getByText("合计：")).toBeTruthy();
    expect(screen.getByText("¥2088.00")).toBeTruthy();
    expect(screen.getByText("已选 3 件")).toBeTruthy();
  });

  it("switches to manage mode and batch-deletes the selected rows", async () => {
    const { deleteSpy } = useCartMock();
    renderCartPage();

    fireEvent.click(await screen.findByRole("button", { name: "管理" }));
    const removeSelected = await screen.findByRole("button", { name: "删除所选(2)" });
    expect(screen.queryByRole("button", { name: "去结算(2)" })).toBeNull();

    fireEvent.click(removeSelected);
    // Stateful mock empties the cart, so the page falls back to the empty hero.
    expect(await screen.findByText("购物车还是空的")).toBeTruthy();
    expect(deleteSpy).toHaveBeenCalledTimes(2);
  });

  it("recomputes the footer when a row is deselected and blocks checkout at zero", async () => {
    useCartMock();
    renderCartPage();

    fireEvent.click((await screen.findAllByRole("checkbox"))[2]);
    expect(await screen.findByText("去结算(1)")).toBeTruthy();
    // ¥1999.00 matches both the remaining row price and the footer total.
    expect(screen.getAllByText("¥1999.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("已选 1 件")).toBeTruthy();

    fireEvent.click((await screen.findAllByRole("checkbox"))[1]);
    expect(await screen.findByText("去结算(0)")).toBeTruthy();
  });

  it("steps a row quantity through the cart update command", async () => {
    const { mock } = useCartMock();
    renderCartPage();

    const stepperPlus = await screen.findByRole("button", { name: /增加 东北五常大米/ });
    fireEvent.click(stepperPlus);
    await waitFor(() =>
      expect((mock as { cart: { items: { update: ReturnType<typeof vi.fn> } } }).cart.items.update).toHaveBeenCalledWith(
        "cart-2",
        { quantity: 3 },
      ),
    );
  });
});
