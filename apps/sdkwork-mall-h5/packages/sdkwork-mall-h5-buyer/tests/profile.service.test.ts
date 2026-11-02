import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureSdkworkCommerceServiceProvider,
  type SdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import { configureSdkworkOrderSessionTokenProvider } from "@sdkwork/order-service";

import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  resetCommerceServiceMockSession,
} from "../../../../sdkwork-mall-pc/tests/test-utils/commerce-service-mock";
import { loadMallH5Profile, loadMallH5SecuritySnapshot } from "../src/profile-service";
import { loadMallH5PendingReviewOrders } from "../src/reviews-service";

describe("sdkwork-mall-h5-buyer account capability services", () => {
  beforeEach(() => {
    configureCommerceServiceMockSession({ authToken: "h5-account-auth-token" });
  });

  afterEach(() => {
    resetCommerceServiceMockSession();
    configureSdkworkCommerceServiceProvider(null);
    configureSdkworkOrderSessionTokenProvider(null);
  });

  function useCommerceMock(overrides: Parameters<typeof createCommerceServiceMock>[0]) {
    configureSdkworkCommerceServiceProvider(
      (): SdkworkCommerceService => createCommerceServiceMock(overrides) as SdkworkCommerceService,
    );
  }

  function useAccountSummary(retrieve: () => Promise<unknown>) {
    useCommerceMock({
      accounts: {
        current: { summary: { retrieve: vi.fn().mockImplementation(retrieve) } },
      },
    } as never);
  }

  it("maps the current-account summary onto the shared profile fields", async () => {
    useAccountSummary(async () => ({
      code: 0,
      data: {
        displayName: "张三",
        email: "zhangsan@example.com",
        membershipLevel: "黄金会员",
        phone: "13800000000",
      },
    }));

    await expect(loadMallH5Profile()).resolves.toEqual({
      displayName: "张三",
      email: "zhangsan@example.com",
      membershipLevel: "黄金会员",
      phone: "13800000000",
    });
  });

  it("renders blank profile fields instead of failing when the summary omits them", async () => {
    useAccountSummary(async () => ({ code: 0, data: { displayName: "李四" } }));

    await expect(loadMallH5Profile()).resolves.toEqual({
      displayName: "李四",
      email: "",
      membershipLevel: "",
      phone: "",
    });
  });

  it("keeps the security screen usable when the account summary is unavailable", async () => {
    useAccountSummary(async () => {
      throw new Error("account summary unavailable");
    });

    await expect(loadMallH5SecuritySnapshot()).resolves.toEqual({
      accountLabel: "SDKWork 用户",
      organizationId: undefined,
      sessionId: undefined,
      tenantId: undefined,
      userId: undefined,
    });
  });

  it("lists no review candidates while the buyer is signed out", async () => {
    configureSdkworkOrderSessionTokenProvider(() => ({}));

    await expect(loadMallH5PendingReviewOrders()).resolves.toEqual([]);
  });
});
