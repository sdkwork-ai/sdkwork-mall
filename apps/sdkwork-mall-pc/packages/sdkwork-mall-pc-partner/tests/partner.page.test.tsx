import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createSdkworkPartnerController } from "@sdkwork/mall-partner-service";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerService,
} from "@sdkwork/mall-partner-service";

import { SdkworkMallPartnerCenterPage } from "../src/pages/PartnerCenterPage";

const submittedApplication: SdkworkPartnerApplication = {
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

function service(): SdkworkPartnerService {
  return {
    cancelApplication: vi.fn(async () => submittedApplication),
    listMyApplications: vi.fn(async () => ({
      items: [submittedApplication],
      page: 1,
      pageSize: 20,
      total: 1,
    })),
    retrieveCenter: vi.fn(async () => ({ available: false as const, reason: "not-configured" as const })),
    retrieveProgram: vi.fn(async () => ({
      levels: [
        {
          benefits: [{ code: "account_manager", name: "专属客户经理", sort: 0, value: "" }],
          customerRevenueRatio: "20.00",
          joinFee: "5999.00",
          joinFeeCommissionRatio: "10.00",
          levelNo: 1,
          name: "普通代理",
          status: "ACTIVE" as const,
        },
      ],
      rules: {
        currency: "CNY",
        joinFeePolicy: "加盟费按等级一次性缴纳",
        minWithdrawalAmount: "100.00",
        profitMarginRatio: "40.00",
      },
    })),
    submitApplication: vi.fn(async () => submittedApplication),
    validateInviteCode: vi.fn(async (code: string) => ({
      code,
      levelNo: 1,
      partnerId: "9",
      partnerName: "Inviter",
      valid: true,
    })),
  };
}

describe("SdkworkMallPartnerCenterPage", () => {
  it("renders the distribution centre with the program, status and pending center notice", async () => {
    const controller = createSdkworkPartnerController(service());
    render(<SdkworkMallPartnerCenterPage controller={controller} locale="zh-CN" />);

    await waitFor(() => {
      expect(screen.getByText("分销中心")).toBeInTheDocument();
    });
    expect(screen.getByText("申请审核中")).toBeInTheDocument();
    expect(screen.getByText("普通代理")).toBeInTheDocument();
    expect(screen.getByText(/团队、佣金与提现需要合作伙伴自助端读模型接入后展示/)).toBeInTheDocument();
    expect(screen.getByText("我的加盟申请")).toBeInTheDocument();
  });
});
