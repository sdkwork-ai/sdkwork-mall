import { Button } from "@sdkwork/ui-pc-react";
import { Clock3 } from "lucide-react";

import {
  canCancelSdkworkPartnerApplication,
  type SdkworkPartnerApplication,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerApplicationsListProps {
  readonly applications: readonly SdkworkPartnerApplication[];
  readonly cancellingId: string | null;
  readonly intl: SdkworkPartnerIntlValue;
  readonly onCancel: (applicationId: string) => void;
}

export function SdkworkPartnerApplicationsList({
  applications,
  cancellingId,
  intl,
  onCancel,
}: SdkworkPartnerApplicationsListProps) {
  const { copy } = intl;

  return (
    <section className="space-y-3" data-slot="partner-applications">
      <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
        {copy.applications.title}
      </h2>

      {applications.length === 0 ? (
        <p className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.applications.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {applications.map((application) => (
            <li
              className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-4"
              key={application.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--sdk-color-brand-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--sdk-color-brand-primary)]">
                      {intl.formatStatus(application.status)}
                    </span>
                    <span className="text-xs text-[var(--sdk-color-text-secondary)]">
                      {copy.applications.submittedAt}: {intl.formatDate(application.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--sdk-color-text-primary)]">
                    {application.subjectName || application.contactName}
                  </p>
                  <p className="text-xs text-[var(--sdk-color-text-secondary)]">
                    {copy.applications.targetLevel} {application.targetLevelNo}
                    {application.inviteCode
                      ? ` · ${copy.applications.inviteCode} ${application.inviteCode}`
                      : ""}
                  </p>
                  {application.reviewComment ? (
                    <p className="mt-1 text-sm text-[var(--sdk-color-text-secondary)]">
                      {copy.applications.reviewComment}: {application.reviewComment}
                    </p>
                  ) : null}
                </div>
                {canCancelSdkworkPartnerApplication(application) ? (
                  <Button
                    loading={cancellingId === application.id}
                    onClick={() => onCancel(application.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Clock3 aria-hidden="true" size={14} />
                    {copy.actions.cancelApplication}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
