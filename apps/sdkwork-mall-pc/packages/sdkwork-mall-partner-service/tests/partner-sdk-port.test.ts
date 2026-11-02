import { describe, expect, it } from "vitest";

import { createSdkworkPartnerJoinPort } from "../src/partner-sdk-port";
import type { SdkworkPartnerJoinWireClient } from "../src/partner-sdk-port";

function wireClient(): SdkworkPartnerJoinWireClient {
  return {
    join: {
      partnerJoin: {
        application: {
          async cancel(applicationId) {
            return {
              approvedPartnerId: null,
              applicantType: "INDIVIDUAL",
              businessIntro: "",
              contactEmail: "buyer@example.com",
              contactName: "Buyer",
              contactPhone: "+86 138 0000 0000",
              createdAt: "2026-11-01T10:00:00Z",
              id: applicationId,
              inviteCode: "",
              inviterPartnerId: null,
              reviewComment: "",
              reviewedAt: null,
              status: "CANCELLED",
              subjectName: "Buyer",
              targetLevelNo: 1,
              updatedAt: "2026-11-01T10:00:00Z",
              uuid: "00000000-0000-0000-0000-000000000001",
            };
          },
          async create(body) {
            return {
              applicantType: body.applicantType,
              contactEmail: body.contactEmail,
              contactName: body.contactName,
              contactPhone: body.contactPhone,
              createdAt: "2026-11-01T10:00:00Z",
              id: "7",
              inviteCode: body.inviteCode ?? "",
              status: "SUBMITTED",
              subjectName: body.subjectName ?? "",
              targetLevelNo: body.targetLevelNo ?? 1,
            };
          },
          async list() {
            return {
              items: [
                {
                  applicantType: "ORGANIZATION",
                  contactEmail: "buyer@example.com",
                  contactName: "Buyer",
                  contactPhone: "+86 138 0000 0000",
                  createdAt: "2026-11-01T10:00:00Z",
                  id: "1",
                  inviteCode: "ABC",
                  status: "APPROVED",
                  subjectName: "Example Ltd",
                  targetLevelNo: 2,
                },
              ],
              pageInfo: { page: "2", pageSize: "10", totalItems: "11" },
            };
          },
        },
        async retrieve() {
          return {
            levels: [
              {
                benefits: [{ code: "account_manager", name: "Account manager", value: "1", sort: 0 }],
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
        },
        inviteCode: {
          async retrieve(code) {
            return { code, levelNo: 2, partnerId: "9", partnerName: "Inviter", valid: true };
          },
        },
      },
    },
  };
}

describe("partner SDK port adapter", () => {
  it("maps the program catalogue without leaking wire shapes", async () => {
    const port = createSdkworkPartnerJoinPort(wireClient());
    const program = await port.retrieveProgram();
    expect(program.levels[0]).toMatchObject({
      levelNo: 1,
      name: "Standard",
      status: "ACTIVE",
    });
    expect(program.levels[0]?.benefits[0]).toMatchObject({ code: "account_manager", sort: 0 });
    expect(program.rules.currency).toBe("CNY");
  });

  it("maps list pagination from int64 strings", async () => {
    const port = createSdkworkPartnerJoinPort(wireClient());
    const page = await port.listMyApplications({ page: 2, pageSize: 10 });
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(10);
    expect(page.total).toBe(11);
    expect(page.items[0]).toMatchObject({ applicantType: "ORGANIZATION", status: "APPROVED" });
  });

  it("maps create, cancel and invite-code results with safe defaults", async () => {
    const port = createSdkworkPartnerJoinPort(wireClient());
    const created = await port.submitApplication({
      applicantType: "ORGANIZATION",
      businessIntro: "",
      contactEmail: "buyer@example.com",
      contactName: "Buyer",
      contactPhone: "+86 138 0000 0000",
      inviteCode: "ABC",
      subjectName: "Example Ltd",
      targetLevelNo: 2,
    });
    expect(created).toMatchObject({ id: "7", status: "SUBMITTED", inviteCode: "ABC" });

    const cancelled = await port.cancelApplication("7");
    expect(cancelled.status).toBe("CANCELLED");

    const preview = await port.validateInviteCode("ABC");
    expect(preview).toEqual({
      code: "ABC",
      levelNo: 2,
      partnerId: "9",
      partnerName: "Inviter",
      valid: true,
    });
  });

  it("degrades malformed records to explicit empty values", async () => {
    const port = createSdkworkPartnerJoinPort({
      join: {
        partnerJoin: {
          application: {
            cancel: async () => null,
            create: async () => ({}),
            list: async () => ({ items: [null, "bad", { id: "3" }] }),
          },
          retrieve: async () => ({ levels: [null], rules: {} }),
          inviteCode: { retrieve: async () => ({}) },
        },
      },
    });

    const program = await port.retrieveProgram();
    expect(program.levels[0]).toMatchObject({ levelNo: 0, status: "ACTIVE" });
    const page = await port.listMyApplications();
    expect(page.items).toHaveLength(3);
    expect(page.items[2]).toMatchObject({ id: "3", status: "SUBMITTED", targetLevelNo: 1 });
    await expect(port.cancelApplication("1")).resolves.toMatchObject({ id: "" });
  });
});
