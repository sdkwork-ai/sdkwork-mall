import {
  readSdkworkPartnerErrorStatus,
} from "./partner-sdk-port";
import type {
  SdkworkPartnerCenterPort,
  SdkworkPartnerJoinPort,
} from "./partner-sdk-port";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerCenterAvailability,
  SdkworkPartnerInviteCodePreview,
  SdkworkPartnerListQuery,
  SdkworkPartnerPage,
  SdkworkPartnerProgram,
} from "./partner-types";

export interface CreateSdkworkPartnerServiceInput {
  readonly join: SdkworkPartnerJoinPort;
  /**
   * Optional partner-center read model. Omitted until the partner app API
   * publishes its self-service projections; the distribution centre already
   * renders the joined state when this port is supplied.
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
  /** Resolves the optional centre projection without leaking a 404 to the UI. */
  retrieveCenter(): Promise<SdkworkPartnerCenterAvailability>;
}

export function createSdkworkPartnerService(
  input: CreateSdkworkPartnerServiceInput,
): SdkworkPartnerService {
  const center = input.center ?? null;
  return {
    cancelApplication: (applicationId) => input.join.cancelApplication(applicationId),
    listMyApplications: (query) => input.join.listMyApplications(query),
    retrieveCenter: async () => {
      if (!center) {
        return { available: false, reason: "not-configured" };
      }
      try {
        return { available: true, snapshot: await center.retrieveCenter() };
      } catch (error) {
        const status = readSdkworkPartnerErrorStatus(error);
        if (status === 404 || status === 501) {
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
