import { Share2, UserRoundCheck, Users } from "lucide-react";

import type { SdkworkPartnerCenterAvailability } from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerCenterSectionProps {
  readonly center: SdkworkPartnerCenterAvailability | null;
  readonly intl: SdkworkPartnerIntlValue;
}

export function SdkworkPartnerCenterSection({
  center,
  intl,
}: SdkworkPartnerCenterSectionProps) {
  const { copy } = intl;

  if (!center || !center.available) {
    return (
      <section
        className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] bg-[var(--sdk-color-surface-panel-muted)] p-4"
        data-slot="partner-center-unavailable"
      >
        <h2 className="text-base font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.center.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--sdk-color-text-secondary)]">
          {center?.reason === "not-enrolled"
            ? copy.center.notEnrolled
            : center?.reason === "not-supported"
              ? copy.center.notSupported
              : copy.center.notConfigured}
        </p>
      </section>
    );
  }

  const { snapshot } = center;
  const metrics = [
    { icon: Users, label: copy.center.team, value: String(snapshot.counts.teamSize) },
    { icon: Users, label: copy.center.directTeam, value: String(snapshot.counts.directTeamSize) },
    { icon: UserRoundCheck, label: copy.center.customers, value: String(snapshot.counts.customerCount) },
  ];

  return (
    <section className="space-y-3" data-slot="partner-center">
      <header>
        <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.center.title}
        </h2>
        <p className="text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.center.description}
        </p>
      </header>
      <dl className="grid grid-cols-3 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-3"
              key={metric.label}
            >
              <dt className="flex items-center gap-1.5 text-xs text-[var(--sdk-color-text-secondary)]">
                <Icon aria-hidden="true" size={14} />
                {metric.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-[var(--sdk-color-text-primary)]">
                {metric.value}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="flex items-center gap-1.5 text-xs text-[var(--sdk-color-text-secondary)]">
        <Share2 aria-hidden="true" size={14} />
        {copy.center.inviteCode}:{" "}
        <span className="font-semibold text-[var(--sdk-color-text-primary)]">
          {snapshot.profile.inviteCode || "—"}
        </span>
      </p>
    </section>
  );
}
