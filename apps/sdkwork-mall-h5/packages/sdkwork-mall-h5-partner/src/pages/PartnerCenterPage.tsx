import { useState } from "react";
import { useTranslation, type TFunction } from "react-i18next";
import { Copy, Share2, ShieldCheck, ShieldX, Users, Wallet } from "lucide-react";

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
  type SdkworkPartnerDraftIssue,
  type SdkworkPartnerInviteCodePreview,
  type SdkworkPartnerMembershipState,
  type SdkworkPartnerProgram,
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
        <ApplyForm
          isSubmitting={state.isSubmitting}
          onClose={controller.closeApplyForm}
          onSubmit={(draft) => controller.submitApplication(draft)}
          program={state.program}
          t={t}
        />
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

type Translate = TFunction;

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
            {t("partner.program.customerRevenue")} {formatSdkworkPartnerPercent(summary.maxCustomerRevenue, "zh-CN")}
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
          {center?.reason === "not-supported"
            ? t("partner.center.notSupported")
            : t("partner.center.notConfigured")}
        </div>
      </section>
    );
  }
  const { snapshot } = center;
  const metrics = [
    { icon: Users, label: t("partner.center.team"), value: String(snapshot.counts.teamSize) },
    { icon: Users, label: t("partner.center.customers"), value: String(snapshot.counts.customerCount) },
    {
      icon: Wallet,
      label: t("partner.center.available"),
      value: formatSdkworkPartnerMoney(snapshot.balance.available, snapshot.balance.currency, locale),
    },
    {
      icon: Wallet,
      label: t("partner.center.withdrawable"),
      value: formatSdkworkPartnerMoney(snapshot.balance.withdrawable, snapshot.balance.currency, locale),
    },
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

function ApplyForm({
  isSubmitting,
  onClose,
  onSubmit,
  program,
  t,
}: {
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (draft: SdkworkPartnerApplicationDraft) => Promise<boolean>;
  readonly program: SdkworkPartnerProgram;
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
    inviteCode: "",
    subjectName: "",
    targetLevelNo: levels[0]?.levelNo ?? 1,
  }));
  const [issues, setIssues] = useState<readonly SdkworkPartnerDraftIssue[]>([]);
  const issueText = (field: keyof SdkworkPartnerApplicationDraft): string => {
    const issue = issues.find((entry) => entry.field === field);
    return issue ? t(`partner.issues.${issue.code}`) : "";
  };

  return (
    <section className="sdk-h5-section">
      <h2>{t("partner.apply.title")}</h2>
      <p className="sdk-h5-muted">{t("partner.apply.description")}</p>
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
