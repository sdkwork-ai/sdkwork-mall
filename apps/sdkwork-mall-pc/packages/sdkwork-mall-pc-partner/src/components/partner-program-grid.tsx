import { CheckCircle2 } from "lucide-react";

import {
  orderSdkworkPartnerLevels,
  type SdkworkPartnerProgram,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerProgramGridProps {
  readonly currency: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly program: SdkworkPartnerProgram;
}

export function SdkworkPartnerProgramGrid({
  currency,
  intl,
  program,
}: SdkworkPartnerProgramGridProps) {
  const { copy } = intl;
  const levels = orderSdkworkPartnerLevels(program.levels);

  return (
    <section className="space-y-4" data-slot="partner-program">
      <header>
        <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.program.title}
        </h2>
        <p className="text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.program.description}
        </p>
      </header>

      {levels.length === 0 ? (
        <p className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.program.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => (
            <li
              className={`rounded-[var(--sdk-radius-panel)] border bg-[var(--sdk-color-surface-panel)] p-4 shadow-[var(--sdk-shadow-sm)] ${
                level.status === "ACTIVE"
                  ? "border-[var(--sdk-color-border-default)]"
                  : "border-dashed border-[var(--sdk-color-border-subtle)] opacity-70"
              }`}
              key={level.levelNo}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[var(--sdk-color-text-primary)]">
                  {level.name}
                </h3>
                <span className="rounded-full bg-[var(--sdk-color-brand-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--sdk-color-brand-primary)]">
                  {copy.program.level} {level.levelNo}
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--sdk-color-text-secondary)]">
                    {copy.program.joinFee}
                  </dt>
                  <dd className="font-semibold text-[var(--sdk-color-text-primary)]">
                    {intl.formatMoney(level.joinFee, currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--sdk-color-text-secondary)]">
                    {copy.program.customerRevenue}
                  </dt>
                  <dd className="font-semibold text-[var(--sdk-color-text-primary)]">
                    {intl.formatPercent(level.customerRevenueRatio)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--sdk-color-text-secondary)]">
                    {copy.program.joinFeeCommission}
                  </dt>
                  <dd className="font-semibold text-[var(--sdk-color-text-primary)]">
                    {intl.formatPercent(level.joinFeeCommissionRatio)}
                  </dd>
                </div>
              </dl>

              {level.benefits.length > 0 ? (
                <div className="mt-3 border-t border-[var(--sdk-color-border-subtle)] pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--sdk-color-text-secondary)]">
                    {copy.program.benefits}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {level.benefits.map((benefit) => (
                      <li
                        className="flex items-start gap-1.5 text-sm text-[var(--sdk-color-text-secondary)]"
                        key={benefit.code}
                      >
                        <CheckCircle2
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-[var(--sdk-color-state-success)]"
                          size={14}
                        />
                        <span>
                          {benefit.name}
                          {benefit.value ? ` · ${benefit.value}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel-muted)] p-4">
        <h3 className="text-sm font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.program.rules}
        </h3>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.currency}
            </dt>
            <dd className="font-medium">{currency}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.profitMargin}
            </dt>
            <dd className="font-medium">
              {intl.formatPercent(program.rules.profitMarginRatio)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.minWithdrawal}
            </dt>
            <dd className="font-medium">
              {intl.formatMoney(program.rules.minWithdrawalAmount, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">
              {copy.program.joinFeePolicy}
            </dt>
            <dd className="font-medium">{program.rules.joinFeePolicy || "—"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
