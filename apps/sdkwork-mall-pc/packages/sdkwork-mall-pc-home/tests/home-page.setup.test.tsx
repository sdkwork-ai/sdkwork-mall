import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureMallHomeSeedProvider,
  resetMallHomeSeedState,
} from "../src/home-seed";
import { loadMallHomeSnapshot } from "../src/home-service";
import { SdkworkMallHomePage } from "../src/pages/HomePage";
import { searchMallProducts } from "@sdkwork/mall-pc-search/search-service";

vi.mock("../src/home-service", () => ({
  loadMallHomeSnapshot: vi.fn(),
}));

vi.mock("@sdkwork/mall-pc-cms/cms-service", () => ({
  loadMallCmsConfigRemote: vi.fn(() => Promise.reject(new Error("cms offline"))),
}));

vi.mock("@sdkwork/mall-pc-search/search-service", () => ({
  searchMallProducts: vi.fn(() => Promise.resolve({ items: [], pageInfo: {} })),
}));

vi.mock("@sdkwork/mall-pc-activity/activity-service", () => ({
  formatCountdown: () => ({ days: 0, hours: 0, minutes: 0, seconds: 0 }),
  getActivityCountdownTarget: () => null,
  listMallActivities: () => Promise.resolve([]),
}));

const emptySnapshot = {
  categories: [],
  featuredShops: [],
  hotProducts: [],
  newProducts: [],
  issues: [],
  isEmpty: true,
};

const populatedSnapshot = {
  categories: [{ id: "cat-1", name: "手机数码" }],
  featuredShops: [{ id: "shop-1", name: "星野自营旗舰店" }],
  hotProducts: [{ id: "spu-1", priceCny: 4299, title: "星野 X1 Pro" }],
  newProducts: [{ id: "spu-2", priceCny: 199, title: "星野氮化镓充电器" }],
  issues: [],
  isEmpty: false,
};

const loadSnapshotMock = vi.mocked(loadMallHomeSnapshot);
const searchMock = vi.mocked(searchMallProducts);

function renderHome() {
  return render(
    <MemoryRouter>
      <SdkworkMallHomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetMallHomeSeedState();
  loadSnapshotMock.mockReset();
});

afterEach(() => {
  configureMallHomeSeedProvider(null);
});

describe("storefront home first-run provisioning", () => {
  it("seeds automatically on an empty non-production install, then reloads", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 12, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: true, profile: "demo", run });
    loadSnapshotMock
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValue(populatedSnapshot);

    renderHome();

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("商城还没有商品数据")).toBeNull());
    expect(loadSnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("tops up an existing catalog when the shipped dataset revision changed", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 40, state: "succeeded" as const }));
    configureMallHomeSeedProvider({
      automatic: true,
      needsRefresh: () => true,
      profile: "standard",
      run,
    });
    loadSnapshotMock.mockResolvedValue(populatedSnapshot);

    renderHome();

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    // A populated catalog keeps rendering; the top-up is silent.
    expect(screen.queryByText("商城还没有商品数据")).toBeNull();
  });

  it("waits for an explicit click when the runtime policy disables automatic seeding", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 12, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "demo", run });
    loadSnapshotMock
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValue(populatedSnapshot);

    renderHome();

    await screen.findByText("商城还没有商品数据");
    expect(run).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "载入默认数据" }));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("商城还没有商品数据")).toBeNull());
  });

  it("offers an explicit demo slice when the default profile carries structure only", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 4, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "minimal", run });
    loadSnapshotMock
      .mockResolvedValueOnce(emptySnapshot)
      .mockResolvedValue(populatedSnapshot);

    renderHome();

    await screen.findByText("商城还没有商品数据");
    expect(screen.getByRole("button", { name: "载入基础结构" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "载入演示数据（含商品）" }));

    await waitFor(() => expect(run).toHaveBeenCalledWith({ profile: "demo" }));
  });

  it("still offers provisioning when categories exist but no product is published", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 3, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "demo", run });
    loadSnapshotMock.mockResolvedValue({
      ...emptySnapshot,
      categories: [{ id: "cat-1", name: "手机数码" }],
      isEmpty: false,
    });

    renderHome();

    await screen.findByText("商城还没有商品数据");
    expect(screen.getByRole("button", { name: "载入默认数据" })).toBeTruthy();
  });

  it("surfaces a failed provisioning attempt with a retry action", async () => {
    const run = vi.fn(() =>
      Promise.resolve({ created: 0, message: "商品与 SKU：403 forbidden", state: "failed" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "demo", run });
    loadSnapshotMock.mockResolvedValue(emptySnapshot);

    renderHome();

    await screen.findByText("商城还没有商品数据");
    fireEvent.click(screen.getByRole("button", { name: "载入默认数据" }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("403 forbidden");
    expect(screen.getByRole("button", { name: "重试初始化" })).toBeTruthy();
  });

  it("asks an anonymous visitor to sign in instead of offering a 401 action", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 0, state: "succeeded" as const }));
    configureMallHomeSeedProvider({
      automatic: () => false,
      isSignedIn: () => false,
      profile: "demo",
      run,
    });
    loadSnapshotMock.mockResolvedValue(emptySnapshot);

    renderHome();

    await screen.findByText("商城还没有商品数据");
    expect(screen.getByText("初始化需要后台权限，请先登录管理员账号。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "登录并初始化" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "载入默认数据" })).toBeNull();
  });

  it("fills a shelf from the general list when its keyword matches no product", async () => {
    configureMallHomeSeedProvider(null);
    loadSnapshotMock.mockResolvedValue(populatedSnapshot);
    searchMock.mockImplementation((input) =>
      Promise.resolve({
        items: input.query
          ? []
          : [{ id: "spu-fallback", priceCny: 99, title: "兜底热卖商品" }],
        total: input.query ? 0 : 1,
      }),
    );

    renderHome();

    const titles = await screen.findAllByText("兜底热卖商品");
    expect(titles.length).toBeGreaterThan(0);
    searchMock.mockReset();
  });

  it("explains that no backend is wired instead of offering a dead action", async () => {
    configureMallHomeSeedProvider(null);
    loadSnapshotMock.mockResolvedValue(emptySnapshot);

    renderHome();

    await screen.findByText("商城还没有商品数据");
    expect(screen.getByText("当前构建未接入后台 API，无法初始化默认数据。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "载入默认数据" })).toBeNull();
  });

  it("shows the availability error, not an empty mall, when every read fails", async () => {
    configureMallHomeSeedProvider(null);
    loadSnapshotMock.mockRejectedValue(
      new Error("首页数据加载失败：类目加载失败（connect ECONNREFUSED）"),
    );

    renderHome();

    await screen.findByText("首页暂不可用");
    expect(screen.getByText(/connect ECONNREFUSED/)).toBeTruthy();
    expect(screen.queryByText("商城还没有商品数据")).toBeNull();
  });
});
