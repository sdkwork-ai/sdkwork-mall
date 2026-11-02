import type {
  InviteCodeValidateItem,
  PartnerJoinApplicationItem,
  PartnerJoinProgramItem,
  SdkworkAppClient,
} from "@sdkwork/partner-app-sdk";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerBenefit,
  SdkworkPartnerCenterSnapshot,
  SdkworkPartnerInviteCodePreview,
  SdkworkPartnerLevel,
  SdkworkPartnerLevelStatus,
  SdkworkPartnerListQuery,
  SdkworkPartnerPage,
  SdkworkPartnerProgram,
} from "./partner-types";

/**
 * Inbound port for the partner join capability.
 *
 * The port exists so UI and state code depend on the mall's domain contract
 * rather than on the generated partner app SDK. A new transport (for example a
 * future composed federated surface) can satisfy the same port.
 */
export interface SdkworkPartnerJoinPort {
  retrieveProgram(): Promise<SdkworkPartnerProgram>;
  submitApplication(
    draft: SdkworkPartnerApplicationDraft,
  ): Promise<SdkworkPartnerApplication>;
  listMyApplications(
    query?: SdkworkPartnerListQuery,
  ): Promise<SdkworkPartnerPage<SdkworkPartnerApplication>>;
  cancelApplication(applicationId: string): Promise<SdkworkPartnerApplication>;
  validateInviteCode(code: string): Promise<SdkworkPartnerInviteCodePreview>;
}

/**
 * Optional outbound port for partner self-service read models (team, customer,
 * commission, withdrawal projections). Kept separate from the join port so the
 * join flow never depends on an unlanded contract and adding the centre later
 * is a pure extension (open/closed principle).
 */
export interface SdkworkPartnerCenterPort {
  retrieveCenter(): Promise<SdkworkPartnerCenterSnapshot>;
}

export type SdkworkPartnerJoinSdkClient = Pick<SdkworkAppClient, "join">;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

/** Adapts the composed partner app SDK to the mall's partner join port. */
export function createSdkworkPartnerJoinPort(
  client: SdkworkPartnerJoinSdkClient,
): SdkworkPartnerJoinPort {
  return {
    async cancelApplication(applicationId) {
      const item = await client.join.partnerJoin.application.cancel(applicationId);
      return mapApplication(item);
    },
    async listMyApplications(query) {
      const page = query?.page ?? DEFAULT_PAGE;
      const pageSize = query?.pageSize ?? DEFAULT_PAGE_SIZE;
      const result = await client.join.partnerJoin.application.list({ page, pageSize });
      return {
        items: result.items.map(mapApplication),
        page: toCount(result.pageInfo.page, page),
        pageSize: toCount(result.pageInfo.pageSize, pageSize),
        total: toCount(result.pageInfo.totalItems, result.items.length),
      };
    },
    async retrieveProgram() {
      return mapProgram(await client.join.partnerJoin.retrieve());
    },
    async submitApplication(draft) {
      const item = await client.join.partnerJoin.application.create({
        applicantType: draft.applicantType,
        businessIntro: draft.businessIntro || undefined,
        contactEmail: draft.contactEmail,
        contactName: draft.contactName,
        contactPhone: draft.contactPhone,
        inviteCode: draft.inviteCode || undefined,
        subjectName: draft.subjectName || undefined,
        targetLevelNo: draft.targetLevelNo,
      });
      return mapApplication(item);
    },
    async validateInviteCode(code) {
      return mapInviteCode(await client.join.partnerJoin.inviteCode.retrieve(code));
    },
  };
}

function mapProgram(program: PartnerJoinProgramItem): SdkworkPartnerProgram {
  return {
    levels: program.levels.map(mapLevel),
    rules: {
      currency: program.rules.currency,
      joinFeePolicy: program.rules.joinFeePolicy,
      minWithdrawalAmount: program.rules.minWithdrawalAmount,
      profitMarginRatio: program.rules.profitMarginRatio,
    },
  };
}

function mapLevel(level: PartnerJoinProgramItem["levels"][number]): SdkworkPartnerLevel {
  return {
    benefits: level.benefits.map(mapBenefit),
    customerRevenueRatio: level.customerRevenueRatio,
    joinFee: level.joinFee,
    joinFeeCommissionRatio: level.joinFeeCommissionRatio,
    levelNo: level.levelNo,
    name: level.name,
    status: toLevelStatus(level.status),
  };
}

function mapBenefit(
  benefit: PartnerJoinProgramItem["levels"][number]["benefits"][number],
  index: number,
): SdkworkPartnerBenefit {
  return {
    code: benefit.code,
    name: benefit.name,
    sort: typeof benefit.sort === "number" ? benefit.sort : index,
    value: benefit.value ?? "",
  };
}

function mapApplication(item: PartnerJoinApplicationItem): SdkworkPartnerApplication {
  return {
    approvedPartnerId: item.approvedPartnerId ?? null,
    applicantType: item.applicantType,
    businessIntro: item.businessIntro ?? "",
    contactEmail: item.contactEmail,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    createdAt: item.createdAt,
    id: item.id,
    inviteCode: item.inviteCode,
    inviterPartnerId: item.inviterPartnerId ?? null,
    reviewComment: item.reviewComment,
    reviewedAt: item.reviewedAt ?? null,
    status: item.status,
    subjectName: item.subjectName,
    targetLevelNo: item.targetLevelNo,
    updatedAt: item.updatedAt,
    uuid: item.uuid,
  };
}

function mapInviteCode(item: InviteCodeValidateItem): SdkworkPartnerInviteCodePreview {
  return {
    code: item.code,
    levelNo: typeof item.levelNo === "number" ? item.levelNo : null,
    partnerId: item.partnerId ?? null,
    partnerName: item.partnerName ?? "",
    valid: item.valid,
  };
}

function toLevelStatus(value: string): SdkworkPartnerLevelStatus {
  return value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

function toCount(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Error text extraction without leaking transport internals into the UI. */
export function readSdkworkPartnerErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "detail", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return "";
}

export function readSdkworkPartnerErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const record = error as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  const response = record.response;
  if (response && typeof response === "object") {
    const status = (response as Record<string, unknown>).status;
    if (typeof status === "number") {
      return status;
    }
  }
  return null;
}
