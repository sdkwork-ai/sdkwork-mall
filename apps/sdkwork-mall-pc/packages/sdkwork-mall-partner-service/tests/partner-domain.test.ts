import { describe, expect, it } from "vitest";

import {
  buildSdkworkPartnerInviteLink,
  canCancelSdkworkPartnerApplication,
  formatSdkworkPartnerPercent,
  orderSdkworkPartnerLevels,
  resolveSdkworkPartnerMembership,
  summarizeSdkworkPartnerProgram,
  validateSdkworkPartnerApplicationDraft,
} from "../src/partner-domain";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerLevel,
} from "../src/partner-types";

function application(
  overrides: Partial<SdkworkPartnerApplication> = {},
): SdkworkPartnerApplication {
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

function draft(
  overrides: Partial<SdkworkPartnerApplicationDraft> = {},
): SdkworkPartnerApplicationDraft {
  return {
    applicantType: "INDIVIDUAL",
    businessIntro: "",
    contactEmail: "buyer@example.com",
    contactName: "Buyer",
    contactPhone: "+86 138 0000 0000",
    inviteCode: "",
    subjectName: "Buyer",
    targetLevelNo: 1,
    ...overrides,
  };
}

describe("partner membership resolution", () => {
  it("prefers an approved application over an older rejection", () => {
    const membership = resolveSdkworkPartnerMembership([
      application({ id: "2", status: "APPROVED" }),
      application({ id: "1", status: "REJECTED" }),
    ]);
    expect(membership.state).toBe("approved");
    expect(membership.application?.id).toBe("2");
  });

  it("reports pending while a submitted application exists", () => {
    const membership = resolveSdkworkPartnerMembership([
      application({ id: "3", status: "SUBMITTED" }),
    ]);
    expect(membership.state).toBe("pending");
  });

  it("falls back to the latest closed application", () => {
    expect(
      resolveSdkworkPartnerMembership([application({ status: "REJECTED" })]).state,
    ).toBe("rejected");
    expect(
      resolveSdkworkPartnerMembership([application({ status: "CANCELLED" })]).state,
    ).toBe("cancelled");
    expect(resolveSdkworkPartnerMembership([]).state).toBe("none");
  });

  it("only allows cancelling submitted applications", () => {
    expect(canCancelSdkworkPartnerApplication({ status: "SUBMITTED" })).toBe(true);
    expect(canCancelSdkworkPartnerApplication({ status: "APPROVED" })).toBe(false);
  });
});

describe("partner draft validation", () => {
  it("accepts a complete individual draft", () => {
    expect(validateSdkworkPartnerApplicationDraft(draft())).toEqual([]);
  });

  it("requires a subject name for organization applicants", () => {
    const issues = validateSdkworkPartnerApplicationDraft(
      draft({ applicantType: "ORGANIZATION", subjectName: "  " }),
    );
    expect(issues).toEqual([{ code: "subjectNameRequired", field: "subjectName" }]);
  });

  it("reports stable issue codes for every invalid field", () => {
    const issues = validateSdkworkPartnerApplicationDraft(
      draft({
        contactEmail: "not-an-email",
        contactName: "",
        contactPhone: "abc",
        inviteCode: "x".repeat(65),
        targetLevelNo: 0,
      }),
    );
    expect(issues.map((issue) => issue.code).sort()).toEqual([
      "contactEmailInvalid",
      "contactNameRequired",
      "contactPhoneInvalid",
      "inviteCodeTooLong",
      "targetLevelInvalid",
    ]);
  });
});

describe("partner program helpers", () => {
  const levels: SdkworkPartnerLevel[] = [
    {
      benefits: [],
      customerRevenueRatio: "10.00",
      joinFee: "5999.00",
      joinFeeCommissionRatio: "8.00",
      levelNo: 1,
      name: "Standard",
      status: "ACTIVE",
    },
    {
      benefits: [],
      customerRevenueRatio: "30.00",
      joinFee: "19999.00",
      joinFeeCommissionRatio: "12.00",
      levelNo: 3,
      name: "Gold",
      status: "ACTIVE",
    },
    {
      benefits: [],
      customerRevenueRatio: "40.00",
      joinFee: "89999.00",
      joinFeeCommissionRatio: "20.00",
      levelNo: 7,
      name: "Region",
      status: "DISABLED",
    },
  ];

  it("summarizes only active levels", () => {
    expect(
      summarizeSdkworkPartnerProgram({
        levels,
        rules: {
          currency: "CNY",
          joinFeePolicy: "policy",
          minWithdrawalAmount: "100.00",
          profitMarginRatio: "40.00",
        },
      }),
    ).toEqual({
      levelCount: 2,
      maxCustomerRevenueRatio: "30",
      minJoinFee: "5999",
      topLevelNo: 3,
    });
  });

  it("orders active levels first and ascending", () => {
    expect(orderSdkworkPartnerLevels(levels).map((level) => level.levelNo)).toEqual([1, 3, 7]);
  });

  it("formats ratios and composes invite links", () => {
    expect(formatSdkworkPartnerPercent("20.00", "en-US")).toBe("20%");
    expect(buildSdkworkPartnerInviteLink("https://mall.example.com/", "ABC 123")).toBe(
      "https://mall.example.com?invite=ABC%20123",
    );
    expect(buildSdkworkPartnerInviteLink("", "ABC")).toBe("");
  });
});
