/**
 * Distribution (分销) domain models shared by every mall client root.
 *
 * These types are transport-free: they describe the partner capability the
 * mall presents to a buyer, not the generated SDK wire shape. Adapters in
 * `partner-sdk-port.ts` translate the composed partner app SDK into these
 * models, so a wire-field rename never reaches UI code.
 */

export type SdkworkPartnerApplicantType = "INDIVIDUAL" | "ORGANIZATION";

export type SdkworkPartnerApplicationStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type SdkworkPartnerLevelStatus = "ACTIVE" | "DISABLED";

export interface SdkworkPartnerBenefit {
  readonly code: string;
  readonly name: string;
  readonly value: string;
  readonly sort: number;
}

export interface SdkworkPartnerLevel {
  readonly levelNo: number;
  readonly name: string;
  readonly joinFee: string;
  readonly customerRevenueRatio: string;
  readonly joinFeeCommissionRatio: string;
  readonly status: SdkworkPartnerLevelStatus;
  readonly benefits: readonly SdkworkPartnerBenefit[];
}

export interface SdkworkPartnerRules {
  readonly currency: string;
  readonly profitMarginRatio: string;
  readonly minWithdrawalAmount: string;
  readonly joinFeePolicy: string;
}

export interface SdkworkPartnerProgram {
  readonly levels: readonly SdkworkPartnerLevel[];
  readonly rules: SdkworkPartnerRules;
}

export interface SdkworkPartnerApplication {
  readonly id: string;
  readonly uuid: string;
  readonly applicantType: SdkworkPartnerApplicantType;
  readonly subjectName: string;
  readonly contactName: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly targetLevelNo: number;
  readonly inviteCode: string;
  readonly inviterPartnerId: string | null;
  readonly businessIntro: string;
  readonly status: SdkworkPartnerApplicationStatus;
  readonly reviewComment: string;
  readonly reviewedAt: string | null;
  readonly approvedPartnerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SdkworkPartnerInviteCodePreview {
  readonly code: string;
  readonly valid: boolean;
  readonly partnerId: string | null;
  readonly partnerName: string;
  readonly levelNo: number | null;
}

export interface SdkworkPartnerApplicationDraft {
  readonly applicantType: SdkworkPartnerApplicantType;
  readonly subjectName: string;
  readonly contactName: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly targetLevelNo: number;
  readonly inviteCode: string;
  readonly businessIntro: string;
}

export interface SdkworkPartnerListQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SdkworkPartnerPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * Partner-center projection (team, customers, commissions, withdrawals).
 *
 * The partner capability's app API currently ships the join program only; the
 * self-service read models are a separate contract. The mall therefore exposes
 * this projection through an optional port so the distribution centre can gain
 * team management without changing any presentational component.
 */
export interface SdkworkPartnerCenterProfile {
  readonly partnerId: string;
  readonly name: string;
  readonly levelNo: number;
  readonly levelName: string;
  readonly status: string;
  readonly inviteCode: string;
  readonly joinedAt: string | null;
  readonly parentPartnerName: string;
}

export interface SdkworkPartnerCenterCounts {
  readonly directTeamSize: number;
  readonly teamSize: number;
  readonly customerCount: number;
}

export interface SdkworkPartnerCenterBalance {
  readonly currency: string;
  /** Withdrawable cash (account available balance). */
  readonly available: string;
  /** Amount frozen by pending withdrawals. */
  readonly pending: string;
  /** Lifetime commission credited. */
  readonly settledTotal: string;
  /** Commission already paid out through withdrawals. */
  readonly withdrawn: string;
  /** Same as available; kept as an explicit semantic alias for the UI. */
  readonly withdrawable: string;
  /** Platform minimum withdrawal amount. */
  readonly minWithdrawal: string;
}

export interface SdkworkPartnerCenterSnapshot {
  readonly profile: SdkworkPartnerCenterProfile;
  readonly counts: SdkworkPartnerCenterCounts;
  readonly balance: SdkworkPartnerCenterBalance;
}

/** One team member with that member's own earnings. */
export interface SdkworkPartnerTeamMember {
  readonly partnerId: string;
  readonly name: string;
  readonly levelNo: number;
  readonly levelName: string;
  readonly status: string;
  readonly joinedAt: string | null;
  readonly depth: number;
  readonly directTeamSize: number;
  readonly customerCount: number;
  readonly totalCommission: string;
  readonly availableBalance: string;
}

/** One commission allocation received by the current partner. */
export interface SdkworkPartnerCommissionRecord {
  readonly id: string;
  readonly settlementId: string;
  readonly eventId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly baseAmount: string;
  readonly ratio: string;
  readonly amount: string;
  readonly levelOffset: number;
  readonly status: string;
  readonly computedAt: string;
  readonly createdAt: string;
}

export interface SdkworkPartnerWithdrawal {
  readonly id: string;
  readonly amount: string;
  readonly status: string;
  readonly reviewRemark: string;
  readonly paidAt: string | null;
  readonly remark: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SdkworkPartnerWithdrawalDraft {
  readonly amount: string;
  readonly remark: string;
}

/** Discriminated union that keeps "no data" explicit instead of null-shaped. */
export type SdkworkPartnerCenterAvailability =
  | { readonly available: true; readonly snapshot: SdkworkPartnerCenterSnapshot }
  | {
      readonly available: false;
      readonly reason: "not-configured" | "not-enrolled" | "not-supported";
    };

/** Stable issue codes; the UI owns the localized wording. */
export type SdkworkPartnerDraftIssueCode =
  | "subjectNameRequired"
  | "contactNameRequired"
  | "contactPhoneInvalid"
  | "contactEmailInvalid"
  | "targetLevelInvalid"
  | "inviteCodeTooLong";

export interface SdkworkPartnerDraftIssue {
  readonly code: SdkworkPartnerDraftIssueCode;
  readonly field: keyof SdkworkPartnerApplicationDraft;
}

/** Normalized membership state derived from the application history. */
export type SdkworkPartnerMembershipState =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface SdkworkPartnerMembership {
  readonly state: SdkworkPartnerMembershipState;
  readonly application: SdkworkPartnerApplication | null;
}
