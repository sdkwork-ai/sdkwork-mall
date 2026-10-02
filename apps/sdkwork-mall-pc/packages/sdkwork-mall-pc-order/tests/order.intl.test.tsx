import {
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";
import {
  SdkworkOrderIntlProvider,
  SdkworkOrderPage,
  SdkworkOrderStatGrid,
  createSdkworkOrderController,
} from "../src";

function createOrderDashboard() {
  return {
    orders: [
      {
        createdAt: "2026-04-03T09:00:00.000Z",
        discountAmountCny: 20,
        id: "ORDER-3",
        paidAmountCny: 0,
        quantity: 1,
        status: "pending-payment" as const,
        statusLabel: "Pending payment",
        subject: "Pro Monthly",
        totalAmountCny: 199,
      },
    ],
    statistics: {
      completed: 8,
      pendingPayment: 1,
      pendingReceipt: 0,
      pendingShipment: 0,
      totalAmountCny: 2999,
      totalOrders: 9,
    },
  };
}

describe("sdkwork-mall-pc-order intl", () => {
  it("renders Chinese copy across the order page when a Chinese locale is provided", async () => {
    const controller = createSdkworkOrderController({
      service: {
        cancelOrder: vi.fn(),
        getDashboard: vi.fn().mockResolvedValue(createOrderDashboard()),
        getEmptyDashboard: vi.fn().mockReturnValue({
          orders: [],
          statistics: {
            completed: 0,
            pendingPayment: 0,
            pendingReceipt: 0,
            pendingShipment: 0,
            totalAmountCny: 0,
            totalOrders: 0,
          },
        }),
        getOrderDetail: vi.fn().mockResolvedValue({
          createdAt: "2026-04-03T09:00:00.000Z",
          id: "ORDER-3",
          items: [
            {
              id: "ITEM-3",
              name: "Pro Monthly",
              quantity: 1,
              totalAmountCny: 199,
              unitPriceCny: 199,
            },
          ],
          paidAmountCny: 0,
          quantity: 1,
          status: "pending-payment" as const,
          statusLabel: "Pending payment",
          subject: "Pro Monthly",
          timeline: [],
          totalAmountCny: 199,
        }),
        payOrder: vi.fn(),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <MemoryRouter>
          <SdkworkOrderPage controller={controller} locale="zh-CN" />
        </MemoryRouter>
      </SdkworkThemeProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "\u8ba2\u5355\u4e2d\u5fc3",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "\u8d26\u5355\u5386\u53f2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "\u5168\u90e8" })).toBeInTheDocument();

    // 「查看详情」是导航到订单详情路由的链接。
    expect(
      screen.getByRole("link", {
        name: "\u67e5\u770b\u8be6\u60c5",
      }),
    ).toHaveAttribute("href", "/buyer/orders/ORDER-3");
  });

  it("applies host message overrides on top of the localized order copy seam", async () => {
    const controller = createSdkworkOrderController({
      service: {
        cancelOrder: vi.fn(),
        getDashboard: vi.fn().mockResolvedValue(createOrderDashboard()),
        getEmptyDashboard: vi.fn().mockReturnValue({
          orders: [],
          statistics: {
            completed: 0,
            pendingPayment: 0,
            pendingReceipt: 0,
            pendingShipment: 0,
            totalAmountCny: 0,
            totalOrders: 0,
          },
        }),
        getOrderDetail: vi.fn(),
        payOrder: vi.fn(),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <MemoryRouter>
          <SdkworkOrderPage
            controller={controller}
            locale="zh-CN"
            messages={{
              actions: {
                viewDetails: "Open dossier",
              },
              page: {
                title: "Host order cockpit",
              },
            }}
          />
        </MemoryRouter>
      </SdkworkThemeProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Host order cockpit",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open dossier" })).toBeInTheDocument();
  });

  it("falls back to built-in English copy for standalone components without a host intl provider", () => {
    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkOrderStatGrid
          statistics={{
            completed: 5,
            pendingPayment: 2,
            pendingReceipt: 0,
            pendingShipment: 0,
            totalAmountCny: 1599,
            totalOrders: 7,
          }}
        />
      </SdkworkThemeProvider>,
    );

    expect(screen.getByText("Total orders")).toBeInTheDocument();
    expect(screen.getByText("Pending payment")).toBeInTheDocument();
  });

  it("lets standalone order components consume Chinese copy through the intl provider", () => {
    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkOrderIntlProvider locale="zh-CN">
          <SdkworkOrderStatGrid
            statistics={{
              completed: 5,
              pendingPayment: 2,
              pendingReceipt: 0,
              pendingShipment: 0,
              totalAmountCny: 1599,
              totalOrders: 7,
            }}
          />
        </SdkworkOrderIntlProvider>
      </SdkworkThemeProvider>,
    );

    expect(screen.getByText("\u8ba2\u5355\u603b\u91cf")).toBeInTheDocument();
    expect(screen.getByText("\u5f85\u652f\u4ed8")).toBeInTheDocument();
  });
});
