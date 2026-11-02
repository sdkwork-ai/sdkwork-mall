import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      items: [submittedApplication],
      page: 1,
      pageSize: 20,
      total: 1,
    })),
    listTeam: vi.fn(async () => null),
    listWithdrawals: vi.fn(async () => null),
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

  it("renders team earnings, commission records and withdrawals when the centre is available", async () => {
    const centerService = service();
    centerService.retrieveCenter = vi.fn(async () => ({
      available: true as const,
      snapshot: {
        balance: {
          available: "120.00",
          currency: "CNY",
          minWithdrawal: "100.00",
          pending: "10.00",
          settledTotal: "580.00",
          withdrawable: "120.00",
          withdrawn: "450.00",
        },
        counts: { customerCount: 3, directTeamSize: 1, teamSize: 2 },
        profile: {
          inviteCode: "ABC123",
          joinedAt: "2026-01-01T00:00:00Z",
          levelName: "普通代理",
          levelNo: 1,
          name: "Partner",
          parentPartnerName: "",
          partnerId: "9",
          status: "ACTIVE",
        },
      },
    }));
    centerService.listTeam = vi.fn(async () => ({
      items: [
        {
          availableBalance: "80.00",
          customerCount: 2,
          depth: 1,
          directTeamSize: 1,
          joinedAt: "2026-02-01T00:00:00Z",
          levelName: "普通代理",
          levelNo: 1,
          name: "Team Member",
          partnerId: "10",
          status: "ACTIVE",
          totalCommission: "200.00",
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    }));
    centerService.listCommissionRecords = vi.fn(async () => ({
      items: [
        {
          amount: "20.00",
          baseAmount: "100.00",
          computedAt: "2026-03-01T00:00:00Z",
          createdAt: "2026-03-01T00:00:00Z",
          eventId: "2",
          id: "3",
          levelOffset: 0,
          ratio: "20.00",
          settlementId: "4",
          sourceRef: "order-1",
          sourceType: "customer_revenue",
          status: "SETTLED",
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    }));
    centerService.listWithdrawals = vi.fn(async () => ({
      items: [
        {
          amount: "100.00",
          createdAt: "2026-04-01T00:00:00Z",
          id: "5",
          paidAt: null,
          remark: "",
          reviewRemark: "",
          status: "PENDING",
          updatedAt: "2026-04-01T00:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    }));

    const controller = createSdkworkPartnerController(centerService);
    render(<SdkworkMallPartnerCenterPage controller={controller} locale="zh-CN" />);

    await waitFor(() => {
      expect(screen.getByText("我的团队")).toBeInTheDocument();
    });
    expect(screen.getByText("Team Member")).toBeInTheDocument();
    expect(screen.getByText("收益记录")).toBeInTheDocument();
    expect(screen.getByText("customer_revenue")).toBeInTheDocument();
    expect(screen.getByText("提现")).toBeInTheDocument();
    expect(screen.getByText("可提现余额")).toBeInTheDocument();
  });

  it("opens the join application in a modal instead of page flow", async () => {
    const modalService = service();
    modalService.listMyApplications = vi.fn(async () => ({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    }));
    const controller = createSdkworkPartnerController(modalService);
    render(<SdkworkMallPartnerCenterPage controller={controller} locale="zh-CN" />);

    fireEvent.click(await screen.findByRole("button", { name: "申请成为分销商" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "加盟申请" })).toBeInTheDocument();
  });
});
