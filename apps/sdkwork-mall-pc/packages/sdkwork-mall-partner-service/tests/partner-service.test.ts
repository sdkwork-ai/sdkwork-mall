import { describe, expect, it, vi } from "vitest";

import { createSdkworkPartnerService } from "../src/partner-service";
import type { SdkworkPartnerCenterPort, SdkworkPartnerJoinPort } from "../src/partner-sdk-port";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerCenterSnapshot,
  SdkworkPartnerProgram,
} from "../src/partner-types";

function centerPort(
  overrides: Partial<SdkworkPartnerCenterPort> = {},
): SdkworkPartnerCenterPort {
  return {
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
    listCommissionRecords: vi.fn(async () => ({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    })),
    listTeam: vi.fn(async () => ({ items: [], page: 1, pageSize: 10, total: 0 })),
    listWithdrawals: vi.fn(async () => ({ items: [], page: 1, pageSize: 10, total: 0 })),
    retrieveCenter: vi.fn(async () => {
      throw new Error("center fixture must override retrieveCenter");
    }),
    ...overrides,
  };
}

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
        minWithdrawal: "100.00",
        pending: "10.00",
        settledTotal: "300.00",
        withdrawable: "90.00",
        withdrawn: "200.00",
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
    };
    const service = createSdkworkPartnerService({
      center: centerPort({ retrieveCenter: async () => snapshot }),
      join: joinPort(),
    });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: true,
      snapshot,
    });
  });

  it("maps a 404 to the not-enrolled state", async () => {
    const service = createSdkworkPartnerService({
      center: centerPort({
        retrieveCenter: async () => {
          const error = new Error("not a partner") as Error & { httpStatus: number };
          error.httpStatus = 404;
          throw error;
        },
      }),
      join: joinPort(),
    });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: false,
      reason: "not-enrolled",
    });
  });

  it("downgrades an unsupported center endpoint to not-supported", async () => {
    const service = createSdkworkPartnerService({
      center: centerPort({
        retrieveCenter: async () => {
          const error = new Error("not implemented") as Error & { status: number };
          error.status = 501;
          throw error;
        },
      }),
      join: joinPort(),
    });
    await expect(service.retrieveCenter()).resolves.toEqual({
      available: false,
      reason: "not-supported",
    });
  });
});
