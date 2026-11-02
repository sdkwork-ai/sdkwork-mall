import { resolveSdkworkPartnerMembership } from "./partner-domain";
import { readSdkworkPartnerErrorMessage } from "./partner-sdk-port";
import type { SdkworkPartnerService } from "./partner-service";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerCenterAvailability,
  SdkworkPartnerCommissionRecord,
  SdkworkPartnerInviteCodePreview,
  SdkworkPartnerMembership,
  SdkworkPartnerProgram,
  SdkworkPartnerTeamMember,
  SdkworkPartnerWithdrawal,
  SdkworkPartnerWithdrawalDraft,
} from "./partner-types";

export type SdkworkPartnerLoadStatus = "idle" | "loading" | "ready" | "error";

export const SDKWORK_PARTNER_PAGE_SIZE = 10;

export interface SdkworkPartnerControllerState {
  readonly applications: readonly SdkworkPartnerApplication[];
  readonly center: SdkworkPartnerCenterAvailability | null;
  readonly commissionPage: number;
  readonly commissionRecords: readonly SdkworkPartnerCommissionRecord[];
  readonly commissionTotal: number;
  readonly invitePreview: SdkworkPartnerInviteCodePreview | null;
  readonly isApplyFormOpen: boolean;
  readonly isCancellingId: string | null;
  readonly isCommissionLoading: boolean;
  readonly isSubmitting: boolean;
  readonly isTeamLoading: boolean;
  readonly isValidatingInvite: boolean;
  readonly isWithdrawing: boolean;
  readonly isWithdrawalLoading: boolean;
  readonly lastError: string;
  readonly membership: SdkworkPartnerMembership;
  readonly program: SdkworkPartnerProgram | null;
  readonly status: SdkworkPartnerLoadStatus;
  readonly teamMembers: readonly SdkworkPartnerTeamMember[];
  readonly teamPage: number;
  readonly teamTotal: number;
  readonly withdrawalError: string;
  readonly withdrawalPage: number;
  readonly withdrawals: readonly SdkworkPartnerWithdrawal[];
  readonly withdrawalTotal: number;
}

export interface SdkworkPartnerController {
  getState(): SdkworkPartnerControllerState;
  subscribe(listener: () => void): () => void;
  bootstrap(): Promise<void>;
  refresh(): Promise<void>;
  submitApplication(draft: SdkworkPartnerApplicationDraft): Promise<boolean>;
  cancelApplication(applicationId: string): Promise<boolean>;
  validateInvite(code: string): Promise<SdkworkPartnerInviteCodePreview | null>;
  clearInvitePreview(): void;
  openApplyForm(): void;
  closeApplyForm(): void;
  clearError(): void;
  loadTeam(page?: number): Promise<void>;
  loadCommissionRecords(page?: number): Promise<void>;
  loadWithdrawals(page?: number): Promise<void>;
  submitWithdrawal(draft: SdkworkPartnerWithdrawalDraft): Promise<boolean>;
}

const EMPTY_APPLICATIONS: readonly SdkworkPartnerApplication[] = [];
const EMPTY_COMMISSIONS: readonly SdkworkPartnerCommissionRecord[] = [];
const EMPTY_TEAM: readonly SdkworkPartnerTeamMember[] = [];
const EMPTY_WITHDRAWALS: readonly SdkworkPartnerWithdrawal[] = [];

const INITIAL_STATE: SdkworkPartnerControllerState = {
  applications: EMPTY_APPLICATIONS,
  center: null,
  commissionPage: 1,
  commissionRecords: EMPTY_COMMISSIONS,
  commissionTotal: 0,
  invitePreview: null,
  isApplyFormOpen: false,
  isCancellingId: null,
  isCommissionLoading: false,
  isSubmitting: false,
  isTeamLoading: false,
  isValidatingInvite: false,
  isWithdrawing: false,
  isWithdrawalLoading: false,
  lastError: "",
  membership: { application: null, state: "none" },
  program: null,
  status: "idle",
  teamMembers: EMPTY_TEAM,
  teamPage: 1,
  teamTotal: 0,
  withdrawalError: "",
  withdrawalPage: 1,
  withdrawals: EMPTY_WITHDRAWALS,
  withdrawalTotal: 0,
};

/**
 * Framework-free distribution state machine shared by the PC and H5 roots.
 *
 * The join journey and the partner-centre projections live behind one service;
 * this controller owns request ordering, partial-failure handling, and page
 * state so each client only renders.
 */
export function createSdkworkPartnerController(
  service: SdkworkPartnerService,
): SdkworkPartnerController {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();

  const setState = (patch: Partial<SdkworkPartnerControllerState>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  };

  const loadTeamPage = async (page: number): Promise<void> => {
    setState({ isTeamLoading: true });
    try {
      const result = await service.listTeam({ page, pageSize: SDKWORK_PARTNER_PAGE_SIZE });
      setState({
        isTeamLoading: false,
        teamMembers: result?.items ?? EMPTY_TEAM,
        teamPage: result?.page ?? page,
        teamTotal: result?.total ?? 0,
      });
    } catch (error) {
      setState({
        isTeamLoading: false,
        lastError: readSdkworkPartnerErrorMessage(error) || "partner.teamLoadFailed",
      });
    }
  };

  const loadCommissionPage = async (page: number): Promise<void> => {
    setState({ isCommissionLoading: true });
    try {
      const result = await service.listCommissionRecords({
        page,
        pageSize: SDKWORK_PARTNER_PAGE_SIZE,
      });
      setState({
        commissionPage: result?.page ?? page,
        commissionRecords: result?.items ?? EMPTY_COMMISSIONS,
        commissionTotal: result?.total ?? 0,
        isCommissionLoading: false,
      });
    } catch (error) {
      setState({
        isCommissionLoading: false,
        lastError: readSdkworkPartnerErrorMessage(error) || "partner.commissionLoadFailed",
      });
    }
  };

  const loadWithdrawalPage = async (page: number): Promise<void> => {
    setState({ isWithdrawalLoading: true });
    try {
      const result = await service.listWithdrawals({ page, pageSize: SDKWORK_PARTNER_PAGE_SIZE });
      setState({
        isWithdrawalLoading: false,
        withdrawalPage: result?.page ?? page,
        withdrawals: result?.items ?? EMPTY_WITHDRAWALS,
        withdrawalTotal: result?.total ?? 0,
      });
    } catch (error) {
      setState({
        isWithdrawalLoading: false,
        withdrawalError: readSdkworkPartnerErrorMessage(error) || "partner.withdrawalLoadFailed",
      });
    }
  };

  const load = async (): Promise<void> => {
    setState({
      lastError: "",
      status: state.program ? state.status : "loading",
    });
    const [programResult, applicationsResult, centerResult] = await Promise.allSettled([
      service.retrieveProgram(),
      service.listMyApplications({ page: 1, pageSize: 20 }),
      service.retrieveCenter(),
    ]);

    const program = programResult.status === "fulfilled" ? programResult.value : state.program;
    const applications =
      applicationsResult.status === "fulfilled"
        ? applicationsResult.value.items
        : state.applications;
    const center = centerResult.status === "fulfilled" ? centerResult.value : state.center;
    const failure = [programResult, applicationsResult].find(
      (result) => result.status === "rejected",
    );
    const lastError = failure?.status === "rejected"
      ? readSdkworkPartnerErrorMessage(failure.reason) || "partner.loadFailed"
      : "";

    setState({
      applications,
      center,
      lastError,
      membership: resolveSdkworkPartnerMembership(applications),
      program,
      status: lastError && !program && applications.length === 0 ? "error" : "ready",
    });

    if (center?.available) {
      await Promise.all([
        loadTeamPage(state.teamPage),
        loadCommissionPage(state.commissionPage),
        loadWithdrawalPage(state.withdrawalPage),
      ]);
    }
  };

  return {
    async bootstrap() {
      if (state.status === "loading") {
        return;
      }
      await load();
    },
    async cancelApplication(applicationId) {
      setState({ isCancellingId: applicationId, lastError: "" });
      try {
        const updated = await service.cancelApplication(applicationId);
        const applications = state.applications.map((application) =>
          application.id === updated.id ? updated : application,
        );
        setState({
          applications,
          isCancellingId: null,
          membership: resolveSdkworkPartnerMembership(applications),
        });
        return true;
      } catch (error) {
        setState({
          isCancellingId: null,
          lastError: readSdkworkPartnerErrorMessage(error) || "partner.cancelFailed",
        });
        return false;
      }
    },
    clearError() {
      if (state.lastError) {
        setState({ lastError: "" });
      }
    },
    clearInvitePreview() {
      if (state.invitePreview) {
        setState({ invitePreview: null });
      }
    },
    closeApplyForm() {
      setState({ isApplyFormOpen: false });
    },
    getState() {
      return state;
    },
    async loadCommissionRecords(page = 1) {
      await loadCommissionPage(page);
    },
    async loadTeam(page = 1) {
      await loadTeamPage(page);
    },
    async loadWithdrawals(page = 1) {
      await loadWithdrawalPage(page);
    },
    openApplyForm() {
      setState({ isApplyFormOpen: true, lastError: "" });
    },
    async refresh() {
      await load();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async submitApplication(draft) {
      setState({ isSubmitting: true, lastError: "" });
      try {
        const created = await service.submitApplication(draft);
        const applications = [created, ...state.applications];
        setState({
          applications,
          isApplyFormOpen: false,
          isSubmitting: false,
          membership: resolveSdkworkPartnerMembership(applications),
        });
        return true;
      } catch (error) {
        setState({
          isSubmitting: false,
          lastError: readSdkworkPartnerErrorMessage(error) || "partner.submitFailed",
        });
        return false;
      }
    },
    async submitWithdrawal(draft) {
      if (state.isWithdrawing) {
        return false;
      }
      setState({ isWithdrawing: true, withdrawalError: "" });
      try {
        await service.createWithdrawal(draft);
        setState({ isWithdrawing: false });
        const center = await service.retrieveCenter();
        setState({ center });
        await loadWithdrawalPage(1);
        return true;
      } catch (error) {
        setState({
          isWithdrawing: false,
          withdrawalError: readSdkworkPartnerErrorMessage(error) || "partner.withdrawFailed",
        });
        return false;
      }
    },
    async validateInvite(code) {
      const normalized = code.trim();
      if (!normalized) {
        setState({ invitePreview: null });
        return null;
      }
      setState({ isValidatingInvite: true, lastError: "" });
      try {
        const preview = await service.validateInviteCode(normalized);
        setState({ invitePreview: preview, isValidatingInvite: false });
        return preview;
      } catch (error) {
        setState({
          invitePreview: null,
          isValidatingInvite: false,
          lastError: readSdkworkPartnerErrorMessage(error) || "partner.inviteFailed",
        });
        return null;
      }
    },
  };
}
