import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureSdkworkCommerceServiceProvider, type SdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureSdkworkOrderAppServiceProvider, type SdkworkOrderAppService } from "@sdkwork/order-service";

import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  configureOrderServiceMockSession,
  createOrderServiceMock,
  resetCommerceServiceMockSession,
  resetOrderServiceMockSession,
} from "../../../../sdkwork-mall-pc/tests/test-utils/commerce-service-mock";
import {
  configureMallH5AfterSalesMediaRuntimePort,
  resetMallH5AfterSalesMediaRuntimePort,
} from "../src/after-sales-media-port";
import { SdkworkMallH5AfterSalesPage } from "../src/pages/AfterSalesPage";

const ORDER_DETAIL = {
  items: [
    { id: "item-1", priceCny: 89, quantity: 1, spu: { title: "东北五常大米 10kg" } },
  ],
  orderId: "order-1015",
  paidAmount: 89,
  totalAmount: 89,
};

let capturedCreateBody: Record<string, unknown> | null = null;

function renderAfterSalesPage() {
  return render(
    <MemoryRouter initialEntries={["/buyer/after-sales?orderId=order-1015"]}>
      <Routes>
        <Route element={<SdkworkMallH5AfterSalesPage />} path="/buyer/after-sales" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SdkworkMallH5AfterSalesPage evidence upload", () => {
  beforeEach(() => {
    capturedCreateBody = null;
    configureCommerceServiceMockSession();
    configureOrderServiceMockSession();
    const commerceMock = createCommerceServiceMock({
      afterSales: {
        requests: {
          create: vi.fn(async (body: Record<string, unknown>) => {
            capturedCreateBody = body;
            return {};
          }),
          list: vi.fn(async () => ({ items: [], pageInfo: { page: 1, total: 0 } })),
        },
      },
    } as never);
    configureSdkworkCommerceServiceProvider(
      () => commerceMock as SdkworkCommerceService,
    );
    const orderMock = createOrderServiceMock({
      orders: {
        retrieve: vi.fn(async () => ORDER_DETAIL),
      },
    } as never);
    configureSdkworkOrderAppServiceProvider(
      () => orderMock as SdkworkOrderAppService,
    );
    configureMallH5AfterSalesMediaRuntimePort({
      uploadImages: vi.fn(async () => ["drive://space-upload/node-evidence-1"]),
    });
  });

  afterEach(() => {
    resetMallH5AfterSalesMediaRuntimePort();
    resetCommerceServiceMockSession();
    resetOrderServiceMockSession();
    vi.restoreAllMocks();
  });

  it("uploads picked evidence through the host media port and shows the uploaded state", async () => {
    renderAfterSalesPage();
    await screen.findByText("1 项商品 · 实付 ¥89.00");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(["png-bytes"], "evidence.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => expect(screen.getByText("已上传")).toBeTruthy());
    expect(screen.getByAltText("evidence.png")).toBeTruthy();
  });

  it("carries uploaded evidence references into the create payload", async () => {
    renderAfterSalesPage();
    await screen.findByText("1 项商品 · 实付 ¥89.00");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["png-bytes"], "evidence.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => expect(screen.getByText("已上传")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "提交申请" }));
    await waitFor(() => expect(capturedCreateBody).not.toBeNull());
    const snapshot = capturedCreateBody?.evidenceSnapshot as Array<{ reference: string; fileName: string }>;
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].reference).toBe("drive://space-upload/node-evidence-1");
    expect(snapshot[0].fileName).toBe("evidence.png");
  });

  it("refuses evidence when the host media runtime is absent", async () => {
    resetMallH5AfterSalesMediaRuntimePort();
    renderAfterSalesPage();
    await screen.findByText("1 项商品 · 实付 ¥89.00");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["png-bytes"], "evidence.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    expect(await screen.findByText("媒体上传不可用：需要宿主提供存储能力")).toBeTruthy();
  });
});
