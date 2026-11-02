import { describe, expect, it, vi } from "vitest";

import { createSdkworkPartnerService } from "../src/partner-service";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerCenterSnapshot,
  SdkworkPartnerJoinPort,
  SdkworkPartnerProgram,
} from "../src/partner-types";

const program: SdkworkPartnerProgram = {
  levels: [
    {
      benefits: [{ code: "account_manager", name: "Account manager", sort: 0, value: "1" }],
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

function application(): SdkworkPartnerApplication {
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
  };
}

function joinPort(): SdkworkPartnerJoinPort {
  return {
    cancelApplication: vi.fn(async () => application()),
    listMyApplications: vi.fn(async () => ({
      items: [application()],
      page: 1,
      pageSize: 20,
      total: 1,
    })),
    retrieveProgram: vi.fn(async () => program),
    submitApplication: vi.fn(async () => application()),
    validateInviteCode: vi.fn(async (code: string) => ({
      code,
      levelNo: 1,
      partnerId: "9",
      partnerName: "Inviter",
      valid: true,
    })),
  };
}

describe("partner service", () => {
  it("delegates the join journey to the inbound port", async () => {
    const join = joinPort();
    const service = createSdkworkPartnerService({ join });

    await expect(service.retrieveProgram()).resolves.toBe(program);
    await expect(service.validateInviteCode("ABC")).resolves.toMatchObject({ valid: true });
    await expect(service.listMyApplications({ page: 2 })).resolves.toMatchObject({ total: 1 });
    expect(join.listMyApplications).toHaveBeenCalledWith({ page: 2 });
  });

  it("reports the partner center as not configured without a port", async () => {
    const service = createSdkworkPartnerService({ join: joinPort() });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: false,
      reason: "not-configured",
    });
  });

  it("exposes a supplied partner center projection", async () => {
    const snapshot: SdkworkPartnerCenterSnapshot = {
      balance: {
        available: "100.00",
        currency: "CNY",
        pending: "10.00",
        settledTotal: "300.00",
        withdrawable: "90.00",
      },
      counts: { customerCount: 3, directTeamSize: 2, teamSize: 5 },
      profile: {
        inviteCode: "ABC",
        joinedAt: "2026-01-01T00:00:00Z",
        levelName: "Standard",
        levelNo: 1,
        name: "Partner",
        parentPartnerName: "",
        partnerId: "9",
        status: "ACTIVE",
      },
      updatedAt: "2026-11-01T00:00:00Z",
    };
    const service = createSdkworkPartnerService({
      center: { retrieveCenter: async () => snapshot },
      join: joinPort(),
    });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: true,
      snapshot,
    });
  });

  it("downgrades an unsupported center endpoint to not-supported", async () => {
    const service = createSdkworkPartnerService({
      center: {
        retrieveCenter: async () => {
          const error = new Error("not implemented") as Error & { status: number };
          error.status = 501;
          throw error;
        },
      },
      join: joinPort(),
    });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: false,
      reason: "not-supported",
    });
  });
});
