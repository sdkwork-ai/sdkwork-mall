import {
  resolveSdkworkPartnerMembership,
} from "./partner-domain";
import { readSdkworkPartnerErrorMessage } from "./partner-sdk-port";
import type { SdkworkPartnerService } from "./partner-service";
import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerCenterAvailability,
  SdkworkPartnerInviteCodePreview,
  SdkworkPartnerMembership,
  SdkworkPartnerProgram,
} from "./partner-types";

export type SdkworkPartnerLoadStatus = "idle" | "loading" | "ready" | "error";

export interface SdkworkPartnerControllerState {
  readonly applications: readonly SdkworkPartnerApplication[];
  readonly center: SdkworkPartnerCenterAvailability | null;
  readonly invitePreview: SdkworkPartnerInviteCodePreview | null;
  readonly isApplyFormOpen: boolean;
  readonly isCancellingId: string | null;
  readonly isSubmitting: boolean;
  readonly isValidatingInvite: boolean;
  readonly lastError: string;
  readonly membership: SdkworkPartnerMembership;
  readonly program: SdkworkPartnerProgram | null;
  readonly status: SdkworkPartnerLoadStatus;
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
}

const EMPTY_APPLICATIONS: readonly SdkworkPartnerApplication[] = [];

const INITIAL_STATE: SdkworkPartnerControllerState = {
  applications: EMPTY_APPLICATIONS,
  center: null,
  invitePreview: null,
  isApplyFormOpen: false,
  isCancellingId: null,
  isSubmitting: false,
  isValidatingInvite: false,
  lastError: "",
  membership: { application: null, state: "none" },
  program: null,
  status: "idle",
};

/**
 * Framework-free distribution state machine.
 *
 * Both React roots wrap the same controller with `useSyncExternalStore`, so the
 * join journey has one implementation instead of one per client.
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
