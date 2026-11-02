import { readSdkworkPartnerErrorStatus } from "./partner-sdk-port";
import type {
  SdkworkPartnerCenterPort,
  SdkworkPartnerJoinPort,
} from "./partner-sdk-port";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerCenterAvailability,
  SdkworkPartnerCommissionRecord,
  SdkworkPartnerInviteCodePreview,
  SdkworkPartnerListQuery,
  SdkworkPartnerPage,
  SdkworkPartnerProgram,
  SdkworkPartnerTeamMember,
  SdkworkPartnerWithdrawal,
  SdkworkPartnerWithdrawalDraft,
} from "./partner-types";

export interface CreateSdkworkPartnerServiceInput {
  readonly join: SdkworkPartnerJoinPort;
  /**
   * Partner-centre projection. Omitted when the deployment's app API does not
   * expose the self-service centre; the distribution centre then renders the
   * join journey and an explicit pending notice.
   */
  readonly center?: SdkworkPartnerCenterPort | null;
}

export interface SdkworkPartnerService {
  retrieveProgram(): Promise<SdkworkPartnerProgram>;
  submitApplication(
    draft: SdkworkPartnerApplicationDraft,
  ): Promise<SdkworkPartnerApplication>;
  listMyApplications(
    query?: SdkworkPartnerListQuery,
  ): Promise<SdkworkPartnerPage<SdkworkPartnerApplication>>;
  cancelApplication(applicationId: string): Promise<SdkworkPartnerApplication>;
  validateInviteCode(code: string): Promise<SdkworkPartnerInviteCodePreview>;
  /** Resolves the centre projection without leaking a 404 to the UI. */
  retrieveCenter(): Promise<SdkworkPartnerCenterAvailability>;
  /** `null` when the deployment does not expose the centre. */
  listTeam(
    query?: SdkworkPartnerListQuery,
  ): Promise<SdkworkPartnerPage<SdkworkPartnerTeamMember> | null>;
  listCommissionRecords(
    query?: SdkworkPartnerListQuery,
  ): Promise<SdkworkPartnerPage<SdkworkPartnerCommissionRecord> | null>;
  listWithdrawals(
    query?: SdkworkPartnerListQuery,
  ): Promise<SdkworkPartnerPage<SdkworkPartnerWithdrawal> | null>;
  createWithdrawal(draft: SdkworkPartnerWithdrawalDraft): Promise<SdkworkPartnerWithdrawal>;
}

/** Thrown when a centre command is attempted without a centre port. */
export class SdkworkPartnerCenterUnavailableError extends Error {
  constructor() {
    super("The partner centre is not available in this deployment.");
    this.name = "SdkworkPartnerCenterUnavailableError";
  }
}

export function createSdkworkPartnerService(
  input: CreateSdkworkPartnerServiceInput,
): SdkworkPartnerService {
  const center = input.center ?? null;
  return {
    cancelApplication: (applicationId) => input.join.cancelApplication(applicationId),
    async createWithdrawal(draft) {
      if (!center) {
        throw new SdkworkPartnerCenterUnavailableError();
      }
      return center.createWithdrawal(draft);
    },
    async listCommissionRecords(query) {
      return center ? center.listCommissionRecords(query) : null;
    },
    async listTeam(query) {
      return center ? center.listTeam(query) : null;
    },
    async listWithdrawals(query) {
      return center ? center.listWithdrawals(query) : null;
    },
    listMyApplications: (query) => input.join.listMyApplications(query),
    retrieveCenter: async () => {
      if (!center) {
        return { available: false, reason: "not-configured" };
      }
      try {
        return { available: true, snapshot: await center.retrieveCenter() };
      } catch (error) {
        const status = readSdkworkPartnerErrorStatus(error);
        if (status === 404) {
          // The signed-in user has no partner record yet.
          return { available: false, reason: "not-enrolled" };
        }
        if (status === 501) {
          return { available: false, reason: "not-supported" };
        }
        throw error;
      }
    },
    retrieveProgram: () => input.join.retrieveProgram(),
    submitApplication: (draft) => input.join.submitApplication(draft),
    validateInviteCode: (code) => input.join.validateInviteCode(code),
  };
}
