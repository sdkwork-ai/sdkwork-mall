import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Share2, ShieldCheck, ShieldX, Users } from "lucide-react";

import {
  buildSdkworkPartnerInviteLink,
  formatSdkworkPartnerDateTime,
  formatSdkworkPartnerMoney,
  formatSdkworkPartnerPercent,
  orderSdkworkPartnerLevels,
  summarizeSdkworkPartnerProgram,
  validateSdkworkPartnerApplicationDraft,
  type SdkworkPartnerApplication,
  type SdkworkPartnerApplicationDraft,
  type SdkworkPartnerCenterBalance,
  type SdkworkPartnerCommissionRecord,
  type SdkworkPartnerDraftIssue,
  type SdkworkPartnerInviteCodePreview,
  type SdkworkPartnerMembershipState,
  type SdkworkPartnerProgram,
  type SdkworkPartnerTeamMember,
  type SdkworkPartnerWithdrawal,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerController } from "../partner-controller.ts";
import {
  useSdkworkPartnerController,
  useSdkworkPartnerControllerState,
} from "../partner-controller.ts";

export interface SdkworkMallH5PartnerCenterPageProps {
  readonly controller?: SdkworkPartnerController;
}

export function SdkworkMallH5PartnerCenterPage({
  controller: controllerProp,
}: SdkworkMallH5PartnerCenterPageProps) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language || "zh-CN";
  const controller = useSdkworkPartnerController(controllerProp);
  const state = useSdkworkPartnerControllerState(controller);

  if (state.status === "loading" && !state.program) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">{t("partner.page.loading")}</div>
      </div>
    );
  }

  if (state.status === "error" && !state.program) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">{state.lastError || t("partner.page.errorTitle")}</div>
        <div className="sdk-h5-action-row">
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            onClick={() => void controller.refresh()}
            type="button"
          >
            {t("partner.page.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("partner.page.title")}</h1>

      <StatusHero
        isApplyAvailable={state.membership.state !== "pending"}
        membershipState={state.membership.state}
        onApply={controller.openApplyForm}
        program={state.program}
        t={t}
      />

      {state.lastError ? <div className="sdk-h5-empty">{state.lastError}</div> : null}

      <CenterSection center={state.center} locale={locale} t={t} />

      <InviteSection
        isValidating={state.isValidatingInvite}
        onValidate={(code) => controller.validateInvite(code)}
        ownedInviteCode={
          state.center?.available ? state.center.snapshot.profile.inviteCode : undefined
        }
        preview={state.invitePreview}
        t={t}
      />

      {state.isApplyFormOpen && state.program ? (
        <ApplyModal onClose={controller.closeApplyForm} t={t}>
          <ApplyForm
            initialInviteCode={readInviteFromLocation()}
            isSubmitting={state.isSubmitting}
            onClose={controller.closeApplyForm}
            onSubmit={(draft) => controller.submitApplication(draft)}
            program={state.program}
            showHeader={false}
            t={t}
          />
        </ApplyModal>
      ) : null}

      {state.center?.available ? (
        <>
          <TeamSection
            currency={state.center.snapshot.balance.currency}
            isLoading={state.isTeamLoading}
            locale={locale}
            members={state.teamMembers}
            onPageChange={(page) => void controller.loadTeam(page)}
            page={state.teamPage}
            pageSize={10}
            t={t}
            total={state.teamTotal}
          />
          <CommissionSection
            currency={state.center.snapshot.balance.currency}
            isLoading={state.isCommissionLoading}
            locale={locale}
            onPageChange={(page) => void controller.loadCommissionRecords(page)}
            page={state.commissionPage}
            pageSize={10}
            records={state.commissionRecords}
            t={t}
            total={state.commissionTotal}
          />
          <WithdrawalSection
            balance={state.center.snapshot.balance}
            error={state.withdrawalError}
            isLoading={state.isWithdrawalLoading}
            isWithdrawing={state.isWithdrawing}
            locale={locale}
            onPageChange={(page) => void controller.loadWithdrawals(page)}
            onSubmit={(draft) => controller.submitWithdrawal(draft)}
            page={state.withdrawalPage}
            pageSize={10}
            t={t}
            total={state.withdrawalTotal}
            withdrawals={state.withdrawals}
          />
        </>
      ) : null}

      {state.program ? (
        <ProgramSection locale={locale} program={state.program} t={t} />
      ) : null}

      <ApplicationsSection
        applications={state.applications}
        cancellingId={state.isCancellingId}
        locale={locale}
        onCancel={(applicationId) => void controller.cancelApplication(applicationId)}
        t={t}
      />
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>["t"];

function StatusHero({
  isApplyAvailable,
  membershipState,
  onApply,
  program,
  t,
}: {
  readonly isApplyAvailable: boolean;
  readonly membershipState: SdkworkPartnerMembershipState;
  readonly onApply: () => void;
  readonly program: SdkworkPartnerProgram | null;
  readonly t: Translate;
}) {
  const summary = program ? summarizeSdkworkPartnerProgram(program) : null;
  return (
    <section className="sdk-h5-section">
      <p className="sdk-h5-muted">{t("partner.page.eyebrow")}</p>
      <h2>{t(`partner.status.${membershipState}.title`)}</h2>
      <p className="sdk-h5-muted">{t(`partner.status.${membershipState}.description`)}</p>
      {summary && program ? (
        <div className="sdk-h5-chip-row sdk-h5-chip-row-sub">
          <span className="sdk-h5-chip">
            {t("partner.summary.levelCount", { count: summary.levelCount })}
          </span>
          <span className="sdk-h5-chip">
            {t("partner.program.customerRevenue")} {formatSdkworkPartnerPercent(summary.maxCustomerRevenueRatio, "zh-CN")}
          </span>
          <span className="sdk-h5-chip">
            {formatSdkworkPartnerMoney(summary.minJoinFee, program.rules.currency, "zh-CN")}
          </span>
        </div>
      ) : null}
      {isApplyAvailable ? (
        <div className="sdk-h5-action-row">
          <button className="sdk-h5-button sdk-h5-button-primary" onClick={onApply} type="button">
            {membershipState === "approved" ? t("partner.actions.reapply") : t("partner.actions.apply")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CenterSection({
  center,
  locale,
  t,
}: {
  readonly center: ReturnType<typeof useSdkworkPartnerControllerState>["center"];
  readonly locale: string;
  readonly t: Translate;
}) {
  if (!center || !center.available) {
    return (
      <section className="sdk-h5-section">
        <h2>{t("partner.center.title")}</h2>
        <div className="sdk-h5-empty">
          {center?.reason === "not-enrolled"
            ? t("partner.center.notEnrolled")
            : center?.reason === "not-supported"
              ? t("partner.center.notSupported")
              : t("partner.center.notConfigured")}
        </div>
      </section>
    );
  }
  const { snapshot } = center;
  const metrics = [
    { icon: Users, label: t("partner.center.team"), value: String(snapshot.counts.teamSize) },
    { icon: Users, label: t("partner.center.directTeam"), value: String(snapshot.counts.directTeamSize) },
    { icon: Users, label: t("partner.center.customers"), value: String(snapshot.counts.customerCount) },
  ];
  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.center.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.center.description")}</p>
      <div className="sdk-h5-chip-row sdk-h5-chip-row-sub">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <span className="sdk-h5-chip" key={metric.label}>
              <Icon aria-hidden="true" size={14} /> {metric.label} {metric.value}
            </span>
          );
        })}
      </div>
      <p className="sdk-h5-muted">
        {t("partner.center.inviteCode")}: {snapshot.profile.inviteCode || "—"}
      </p>
    </section>
  );
}

function InviteSection({
  isValidating,
  onValidate,
  ownedInviteCode,
  preview,
  t,
}: {
  readonly isValidating: boolean;
  readonly onValidate: (code: string) => Promise<SdkworkPartnerInviteCodePreview | null>;
  readonly ownedInviteCode?: string;
  readonly preview: SdkworkPartnerInviteCodePreview | null;
  readonly t: Translate;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const shareLink = ownedInviteCode
    ? buildSdkworkPartnerInviteLink(
        typeof window === "undefined" ? "" : window.location.origin,
        ownedInviteCode,
      )
    : "";

  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.invite.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.invite.description")}</p>
      <form
        className="sdk-h5-field"
        onSubmit={(event) => {
          event.preventDefault();
          void onValidate(code);
        }}
      >
        <label className="sdk-h5-visually-hidden" htmlFor="sdk-h5-partner-invite">
          {t("partner.invite.placeholder")}
        </label>
        <input
          id="sdk-h5-partner-invite"
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("partner.invite.placeholder")}
          value={code}
        />
        <button
          className="sdk-h5-button sdk-h5-button-secondary"
          disabled={!code.trim() || isValidating}
          type="submit"
        >
          {t("partner.actions.validate")}
        </button>
      </form>

      {preview ? (
        <div className="sdk-h5-empty" role="status">
          {preview.valid ? (
            <ShieldCheck aria-hidden="true" size={16} />
          ) : (
            <ShieldX aria-hidden="true" size={16} />
          )}
          <div>
            <strong>{preview.valid ? t("partner.invite.valid") : t("partner.invite.invalid")}</strong>
            {preview.valid ? (
              <p>
                {t("partner.invite.inviter")}: {preview.partnerName || "—"}
                {preview.levelNo !== null ? ` · ${t("partner.invite.level")} ${preview.levelNo}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {shareLink ? (
        <div className="sdk-h5-empty">
          <div>
            <p>
              {t("partner.center.inviteCode")}: <strong>{ownedInviteCode}</strong>
            </p>
            <p className="sdk-h5-muted">{shareLink}</p>
            <button
              className="sdk-h5-button sdk-h5-button-secondary"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(shareLink).then(() => setCopied(true));
                }
              }}
              type="button"
            >
              <Copy aria-hidden="true" size={14} />
              {copied ? t("partner.actions.copied") : t("partner.actions.copy")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ApplyModal({
  children,
  onClose,
  t,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly t: Translate;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby="partner-apply-title"
      aria-modal="true"
      className="partner-apply-modal"
      role="dialog"
    >
      <div aria-hidden="true" className="partner-apply-backdrop" onClick={onClose} />
      <div className="partner-apply-panel" ref={panelRef} tabIndex={-1}>
        <header className="partner-apply-head">
          <h2 id="partner-apply-title">{t("partner.apply.title")}</h2>
          <button
            aria-label={t("partner.actions.close")}
            className="partner-apply-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="partner-apply-body">{children}</div>
      </div>
    </div>
  );
}

function ApplyForm({
  initialInviteCode,
  isSubmitting,
  onClose,
  onSubmit,
  program,
  showHeader = true,
  t,
}: {
  readonly initialInviteCode?: string;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (draft: SdkworkPartnerApplicationDraft) => Promise<boolean>;
  readonly program: SdkworkPartnerProgram;
  readonly showHeader?: boolean;
  readonly t: Translate;
}) {
  const levels = orderSdkworkPartnerLevels(program.levels).filter(
    (level) => level.status === "ACTIVE",
  );
  const [draft, setDraft] = useState<SdkworkPartnerApplicationDraft>(() => ({
    applicantType: "INDIVIDUAL",
    businessIntro: "",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
    inviteCode: initialInviteCode?.trim() ?? "",
    subjectName: "",
    targetLevelNo: levels[0]?.levelNo ?? 1,
  }));
  const [issues, setIssues] = useState<readonly SdkworkPartnerDraftIssue[]>([]);
  const issueText = (field: keyof SdkworkPartnerApplicationDraft): string => {
    const issue = issues.find((entry) => entry.field === field);
    return issue ? t(`partner.issues.${issue.code}`) : "";
  };

  return (
    <section className={showHeader ? "sdk-h5-section" : undefined}>
      {showHeader ? (
        <>
          <h2>{t("partner.apply.title")}</h2>
          <p className="sdk-h5-muted">{t("partner.apply.description")}</p>
        </>
      ) : null}
      <form
        className="sdk-h5-field"
        onSubmit={(event) => {
          event.preventDefault();
          const nextIssues = validateSdkworkPartnerApplicationDraft(draft);
          setIssues(nextIssues);
          if (nextIssues.length === 0) {
            void onSubmit(draft);
          }
        }}
      >
        <label htmlFor="partner-applicant-type">{t("partner.apply.applicantType")}</label>
        <select
          id="partner-applicant-type"
          onChange={(event) =>
            setDraft({
              ...draft,
              applicantType: event.target.value === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL",
            })
          }
          value={draft.applicantType}
        >
          <option value="INDIVIDUAL">{t("partner.apply.individual")}</option>
          <option value="ORGANIZATION">{t("partner.apply.organization")}</option>
        </select>

        <label htmlFor="partner-subject-name">{t("partner.apply.subjectName")}</label>
        <input
          id="partner-subject-name"
          onChange={(event) => setDraft({ ...draft, subjectName: event.target.value })}
          value={draft.subjectName}
        />
        {issueText("subjectName") ? <span className="sdk-h5-muted">{issueText("subjectName")}</span> : null}

        <label htmlFor="partner-contact-name">{t("partner.apply.contactName")}</label>
        <input
          id="partner-contact-name"
          onChange={(event) => setDraft({ ...draft, contactName: event.target.value })}
          value={draft.contactName}
        />
        {issueText("contactName") ? <span className="sdk-h5-muted">{issueText("contactName")}</span> : null}

        <label htmlFor="partner-contact-phone">{t("partner.apply.contactPhone")}</label>
        <input
          id="partner-contact-phone"
          inputMode="tel"
          onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })}
          value={draft.contactPhone}
        />
        {issueText("contactPhone") ? <span className="sdk-h5-muted">{issueText("contactPhone")}</span> : null}

        <label htmlFor="partner-contact-email">{t("partner.apply.contactEmail")}</label>
        <input
          id="partner-contact-email"
          inputMode="email"
          onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })}
          value={draft.contactEmail}
        />
        {issueText("contactEmail") ? <span className="sdk-h5-muted">{issueText("contactEmail")}</span> : null}

        <label htmlFor="partner-target-level">{t("partner.apply.targetLevel")}</label>
        <select
          id="partner-target-level"
          onChange={(event) => setDraft({ ...draft, targetLevelNo: Number(event.target.value) })}
          value={draft.targetLevelNo}
        >
          {levels.map((level) => (
            <option key={level.levelNo} value={level.levelNo}>
              {level.name} · {t("partner.program.level")} {level.levelNo}
            </option>
          ))}
        </select>

        <label htmlFor="partner-invite-code">{t("partner.apply.inviteCode")}</label>
        <input
          id="partner-invite-code"
          onChange={(event) => setDraft({ ...draft, inviteCode: event.target.value })}
          value={draft.inviteCode}
        />

        <label htmlFor="partner-business-intro">{t("partner.apply.businessIntro")}</label>
        <textarea
          id="partner-business-intro"
          onChange={(event) => setDraft({ ...draft, businessIntro: event.target.value })}
          value={draft.businessIntro}
        />

        <div className="sdk-h5-action-row">
          <button className="sdk-h5-button sdk-h5-button-ghost" onClick={onClose} type="button">
            {t("partner.actions.close")}
          </button>
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("partner.actions.submitting") : t("partner.apply.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}

function ProgramSection({
  locale,
  program,
  t,
}: {
  readonly locale: string;
  readonly program: SdkworkPartnerProgram;
  readonly t: Translate;
}) {
  const levels = orderSdkworkPartnerLevels(program.levels);
  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.program.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.program.description")}</p>
      {levels.length === 0 ? (
        <div className="sdk-h5-empty">{t("partner.program.empty")}</div>
      ) : (
        <ul className="sdk-h5-benefit-grid">
          {levels.map((level) => (
            <li className="sdk-h5-benefit-item" key={level.levelNo}>
              <h3>
                {level.name}
                <span className="sdk-h5-muted">
                  {" "}
                  · {t("partner.program.level")} {level.levelNo}
                </span>
              </h3>
              <p className="sdk-h5-muted">
                {t("partner.program.joinFee")}{" "}
                {formatSdkworkPartnerMoney(level.joinFee, program.rules.currency, locale)}
                {" · "}
                {t("partner.program.customerRevenue")}{" "}
                {formatSdkworkPartnerPercent(level.customerRevenueRatio, locale)}
                {" · "}
                {t("partner.program.joinFeeCommission")}{" "}
                {formatSdkworkPartnerPercent(level.joinFeeCommissionRatio, locale)}
              </p>
              {level.benefits.length > 0 ? (
                <ul className="sdk-h5-benefit-grid">
                  {level.benefits.map((benefit) => (
                    <li className="sdk-h5-benefit-item" key={benefit.code}>
                      {benefit.name}
                      {benefit.value ? ` · ${benefit.value}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="sdk-h5-muted">
        {t("partner.program.rules")}: {program.rules.currency} ·{" "}
        {t("partner.program.profitMargin")}{" "}
        {formatSdkworkPartnerPercent(program.rules.profitMarginRatio, locale)} ·{" "}
        {t("partner.program.minWithdrawal")}{" "}
        {formatSdkworkPartnerMoney(program.rules.minWithdrawalAmount, program.rules.currency, locale)}
      </p>
    </section>
  );
}

function TeamSection({
  currency,
  isLoading,
  locale,
  members,
  onPageChange,
  page,
  pageSize,
  t,
  total,
}: {
  readonly currency: string;
  readonly isLoading: boolean;
  readonly locale: string;
  readonly members: readonly SdkworkPartnerTeamMember[];
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly t: Translate;
  readonly total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.team.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.team.description")}</p>
      {members.length === 0 ? (
        <div className="sdk-h5-empty">{t("partner.team.empty")}</div>
      ) : (
        <ul className="sdk-h5-benefit-grid">
          {members.map((member) => (
            <li className="sdk-h5-benefit-item" key={member.partnerId}>
              <h3>
                {member.name || member.partnerId}
                <span className="sdk-h5-muted">
                  {" "}
                  · {member.levelName || member.levelNo} · {t("partner.team.depth")} {member.depth}
                </span>
              </h3>
              <p className="sdk-h5-muted">
                {t("partner.team.customerCount")} {member.customerCount} ·{" "}
                {t("partner.team.totalCommission")}{" "}
                {formatSdkworkPartnerMoney(member.totalCommission, currency, locale)}
              </p>
              <p className="sdk-h5-muted">
                {t("partner.team.availableBalance")}{" "}
                {formatSdkworkPartnerMoney(member.availableBalance, currency, locale)} ·{" "}
                {t("partner.team.joinedAt")} {formatSdkworkPartnerDateTime(member.joinedAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <PageNav
        isLoading={isLoading}
        nextLabel={t("partner.team.nextPage")}
        onPageChange={onPageChange}
        page={page}
        pageCount={pageCount}
        pageLabel={t("partner.team.page", { page, total: pageCount })}
        previousLabel={t("partner.team.previousPage")}
      />
    </section>
  );
}

function CommissionSection({
  currency,
  isLoading,
  locale,
  onPageChange,
  page,
  pageSize,
  records,
  t,
  total,
}: {
  readonly currency: string;
  readonly isLoading: boolean;
  readonly locale: string;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly records: readonly SdkworkPartnerCommissionRecord[];
  readonly t: Translate;
  readonly total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.commissions.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.commissions.description")}</p>
      {records.length === 0 ? (
        <div className="sdk-h5-empty">{t("partner.commissions.empty")}</div>
      ) : (
        <ul className="sdk-h5-benefit-grid">
          {records.map((record) => (
            <li className="sdk-h5-benefit-item" key={record.id}>
              <h3>
                {formatSdkworkPartnerMoney(record.amount, currency, locale)}
                <span className="sdk-h5-muted"> · {record.sourceType}</span>
              </h3>
              <p className="sdk-h5-muted">
                {t("partner.commissions.baseAmount")}{" "}
                {formatSdkworkPartnerMoney(record.baseAmount, currency, locale)} ·{" "}
                {t("partner.commissions.ratio")} {formatSdkworkPartnerPercent(record.ratio, locale)} ·{" "}
                {t("partner.commissions.levelOffset")} {record.levelOffset}
              </p>
              <p className="sdk-h5-muted">
                {formatSdkworkPartnerDateTime(record.computedAt, locale)} · {record.status}
              </p>
            </li>
          ))}
        </ul>
      )}
      <PageNav
        isLoading={isLoading}
        nextLabel={t("partner.commissions.nextPage")}
        onPageChange={onPageChange}
        page={page}
        pageCount={pageCount}
        pageLabel={t("partner.commissions.page", { page, total: pageCount })}
        previousLabel={t("partner.commissions.previousPage")}
      />
    </section>
  );
}

function WithdrawalSection({
  balance,
  error,
  isLoading,
  isWithdrawing,
  locale,
  onPageChange,
  onSubmit,
  page,
  pageSize,
  t,
  total,
  withdrawals,
}: {
  readonly balance: SdkworkPartnerCenterBalance;
  readonly error: string;
  readonly isLoading: boolean;
  readonly isWithdrawing: boolean;
  readonly locale: string;
  readonly onPageChange: (page: number) => void;
  readonly onSubmit: (draft: { amount: string; remark: string }) => Promise<boolean>;
  readonly page: number;
  readonly pageSize: number;
  readonly t: Translate;
  readonly total: number;
  readonly withdrawals: readonly SdkworkPartnerWithdrawal[];
}) {
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const submit = async (): Promise<void> => {
    setSuccess(false);
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setLocalError(t("partner.withdrawals.invalidAmount"));
      return;
    }
    if (parsed > Number(balance.available)) {
      setLocalError(t("partner.withdrawals.exceedsBalance"));
      return;
    }
    if (parsed < Number(balance.minWithdrawal)) {
      setLocalError(t("partner.withdrawals.belowMin"));
      return;
    }
    setLocalError("");
    if (await onSubmit({ amount: amount.trim(), remark: remark.trim() })) {
      setAmount("");
      setRemark("");
      setSuccess(true);
    }
  };

  const metrics = [
    { label: t("partner.withdrawals.available"), value: balance.available },
    { label: t("partner.withdrawals.pending"), value: balance.pending },
    { label: t("partner.withdrawals.totalEarned"), value: balance.settledTotal },
    { label: t("partner.withdrawals.withdrawn"), value: balance.withdrawn },
  ];

  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.withdrawals.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.withdrawals.description")}</p>
      <div className="sdk-h5-chip-row sdk-h5-chip-row-sub">
        {metrics.map((metric) => (
          <span className="sdk-h5-chip" key={metric.label}>
            {metric.label} {formatSdkworkPartnerMoney(metric.value, balance.currency, locale)}
          </span>
        ))}
      </div>
      <p className="sdk-h5-muted">
        {t("partner.withdrawals.minWithdrawal", {
          value: formatSdkworkPartnerMoney(balance.minWithdrawal, balance.currency, locale),
        })}
      </p>
      <form
        className="sdk-h5-field"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="partner-withdraw-amount">{t("partner.withdrawals.amount")}</label>
        <input
          id="partner-withdraw-amount"
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          placeholder={t("partner.withdrawals.amountPlaceholder")}
          value={amount}
        />
        <label htmlFor="partner-withdraw-remark">{t("partner.withdrawals.remark")}</label>
        <input
          id="partner-withdraw-remark"
          onChange={(event) => setRemark(event.target.value)}
          placeholder={t("partner.withdrawals.remarkPlaceholder")}
          value={remark}
        />
        {localError ? <span className="sdk-h5-muted">{localError}</span> : null}
        {error ? <span className="sdk-h5-muted">{error}</span> : null}
        {success ? <span className="sdk-h5-muted">{t("partner.withdrawals.success")}</span> : null}
        <button
          className="sdk-h5-button sdk-h5-button-primary"
          disabled={isWithdrawing}
          type="submit"
        >
          {isWithdrawing ? t("partner.actions.submitting") : t("partner.withdrawals.submit")}
        </button>
      </form>

      {withdrawals.length === 0 ? (
        <div className="sdk-h5-empty">{t("partner.withdrawals.empty")}</div>
      ) : (
        <ul className="sdk-h5-benefit-grid">
          {withdrawals.map((withdrawal) => (
            <li className="sdk-h5-benefit-item" key={withdrawal.id}>
              <h3>
                {formatSdkworkPartnerMoney(withdrawal.amount, balance.currency, locale)}
                <span className="sdk-h5-muted">
                  {" "}
                  · {t(`partner.withdrawalStatusLabel.${withdrawal.status.toUpperCase()}`)}
                </span>
              </h3>
              <p className="sdk-h5-muted">
                {t("partner.withdrawals.requestedAt")}{" "}
                {formatSdkworkPartnerDateTime(withdrawal.createdAt, locale)}
                {withdrawal.paidAt
                  ? ` · ${t("partner.withdrawals.paidAt")} ${formatSdkworkPartnerDateTime(withdrawal.paidAt, locale)}`
                  : ""}
              </p>
              {withdrawal.reviewRemark ? (
                <p className="sdk-h5-muted">
                  {t("partner.withdrawals.reviewRemark")}: {withdrawal.reviewRemark}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <PageNav
        isLoading={isLoading}
        nextLabel={t("partner.withdrawals.nextPage")}
        onPageChange={onPageChange}
        page={page}
        pageCount={pageCount}
        pageLabel={t("partner.withdrawals.page", { page, total: pageCount })}
        previousLabel={t("partner.withdrawals.previousPage")}
      />
    </section>
  );
}

function PageNav({
  isLoading,
  nextLabel,
  onPageChange,
  page,
  pageCount,
  pageLabel,
  previousLabel,
}: {
  readonly isLoading: boolean;
  readonly nextLabel: string;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly pageCount: number;
  readonly pageLabel: string;
  readonly previousLabel: string;
}) {
  return (
    <div className="sdk-h5-action-row">
      <button
        className="sdk-h5-button sdk-h5-button-ghost"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        {previousLabel}
      </button>
      <span className="sdk-h5-muted">{pageLabel}</span>
      <button
        className="sdk-h5-button sdk-h5-button-ghost"
        disabled={page >= pageCount || isLoading}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ApplicationsSection({
  applications,
  cancellingId,
  locale,
  onCancel,
  t,
}: {
  readonly applications: readonly SdkworkPartnerApplication[];
  readonly cancellingId: string | null;
  readonly locale: string;
  readonly onCancel: (applicationId: string) => void;
  readonly t: Translate;
}) {
  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.applications.title")}</h2>
      {applications.length === 0 ? (
        <div className="sdk-h5-empty">{t("partner.applications.empty")}</div>
      ) : (
        <ul className="sdk-h5-benefit-grid">
          {applications.map((application) => (
            <li className="sdk-h5-benefit-item" key={application.id}>
              <h3>
                {application.subjectName || application.contactName}
                <span className="sdk-h5-muted"> · {t(`partner.statusLabel.${application.status}`)}</span>
              </h3>
              <p className="sdk-h5-muted">
                {t("partner.applications.targetLevel")} {application.targetLevelNo} ·{" "}
                {t("partner.applications.submittedAt")}{" "}
                {formatSdkworkPartnerDateTime(application.createdAt, locale)}
              </p>
              {application.reviewComment ? (
                <p className="sdk-h5-muted">
                  {t("partner.applications.reviewComment")}: {application.reviewComment}
                </p>
              ) : null}
              {application.status === "SUBMITTED" ? (
                <button
                  className="sdk-h5-button sdk-h5-button-secondary"
                  disabled={cancellingId === application.id}
                  onClick={() => onCancel(application.id)}
                  type="button"
                >
                  {t("partner.actions.cancelApplication")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Reads `?invite=CODE` from a shared recruitment link. */
function readInviteFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
}
