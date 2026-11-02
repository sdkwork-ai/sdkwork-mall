import { describe, expect, it, vi } from "vitest";

import { createSdkworkPartnerController } from "@sdkwork/mall-partner-service";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerProgram,
  SdkworkPartnerService,
} from "@sdkwork/mall-partner-service";

const program: SdkworkPartnerProgram = {
  levels: [
    {
      benefits: [],
      customerRevenueRatio: "20.00",
      joinFee: "5999.00",
      joinFeeCommissionRatio: "10.00",
      levelNo: 1,
      name: "Standard",
      status: "ACTIVE",
    },
  ],
  rules: {
    currency: "CNY",
    joinFeePolicy: "policy",
    minWithdrawalAmount: "100.00",
    profitMarginRatio: "40.00",
  },
};

function application(overrides: Partial<SdkworkPartnerApplication> = {}): SdkworkPartnerApplication {
  return {
    approvedPartnerId: null,
    applicantType: "INDIVIDUAL",
    businessIntro: "",
    contactEmail: "buyer@example.com",
    contactName: "Buyer",
    contactPhone: "+86 138 0000 0000",
    createdAt: "2026-11-01T10:00:00Z",
    id: "1",
    inviteCode: "",
    inviterPartnerId: null,
    reviewComment: "",
    reviewedAt: null,
    status: "SUBMITTED",
    subjectName: "Buyer",
    targetLevelNo: 1,
    updatedAt: "2026-11-01T10:00:00Z",
    uuid: "00000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

function fakeService(): SdkworkPartnerService {
  let applications: SdkworkPartnerApplication[] = [application()];
  return {
    cancelApplication: vi.fn(async (id: string) => {
      const updated = application({ id, status: "CANCELLED" });
      applications = applications.map((entry) => (entry.id === id ? updated : entry));
      return updated;
    }),
    createWithdrawal: vi.fn(async () => ({
      amount: "100.00",
      createdAt: "2026-11-01T00:00:00Z",
      id: "1",
      paidAt: null,
      remark: "",
      reviewRemark: "",
      status: "PENDING",
      updatedAt: "2026-11-01T00:00:00Z",
    })),
    listCommissionRecords: vi.fn(async () => null),
    listMyApplications: vi.fn(async () => ({
      items: applications,
      page: 1,
      pageSize: 20,
      total: applications.length,
    })),
    listTeam: vi.fn(async () => null),
    listWithdrawals: vi.fn(async () => null),
    retrieveCenter: vi.fn(async () => ({ available: false as const, reason: "not-configured" as const })),
    retrieveProgram: vi.fn(async () => program),
    submitApplication: vi.fn(async () => {
      const created = application({ id: "2" });
      applications = [created, ...applications];
      return created;
    }),
    validateInviteCode: vi.fn(async (code: string) => ({
      code,
      levelNo: 1,
      partnerId: "9",
      partnerName: "Inviter",
      valid: true,
    })),
  };
}

describe("sdkwork-mall-pc-partner controller", () => {
  it("bootstraps program, applications, membership and the absent center", async () => {
    const controller = createSdkworkPartnerController(fakeService());
    await controller.bootstrap();

    const state = controller.getState();
    expect(state.status).toBe("ready");
    expect(state.program?.levels).toHaveLength(1);
    expect(state.membership.state).toBe("pending");
    expect(state.center).toEqual({ available: false, reason: "not-configured" });
  });

  it("submits an application and moves the membership to pending", async () => {
    const service = fakeService();
    const controller = createSdkworkPartnerController(service);
    await controller.bootstrap();
    controller.openApplyForm();

    const ok = await controller.submitApplication({
      applicantType: "INDIVIDUAL",
      businessIntro: "",
      contactEmail: "buyer@example.com",
      contactName: "Buyer",
      contactPhone: "+86 138 0000 0000",
      inviteCode: "",
      subjectName: "Buyer",
      targetLevelNo: 1,
    });

    expect(ok).toBe(true);
    expect(controller.getState().isApplyFormOpen).toBe(false);
    expect(controller.getState().applications).toHaveLength(2);
  });

  it("cancels a submitted application without dropping the history", async () => {
    const controller = createSdkworkPartnerController(fakeService());
    await controller.bootstrap();

    expect(await controller.cancelApplication("1")).toBe(true);
    expect(controller.getState().applications[0]?.status).toBe("CANCELLED");
    expect(controller.getState().membership.state).toBe("cancelled");
  });

  it("validates an invite code and clears the preview", async () => {
    const controller = createSdkworkPartnerController(fakeService());
    const preview = await controller.validateInvite(" ABC ");
    expect(preview).toMatchObject({ code: "ABC", valid: true });
    expect(controller.getState().invitePreview?.partnerName).toBe("Inviter");
    controller.clearInvitePreview();
    expect(controller.getState().invitePreview).toBeNull();
  });
});
