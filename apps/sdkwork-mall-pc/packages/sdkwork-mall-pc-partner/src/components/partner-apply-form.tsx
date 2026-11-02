import { useState } from "react";
import { Button } from "@sdkwork/ui-pc-react";

import {
  orderSdkworkPartnerLevels,
  validateSdkworkPartnerApplicationDraft,
  type SdkworkPartnerApplicationDraft,
  type SdkworkPartnerDraftIssue,
  type SdkworkPartnerProgram,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerApplyFormProps {
  readonly initialInviteCode?: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (draft: SdkworkPartnerApplicationDraft) => Promise<boolean>;
  readonly program: SdkworkPartnerProgram;
}

export function SdkworkPartnerApplyForm({
  initialInviteCode,
  intl,
  isSubmitting,
  onClose,
  onSubmit,
  program,
}: SdkworkPartnerApplyFormProps) {
  const { copy } = intl;
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

  const issueFor = (field: keyof SdkworkPartnerApplicationDraft): string => {
    const issue = issues.find((entry) => entry.field === field);
    return issue ? intl.issueText(issue.code) : "";
  };

  const update = <K extends keyof SdkworkPartnerApplicationDraft>(
    field: K,
    value: SdkworkPartnerApplicationDraft[K],
  ): void => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submit = async (): Promise<void> => {
    const nextIssues = validateSdkworkPartnerApplicationDraft(draft);
    setIssues(nextIssues);
    if (nextIssues.length > 0) {
      return;
    }
    await onSubmit(draft);
  };

  const fieldClass =
    "h-10 w-full rounded-[var(--sdk-radius-control)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 text-sm text-[var(--sdk-color-text-primary)] outline-none focus:border-[var(--sdk-color-border-focus)]";

  return (
    <section
      className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-4 shadow-[var(--sdk-shadow-sm)]"
      data-slot="partner-apply-form"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--sdk-color-text-primary)]">
            {copy.apply.title}
          </h2>
          <p className="text-sm text-[var(--sdk-color-text-secondary)]">
            {copy.apply.description}
          </p>
        </div>
        <Button onClick={onClose} size="sm" variant="ghost">
          {copy.actions.close}
        </Button>
      </div>

      <form
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.applicantType}
          </span>
          <select
            className={fieldClass}
            onChange={(event) =>
              update("applicantType", event.target.value === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL")
            }
            value={draft.applicantType}
          >
            <option value="INDIVIDUAL">{copy.apply.individual}</option>
            <option value="ORGANIZATION">{copy.apply.organization}</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.subjectName}
          </span>
          <input
            className={fieldClass}
            onChange={(event) => update("subjectName", event.target.value)}
            value={draft.subjectName}
          />
          {issueFor("subjectName") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("subjectName")}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.contactName}
          </span>
          <input
            className={fieldClass}
            onChange={(event) => update("contactName", event.target.value)}
            value={draft.contactName}
          />
          {issueFor("contactName") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("contactName")}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.contactPhone}
          </span>
          <input
            className={fieldClass}
            onChange={(event) => update("contactPhone", event.target.value)}
            value={draft.contactPhone}
          />
          {issueFor("contactPhone") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("contactPhone")}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.contactEmail}
          </span>
          <input
            className={fieldClass}
            onChange={(event) => update("contactEmail", event.target.value)}
            type="email"
            value={draft.contactEmail}
          />
          {issueFor("contactEmail") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("contactEmail")}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.targetLevel}
          </span>
          <select
            className={fieldClass}
            onChange={(event) => update("targetLevelNo", Number(event.target.value))}
            value={draft.targetLevelNo}
          >
            {levels.map((level) => (
              <option key={level.levelNo} value={level.levelNo}>
                {level.name} · {copy.program.level} {level.levelNo}
              </option>
            ))}
          </select>
          {issueFor("targetLevelNo") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("targetLevelNo")}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.inviteCode}
          </span>
          <input
            className={fieldClass}
            onChange={(event) => update("inviteCode", event.target.value)}
            value={draft.inviteCode}
          />
          {issueFor("inviteCode") ? (
            <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">
              {issueFor("inviteCode")}
            </span>
          ) : null}
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
            {copy.apply.businessIntro}
          </span>
          <textarea
            className="min-h-24 w-full rounded-[var(--sdk-radius-control)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm text-[var(--sdk-color-text-primary)] outline-none focus:border-[var(--sdk-color-border-focus)]"
            onChange={(event) => update("businessIntro", event.target.value)}
            value={draft.businessIntro}
          />
        </label>

        <div className="flex items-center justify-end gap-2 md:col-span-2">
          <Button onClick={onClose} type="button" variant="ghost">
            {copy.actions.close}
          </Button>
          <Button loading={isSubmitting} type="submit">
            {isSubmitting ? copy.actions.submitting : copy.apply.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
