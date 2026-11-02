import { Button } from "@sdkwork/ui-pc-react";
import { BadgeCheck, Clock3, Sparkles, XCircle } from "lucide-react";

import {
  summarizeSdkworkPartnerProgram,
  type SdkworkPartnerMembership,
  type SdkworkPartnerProgram,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

const STATE_TONE: Record<SdkworkPartnerMembership["state"], string> = {
  approved:
    "border-[color-mix(in_srgb,var(--sdk-color-state-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--sdk-color-state-success)_12%,transparent)]",
  cancelled:
    "border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel-muted)]",
  none: "border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)]",
  pending:
    "border-[color-mix(in_srgb,var(--sdk-color-state-warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--sdk-color-state-warning)_12%,transparent)]",
  rejected:
    "border-[color-mix(in_srgb,var(--sdk-color-state-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--sdk-color-state-danger)_12%,transparent)]",
};

const STATE_ICON = {
  approved: BadgeCheck,
  cancelled: Clock3,
  none: Sparkles,
  pending: Clock3,
  rejected: XCircle,
} as const;

export interface SdkworkPartnerStatusHeroProps {
  readonly intl: SdkworkPartnerIntlValue;
  readonly membership: SdkworkPartnerMembership;
  readonly program: SdkworkPartnerProgram | null;
  readonly onApply: () => void;
}

export function SdkworkPartnerStatusHero({
  intl,
  membership,
  onApply,
  program,
}: SdkworkPartnerStatusHeroProps) {
  const { copy } = intl;
  const status = copy.status[membership.state];
  const Icon = STATE_ICON[membership.state];
  const summary = program ? summarizeSdkworkPartnerProgram(program) : null;
  const canApply = membership.state !== "pending";

  return (
    <section
      className={`rounded-[var(--sdk-radius-panel)] border p-5 shadow-[var(--sdk-shadow-sm)] ${STATE_TONE[membership.state]}`}
      data-slot="partner-status-hero"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sdk-color-brand-primary-soft)] text-[var(--sdk-color-brand-primary)]">
            <Icon aria-hidden="true" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sdk-color-text-secondary)]">
              {copy.page.eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--sdk-color-text-primary)]">
              {copy.page.title}
            </h1>
            <p className="mt-1 text-sm font-medium text-[var(--sdk-color-text-primary)]">
              {status.title}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-[var(--sdk-color-text-secondary)]">
              {status.description}
            </p>
          </div>
        </div>
        {canApply ? (
          <Button onClick={onApply} variant={membership.state === "approved" ? "outline" : "primary"}>
            {membership.state === "approved" ? copy.actions.reapply : copy.actions.apply}
          </Button>
        ) : null}
      </div>

      {summary && program ? (
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--sdk-radius-control)] bg-[var(--sdk-color-surface-panel)] px-3 py-2">
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.level}
            </dt>
            <dd className="text-sm font-semibold text-[var(--sdk-color-text-primary)]">
              {copy.summary.levelCount.replace("{count}", String(summary.levelCount))}
            </dd>
          </div>
          <div className="rounded-[var(--sdk-radius-control)] bg-[var(--sdk-color-surface-panel)] px-3 py-2">
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.customerRevenue}
            </dt>
            <dd className="text-sm font-semibold text-[var(--sdk-color-text-primary)]">
              {intl.formatPercent(summary.maxCustomerRevenue)}
            </dd>
          </div>
          <div className="rounded-[var(--sdk-radius-control)] bg-[var(--sdk-color-surface-panel)] px-3 py-2">
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.joinFee}
            </dt>
            <dd className="text-sm font-semibold text-[var(--sdk-color-text-primary)]">
              {intl.formatMoney(summary.minJoinFee, program.rules.currency)}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
