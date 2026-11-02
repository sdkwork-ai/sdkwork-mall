import { LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";

import type { SdkworkPartnerMessagesOverrides } from "../partner-copy.ts";
import type { SdkworkPartnerController } from "../partner-controller.ts";
import {
  useSdkworkPartnerController,
  useSdkworkPartnerControllerState,
} from "../partner-controller.ts";
import {
  SdkworkPartnerIntlProvider,
  useSdkworkPartnerIntl,
} from "../partner-intl.tsx";
import { SdkworkPartnerApplicationsList } from "../components/partner-applications-list.tsx";
import { SdkworkPartnerApplyDialog } from "../components/partner-apply-dialog.tsx";
import { SdkworkPartnerCenterSection } from "../components/partner-center-section.tsx";
import { SdkworkPartnerCommissionTable } from "../components/partner-commission-table.tsx";
import { SdkworkPartnerInviteCard } from "../components/partner-invite-card.tsx";
import { SdkworkPartnerProgramGrid } from "../components/partner-program-grid.tsx";
import { SdkworkPartnerStatusHero } from "../components/partner-status-hero.tsx";
import { SdkworkPartnerTeamTable } from "../components/partner-team-table.tsx";
import { SdkworkPartnerWithdrawalPanel } from "../components/partner-withdrawal-panel.tsx";

export interface SdkworkMallPartnerCenterPageProps {
  readonly controller?: SdkworkPartnerController;
  readonly locale?: string | null;
  readonly messages?: SdkworkPartnerMessagesOverrides;
}

function SdkworkPartnerCenterContent({
  controller: controllerProp,
}: {
  readonly controller?: SdkworkPartnerController;
}) {
  const controller = useSdkworkPartnerController(controllerProp);
  const state = useSdkworkPartnerControllerState(controller);
  const intl = useSdkworkPartnerIntl();
  const { copy } = intl;

  if (state.status === "loading" && !state.program) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <LoadingBlock label={copy.page.loading} />
      </div>
    );
  }

  if (state.status === "error" && !state.program) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <StatusNotice title={copy.page.errorTitle} tone="danger">
          {state.lastError}
        </StatusNotice>
        <button
          className="rounded-[var(--sdk-radius-control)] bg-[var(--sdk-color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--sdk-color-text-inverse)]"
          onClick={() => void controller.refresh()}
          type="button"
        >
          {copy.page.retry}
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-full overflow-y-auto bg-[var(--sdk-color-surface-canvas)]"
      data-slot="partner-center-page"
    >
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-5">
        <SdkworkPartnerStatusHero
          intl={intl}
          membership={state.membership}
          onApply={controller.openApplyForm}
          program={state.program}
        />

        {state.lastError ? (
          <StatusNotice title={copy.page.errorTitle} tone="danger">
            {state.lastError}
          </StatusNotice>
        ) : null}

        <SdkworkPartnerCenterSection center={state.center} intl={intl} />

        <SdkworkPartnerInviteCard
          intl={intl}
          isValidating={state.isValidatingInvite}
          onValidate={(code) => controller.validateInvite(code)}
          ownedInviteCode={
            state.center?.available ? state.center.snapshot.profile.inviteCode : undefined
          }
          preview={state.invitePreview}
        />

        {state.isApplyFormOpen && state.program ? (
          <SdkworkPartnerApplyDialog
            initialInviteCode={readInviteFromLocation()}
            intl={intl}
            isOpen={state.isApplyFormOpen}
            isSubmitting={state.isSubmitting}
            onClose={controller.closeApplyForm}
            onSubmit={(draft) => controller.submitApplication(draft)}
            program={state.program}
          />
        ) : null}

        {state.center?.available ? (
          <>
            <SdkworkPartnerTeamTable
              currency={state.center.snapshot.balance.currency}
              intl={intl}
              isLoading={state.isTeamLoading}
              members={state.teamMembers}
              onPageChange={(page) => void controller.loadTeam(page)}
              page={state.teamPage}
              pageSize={10}
              total={state.teamTotal}
            />
            <SdkworkPartnerCommissionTable
              currency={state.center.snapshot.balance.currency}
              intl={intl}
              isLoading={state.isCommissionLoading}
              onPageChange={(page) => void controller.loadCommissionRecords(page)}
              page={state.commissionPage}
              pageSize={10}
              records={state.commissionRecords}
              total={state.commissionTotal}
            />
            <SdkworkPartnerWithdrawalPanel
              balance={state.center.snapshot.balance}
              error={state.withdrawalError}
              intl={intl}
              isLoading={state.isWithdrawalLoading}
              isWithdrawing={state.isWithdrawing}
              onPageChange={(page) => void controller.loadWithdrawals(page)}
              onSubmit={(draft) => controller.submitWithdrawal(draft)}
              page={state.withdrawalPage}
              pageSize={10}
              total={state.withdrawalTotal}
              withdrawals={state.withdrawals}
            />
          </>
        ) : null}

        {state.program ? (
          <SdkworkPartnerProgramGrid
            currency={state.program.rules.currency}
            intl={intl}
            program={state.program}
          />
        ) : null}

        <SdkworkPartnerApplicationsList
          applications={state.applications}
          cancellingId={state.isCancellingId}
          intl={intl}
          onCancel={(applicationId) => void controller.cancelApplication(applicationId)}
        />
      </div>
    </div>
  );
}

export function SdkworkMallPartnerCenterPage({
  controller,
  locale,
  messages,
}: SdkworkMallPartnerCenterPageProps) {
  return (
    <SdkworkPartnerIntlProvider locale={locale} messages={messages}>
      <SdkworkPartnerCenterContent controller={controller} />
    </SdkworkPartnerIntlProvider>
  );
}

/** Reads `?invite=CODE` from a shared recruitment link. */
function readInviteFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
}
