import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { configureMallDefaultDataProvider } from "../default-data-service";
import { SdkworkMallDefaultDataPage } from "./DefaultDataPage";
import { createFakeMallDefaultDataPort } from "../../../tests/default-data-fake-port";

function renderPage() {
  return render(<SdkworkMallDefaultDataPage locale="zh-CN" />);
}

describe("mall default data page", () => {
  afterEach(() => {
    configureMallDefaultDataProvider(null);
    window.localStorage.clear();
  });

  it("reports a missing backend API instead of rendering a broken plan", () => {
    configureMallDefaultDataProvider(null);
    renderPage();
    expect(screen.getByText("当前入口未配置后台 API，无法执行默认数据初始化。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });

  it("renders the plan for the active environment", () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "staging", defaultLocale: "zh-CN" });
    const { container } = renderPage();

    expect(screen.getByText("默认数据初始化")).toBeTruthy();
    expect(container.querySelectorAll("[data-default-data-step]").length).toBeGreaterThan(0);
    expect(container.querySelector('[data-default-data-profile="standard"]')).not.toBeNull();
    expect(container.querySelector('[data-default-data-environment="staging"]')).not.toBeNull();
  });

  it("runs a dry run and reports planned writes without touching the port", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "demo", defaultLocale: "zh-CN" });
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "试运行" }));

    await waitFor(() => {
      expect(container.querySelector("[data-default-data-run-result]")).not.toBeNull();
    });
    const result = container.querySelector("[data-default-data-run-result]");
    expect(result?.getAttribute("data-default-data-run-result")).toBe("ok");
    expect(result?.textContent).toContain("计划写入");
    expect(port.calls.created).toEqual([]);
    expect(port.state.cmsPreset).toBeNull();
  });

  it("verifies the environment and reports missing data", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "demo", defaultLocale: "zh-CN" });
    const { container } = renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: "校验数据" })[0]);

    await waitFor(() => {
      expect(container.querySelector("[data-default-data-verification]")).not.toBeNull();
    });
    expect(
      container.querySelector("[data-default-data-verification]")?.getAttribute("data-default-data-verification"),
    ).toBe("failed");
    const categoryCheck = container.querySelector('[data-default-data-check="catalog.categories"]');
    expect(categoryCheck?.querySelector("[data-check-status]")?.textContent).toBe("缺失");
  });
});
