import { Button } from "@sdkwork/ui-pc-react";

import type { SdkworkPartnerCommissionRecord } from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerCommissionTableProps {
  readonly currency: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly isLoading: boolean;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly records: readonly SdkworkPartnerCommissionRecord[];
  readonly total: number;
}

export function SdkworkPartnerCommissionTable({
  currency,
  intl,
  isLoading,
  onPageChange,
  page,
  pageSize,
  records,
  total,
}: SdkworkPartnerCommissionTableProps) {
  const { copy } = intl;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-3" data-slot="partner-commissions">
      <header>
        <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.commissions.title}
        </h2>
        <p className="text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.commissions.description}
        </p>
      </header>

      {records.length === 0 ? (
        <p className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.commissions.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)]">
          <table className="min-w-full divide-y divide-[var(--sdk-color-border-subtle)] text-sm">
            <thead className="bg-[var(--sdk-color-surface-panel-muted)] text-left text-xs uppercase tracking-wide text-[var(--sdk-color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 font-medium">{copy.commissions.computedAt}</th>
                <th className="px-3 py-2 font-medium">{copy.commissions.source}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.commissions.baseAmount}
                </th>
                <th className="px-3 py-2 text-right font-medium">{copy.commissions.ratio}</th>
                <th className="px-3 py-2 text-right font-medium">{copy.commissions.amount}</th>
                <th className="px-3 py-2 font-medium">{copy.commissions.levelOffset}</th>
                <th className="px-3 py-2 font-medium">{copy.commissions.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel)]">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-2 text-xs text-[var(--sdk-color-text-secondary)]">
                    {intl.formatDate(record.computedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--sdk-color-text-primary)]">
                      {record.sourceType}
                    </div>
                    <div className="text-xs text-[var(--sdk-color-text-secondary)]">
                      {record.sourceRef || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {intl.formatMoney(record.baseAmount, currency)}
                  </td>
                  <td className="px-3 py-2 text-right">{intl.formatPercent(record.ratio)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {intl.formatMoney(record.amount, currency)}
                  </td>
                  <td className="px-3 py-2">{record.levelOffset}</td>
                  <td className="px-3 py-2 text-xs">{record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          variant="outline"
        >
          {copy.commissions.previousPage}
        </Button>
        <span className="text-xs text-[var(--sdk-color-text-secondary)]">
          {intl.formatPage(copy.commissions.page, page, pageCount)}
        </span>
        <Button
          disabled={page >= pageCount || isLoading}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          {copy.commissions.nextPage}
        </Button>
      </div>
    </section>
  );
}
