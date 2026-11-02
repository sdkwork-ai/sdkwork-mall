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

/**
 * Structural view of the composed partner app client.
 *
 * Deliberately not `import type` from `@sdkwork/partner-app-sdk`: feature
 * packages must not import a business SDK. The generated client satisfies this
 * shape, and the app bootstrap passes it in.
 */
export interface SdkworkPartnerJoinWireClient {
  readonly join: {
    readonly partnerJoin: {
      retrieve(): Promise<unknown>;
      readonly application: {
        create(body: SdkworkPartnerApplicationWireRequest): Promise<unknown>;
        list(params?: SdkworkPartnerPageWireQuery): Promise<unknown>;
        cancel(applicationId: string): Promise<unknown>;
      };
      readonly inviteCode: {
        retrieve(code: string): Promise<unknown>;
      };
    };
  };
}

export interface SdkworkPartnerPageWireQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SdkworkPartnerApplicationWireRequest {
  readonly applicantType: "INDIVIDUAL" | "ORGANIZATION";
  readonly subjectName?: string;
  readonly contactName: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly targetLevelNo?: number;
  readonly inviteCode?: string;
  readonly businessIntro?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

/** Adapts the composed partner app client to the mall's partner join port. */
export function createSdkworkPartnerJoinPort(
  client: SdkworkPartnerJoinWireClient,
): SdkworkPartnerJoinPort {
  return {
    async cancelApplication(applicationId) {
      return mapApplication(
        asRecord(await client.join.partnerJoin.application.cancel(applicationId)),
      );
    },
    async listMyApplications(query) {
      const page = query?.page ?? DEFAULT_PAGE;
      const pageSize = query?.pageSize ?? DEFAULT_PAGE_SIZE;
      const result = asRecord(
        await client.join.partnerJoin.application.list({ page, pageSize }),
      );
      const items = asArray(result.items).map(mapApplication);
      const pageInfo = asRecord(result.pageInfo);
      return {
        items,
        page: asNumber(pageInfo.page) ?? page,
        pageSize: asNumber(pageInfo.pageSize) ?? pageSize,
        total: asNumber(pageInfo.totalItems) ?? items.length,
      };
    },
    async retrieveProgram() {
      return mapProgram(asRecord(await client.join.partnerJoin.retrieve()));
    },
    async submitApplication(draft) {
      return mapApplication(
        asRecord(
          await client.join.partnerJoin.application.create({
            applicantType: draft.applicantType,
            businessIntro: draft.businessIntro || undefined,
            contactEmail: draft.contactEmail,
            contactName: draft.contactName,
            contactPhone: draft.contactPhone,
            inviteCode: draft.inviteCode || undefined,
            subjectName: draft.subjectName || undefined,
            targetLevelNo: draft.targetLevelNo,
          }),
        ),
      );
    },
    async validateInviteCode(code) {
      return mapInviteCode(asRecord(await client.join.partnerJoin.inviteCode.retrieve(code)));
    },
  };
}

function mapProgram(program: Record<string, unknown>): SdkworkPartnerProgram {
  const rules = asRecord(program.rules);
  return {
    levels: asArray(program.levels).map(mapLevel),
    rules: {
      currency: asText(rules.currency, "CNY"),
      joinFeePolicy: asText(rules.joinFeePolicy),
      minWithdrawalAmount: asText(rules.minWithdrawalAmount, "0"),
      profitMarginRatio: asText(rules.profitMarginRatio, "0"),
    },
  };
}

function mapLevel(level: Record<string, unknown>): SdkworkPartnerLevel {
  return {
    benefits: asArray(level.benefits).map(mapBenefit),
    customerRevenueRatio: asText(level.customerRevenueRatio, "0"),
    joinFee: asText(level.joinFee, "0"),
    joinFeeCommissionRatio: asText(level.joinFeeCommissionRatio, "0"),
    levelNo: asNumber(level.levelNo) ?? 0,
    name: asText(level.name),
    status: toLevelStatus(asText(level.status)),
  };
}

function mapBenefit(benefit: Record<string, unknown>, index: number): SdkworkPartnerBenefit {
  return {
    code: asText(benefit.code),
    name: asText(benefit.name),
    sort: asNumber(benefit.sort) ?? index,
    value: asText(benefit.value),
  };
}

function mapApplication(item: Record<string, unknown>): SdkworkPartnerApplication {
  return {
    approvedPartnerId: asNullableText(item.approvedPartnerId),
    applicantType: asText(item.applicantType) === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL",
    businessIntro: asText(item.businessIntro),
    contactEmail: asText(item.contactEmail),
    contactName: asText(item.contactName),
    contactPhone: asText(item.contactPhone),
    createdAt: asText(item.createdAt),
    id: asText(item.id),
    inviteCode: asText(item.inviteCode),
    inviterPartnerId: asNullableText(item.inviterPartnerId),
    reviewComment: asText(item.reviewComment),
    reviewedAt: asNullableText(item.reviewedAt),
    status: toApplicationStatus(asText(item.status)),
    subjectName: asText(item.subjectName),
    targetLevelNo: asNumber(item.targetLevelNo) ?? 1,
    updatedAt: asText(item.updatedAt),
    uuid: asText(item.uuid),
  };
}

function mapInviteCode(item: Record<string, unknown>): SdkworkPartnerInviteCodePreview {
  return {
    code: asText(item.code),
    levelNo: asNumber(item.levelNo),
    partnerId: asNullableText(item.partnerId),
    partnerName: asText(item.partnerName),
    valid: item.valid === true,
  };
}

function toLevelStatus(value: string): SdkworkPartnerLevelStatus {
  return value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

function toApplicationStatus(value: string): SdkworkPartnerApplication["status"] {
  if (value === "APPROVED" || value === "REJECTED" || value === "CANCELLED") {
    return value;
  }
  return "SUBMITTED";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((entry) => asRecord(entry))
    : [];
}

function asText(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

function asNullableText(value: unknown): string | null {
  return value === null || value === undefined || String(value) === "" ? null : String(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
