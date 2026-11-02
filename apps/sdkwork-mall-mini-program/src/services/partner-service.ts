/**
 * Distribution (分销) wire adapter for the mini program.
 *
 * Contract: the partner capability's app API under the same app-api gateway
 * (`/app/v3/api/partner_join`). The transport unwraps `data`, so single
 * resources arrive as `{ item }` and lists as `{ items, pageInfo }`.
 *
 * The mini program is a runtime that cannot consume the generated TypeScript
 * SDK package, so this adapter re-implements the boundary mapping. It must stay
 * field-compatible with `@sdkwork/mall-partner-service`.
 */
import { request } from "./transport";
import { asNumber, asRecord, asRecordList, asString, type MpRecord } from "../types/common";

export type MpPartnerApplicantType = "INDIVIDUAL" | "ORGANIZATION";
export type MpPartnerApplicationStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface MpPartnerBenefit {
  code: string;
  name: string;
  value: string;
}

export interface MpPartnerLevel {
  levelNo: number;
  name: string;
  joinFee: string;
  customerRevenueRatio: string;
  joinFeeCommissionRatio: string;
  status: "ACTIVE" | "DISABLED";
  benefits: MpPartnerBenefit[];
}

export interface MpPartnerProgram {
  levels: MpPartnerLevel[];
  rules: {
    currency: string;
    profitMarginRatio: string;
    minWithdrawalAmount: string;
    joinFeePolicy: string;
  };
}

export interface MpPartnerApplication {
  id: string;
  applicantType: MpPartnerApplicantType;
  subjectName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  targetLevelNo: number;
  inviteCode: string;
  status: MpPartnerApplicationStatus;
  reviewComment: string;
  createdAt: string;
}

export interface MpPartnerInvitePreview {
  code: string;
  valid: boolean;
  partnerName: string;
  levelNo: number | null;
}

export interface MpPartnerApplicationDraft {
  applicantType: MpPartnerApplicantType;
  subjectName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  targetLevelNo: number;
  inviteCode: string;
  businessIntro: string;
}

function readLevel(item: MpRecord): MpPartnerLevel {
  return {
    benefits: asRecordList(item.benefits).map((benefit) => ({
      code: asString(benefit, ["code"]),
      name: asString(benefit, ["name"]),
      value: asString(benefit, ["value"]),
    })),
    customerRevenueRatio: asString(item, ["customerRevenueRatio"], "0"),
    joinFee: asString(item, ["joinFee"], "0"),
    joinFeeCommissionRatio: asString(item, ["joinFeeCommissionRatio"], "0"),
    levelNo: asNumber(item, ["levelNo"]) ?? 0,
    name: asString(item, ["name"], "—"),
    status: asString(item, ["status"]) === "DISABLED" ? "DISABLED" : "ACTIVE",
  };
}

function readApplication(item: MpRecord): MpPartnerApplication {
  const status = asString(item, ["status"]).toUpperCase();
  return {
    applicantType: asString(item, ["applicantType"]) === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL",
    contactEmail: asString(item, ["contactEmail"]),
    contactName: asString(item, ["contactName"]),
    contactPhone: asString(item, ["contactPhone"]),
    createdAt: asString(item, ["createdAt"]),
    id: asString(item, ["id"]),
    inviteCode: asString(item, ["inviteCode"]),
    reviewComment: asString(item, ["reviewComment"]),
    status:
      status === "APPROVED" || status === "REJECTED" || status === "CANCELLED"
        ? status
        : "SUBMITTED",
    subjectName: asString(item, ["subjectName"]),
    targetLevelNo: asNumber(item, ["targetLevelNo"]) ?? 1,
  };
}

export async function retrievePartnerProgram(): Promise<MpPartnerProgram> {
  const payload = await request({ path: "/partner_join" });
  const item = asRecord(payload.item);
  const rules = asRecord(item.rules);
  return {
    levels: asRecordList(item.levels).map(readLevel),
    rules: {
      currency: asString(rules, ["currency"], "CNY"),
      joinFeePolicy: asString(rules, ["joinFeePolicy"]),
      minWithdrawalAmount: asString(rules, ["minWithdrawalAmount"], "0"),
      profitMarginRatio: asString(rules, ["profitMarginRatio"], "0"),
    },
  };
}

export async function listMyPartnerApplications(
  page = 1,
  pageSize = 20,
): Promise<MpPartnerApplication[]> {
  const payload = await request({
    path: "/partner_join/applications/mine",
    query: { page, page_size: pageSize },
  });
  return asRecordList(payload.items).map(readApplication);
}

export async function submitPartnerApplication(
  draft: MpPartnerApplicationDraft,
): Promise<MpPartnerApplication> {
  const payload = await request({
    body: {
      applicantType: draft.applicantType,
      businessIntro: draft.businessIntro || undefined,
      contactEmail: draft.contactEmail,
      contactName: draft.contactName,
      contactPhone: draft.contactPhone,
      inviteCode: draft.inviteCode || undefined,
      subjectName: draft.subjectName || undefined,
      targetLevelNo: draft.targetLevelNo,
    },
    method: "POST",
    path: "/partner_join/applications",
  });
  return readApplication(asRecord(payload.item));
}

export async function cancelPartnerApplication(
  applicationId: string,
): Promise<MpPartnerApplication> {
  const payload = await request({
    method: "POST",
    path: `/partner_join/applications/${encodeURIComponent(applicationId)}/cancel`,
  });
  return readApplication(asRecord(payload.item));
}

export async function validatePartnerInviteCode(
  code: string,
): Promise<MpPartnerInvitePreview> {
  const payload = await request({
    path: `/partner_join/invite_codes/${encodeURIComponent(code)}`,
  });
  const item = asRecord(payload.item);
  return {
    code: asString(item, ["code"], code),
    levelNo: asNumber(item, ["levelNo"]),
    partnerName: asString(item, ["partnerName"]),
    valid: item.valid === true,
  };
}

export type MpPartnerIssueCode =
  | "subjectNameRequired"
  | "contactNameRequired"
  | "contactPhoneInvalid"
  | "contactEmailInvalid"
  | "targetLevelInvalid"
  | "inviteCodeTooLong";

/** Same issue codes and rules as `@sdkwork/mall-partner-service`. */
export function validatePartnerDraft(
  draft: MpPartnerApplicationDraft,
): MpPartnerIssueCode[] {
  const issues: MpPartnerIssueCode[] = [];
  if (draft.applicantType === "ORGANIZATION" && draft.subjectName.trim() === "") {
    issues.push("subjectNameRequired");
  }
  if (draft.contactName.trim() === "") {
    issues.push("contactNameRequired");
  }
  if (!/^[+\d][\d\s()-]{4,24}$/u.test(draft.contactPhone.trim())) {
    issues.push("contactPhoneInvalid");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(draft.contactEmail.trim())) {
    issues.push("contactEmailInvalid");
  }
  if (!Number.isInteger(draft.targetLevelNo) || draft.targetLevelNo < 1) {
    issues.push("targetLevelInvalid");
  }
  if (draft.inviteCode.trim().length > 64) {
    issues.push("inviteCodeTooLong");
  }
  return issues;
}

/** Membership state derived from the newest-first application history. */
export function resolvePartnerMembershipState(
  applications: MpPartnerApplication[],
): "none" | "pending" | "approved" | "rejected" | "cancelled" {
  if (applications.some((application) => application.status === "APPROVED")) {
    return "approved";
  }
  if (applications.some((application) => application.status === "SUBMITTED")) {
    return "pending";
  }
  const latest = applications[0];
  if (!latest) {
    return "none";
  }
  if (latest.status === "REJECTED") {
    return "rejected";
  }
  if (latest.status === "CANCELLED") {
    return "cancelled";
  }
  return "none";
}

