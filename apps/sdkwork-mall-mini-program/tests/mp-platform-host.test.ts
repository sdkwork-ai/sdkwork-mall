/**
 * Contracts for the page-facing platform facade and the host adapters it projects.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. Pages call
 * `platform.*`; the facade resolves the installed host per call, so a test can
 * swap the host and assert the behaviour without a platform runtime.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { createMpHostError } from "@sdkwork/mall-mp-host";
import { createMemoryHost, type MemoryHost } from "@sdkwork/mall-mp-host/testing";
import {
  getMallMpPlatform,
  initializeMallMpRuntime,
  platform,
  resetMallMpRuntime,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";

const ENVIRONMENT = {
  appApiBaseUrl: "https://api.test/app/v3/api",
  environment: "development",
  deploymentProfile: "standalone",
  profileId: "standalone.development",
} as const;

function boot(host: MemoryHost): MallMpRuntime {
  resetMallMpRuntime();
  return initializeMallMpRuntime({ environment: { ...ENVIRONMENT }, host });
}

/** Replaces one adapter so a failure path can be exercised. */
function withBrokenNavigation(host: MemoryHost): MemoryHost {
  return Object.assign({}, host, {
    navigation: {
      ...host.navigation,
      navigateTo: async () => {
        throw createMpHostError("unavailable", "page stack is full");
      },
      redirectTo: async (url: string) => {
        host.recorder.navigations.push(`redirectTo:${url}`);
      },
      switchTab: async (url: string) => {
        host.recorder.navigations.push(`switchTab:${url}`);
      },
      back: async () => {
        throw createMpHostError("invalid-state", "already at the first page");
      },
    },
  });
}

describe("platform facade", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("projects feedback, clipboard and lifecycle onto the host", async () => {
    const host = createMemoryHost();
    boot(host);
    const api = getMallMpPlatform();

    api.toast("已加入购物车", "success");
    api.toast("加载失败");
    await api.copy("https://example.test/x");
    api.stopPullDownRefresh();
    await api.alert({ title: "提示", content: "订单已提交" });

    expect(host.recorder.toasts).toEqual(["success:已加入购物车", "加载失败"]);
    expect(host.recorder.clipboard).toEqual(["https://example.test/x"]);
    expect(host.recorder.navigations).toContain("stopPullDownRefresh");
  });

  it("sets and clears the tab bar badge through the host", () => {
    const host = createMemoryHost();
    boot(host);
    const api = getMallMpPlatform();

    api.tabBarBadge(3, "2");
    api.tabBarBadge(3);

    expect(host.recorder.navigations).toContain("tabBarBadge:3:2");
    expect(host.recorder.navigations).toContain("tabBarBadgeRemoved:3");
  });

  it("returns the confirm answer as a boolean instead of a callback", async () => {
    expect(await (boot(createMemoryHost({ confirmAnswer: true })), platform.confirm({ title: "删除", content: "确定？" })))
      .toBe(true);
    expect(await (boot(createMemoryHost({ confirmAnswer: false })), platform.confirm({ title: "删除", content: "确定？" })))
      .toBe(false);
  });

  it("opens a capability page and passes the EventChannel through", async () => {
    const host = createMemoryHost();
    boot(host);
    const handler = () => undefined;

    platform.navigateTo("/pages/address/index?picker=1", { events: { addressPicked: handler } });

    expect(host.recorder.navigations).toContain("navigateTo:/pages/address/index?picker=1");
    expect(host.recorder.eventChannels[0]).toMatchObject({ url: "/pages/address/index?picker=1" });
    expect(host.recorder.eventChannels[0].handlers.addressPicked).toBe(handler);
  });

  it("falls back to a redirect when navigation fails", () => {
    const host = withBrokenNavigation(createMemoryHost());
    resetMallMpRuntime();
    initializeMallMpRuntime({ environment: { ...ENVIRONMENT }, host });

    platform.navigateTo("/pages/checkout/index?items=1", { fallbackUrl: "/pages/cart/index" });
    platform.redirectTo("/pages/checkout/index?items=1", "/pages/cart/index");
    platform.back({ url: "/pages/orders/index" });
    platform.back({ tab: true, url: "/pages/cart/index" });

    // Navigation is fire-and-forget; the fallback lands on the next microtask.
    return Promise.resolve().then(() => {
      expect(host.recorder.navigations).toContain("redirectTo:/pages/cart/index");
      expect(host.recorder.navigations).toContain("redirectTo:/pages/orders/index");
      expect(host.recorder.navigations).toContain("switchTab:/pages/cart/index");
    });
  });

  it("previews images only when the gallery is not empty", async () => {
    const host = createMemoryHost();
    boot(host);

    platform.previewImages({ current: "a.jpg", urls: [] });
    platform.previewImages({ current: "a.jpg", urls: ["a.jpg", "b.jpg"] });

    expect(host.recorder.navigations.filter((entry) => entry === "previewImages")).toHaveLength(1);
  });

  it("hands media picking and byte reads to the host", async () => {
    const host = createMemoryHost({
      images: [{ path: "/tmp/a.jpg", sizeBytes: 1024, contentType: "image/jpeg" }],
    });
    boot(host);

    const chosen = await platform.chooseImages({ maxCount: 3, maxSizeBytes: 5_242_880 });
    const bytes = await platform.readBytes("/tmp/a.jpg");

    expect(chosen[0]).toMatchObject({ path: "/tmp/a.jpg", contentType: "image/jpeg" });
    expect(bytes).toBeInstanceOf(ArrayBuffer);
  });

  it("surfaces a cancelled platform cashier as a cancellable error", async () => {
    const host = createMemoryHost();
    const broken = Object.assign({}, host, {
      payment: {
        requestPayment: async () => {
          throw createMpHostError("cancelled", "支付已取消");
        },
      },
    });
    resetMallMpRuntime();
    initializeMallMpRuntime({ environment: { ...ENVIRONMENT }, host: broken });

    await expect(platform.requestPayment({
      nonceStr: "n",
      package: "prepay_id=1",
      paySign: "s",
      signType: "RSA",
      timeStamp: "1700000000",
    })).rejects.toMatchObject({ code: "cancelled" });
  });

  it("reports the release channel from the host profile", () => {
    const host = createMemoryHost({ accountEnvVersion: "release" });
    boot(host);
    expect(host.deviceInfo.accountEnvVersion()).toBe("release");
    expect(host.deviceInfo.platform()).toBe("weixin");
  });
});
