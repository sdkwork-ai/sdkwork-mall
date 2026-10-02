import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";
import { SdkworkOrderPage, createSdkworkOrderController } from "../src";

describe("sdkwork-mall-pc-order page", () => {
  it("renders the reusable order center and links to the order detail page", async () => {
    const controller = createSdkworkOrderController({
      service: {
        cancelOrder: vi.fn(),
        getDashboard: vi.fn().mockResolvedValue({
          orders: [
            {
              createdAt: "2026-04-03T09:00:00.000Z",
              id: "ORDER-3",
              paidAmountCny: 0,
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
        }),
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
            },
          ],
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
          <SdkworkOrderPage controller={controller} />
        </MemoryRouter>
      </SdkworkThemeProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /order center/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pro Monthly")).toBeInTheDocument();

    // 「查看详情」现在导航到可分享/可刷新的订单详情路由。
    const detailsLink = screen.getByRole("link", {
      name: /view details/i,
    });
    expect(detailsLink).toHaveAttribute("href", "/buyer/orders/ORDER-3");
  });

  it("keeps the order hero free of raw white utility styling", () => {
    const pageSource = readFileSync(
      resolve(import.meta.dirname, "../src/pages/OrderPage.tsx"),
      "utf8",
    );

    expect(pageSource).not.toContain("border-white/10");
    expect(pageSource).not.toContain("bg-white/10");
    expect(pageSource).not.toContain("text-white/72");
    expect(pageSource).not.toContain("text-white/60");
  });
});
