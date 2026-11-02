import { Button } from "@sdkwork/ui-pc-react";

import type { SdkworkPartnerTeamMember } from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerTeamTableProps {
  readonly currency: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly isLoading: boolean;
  readonly members: readonly SdkworkPartnerTeamMember[];
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function SdkworkPartnerTeamTable({
  currency,
  intl,
  isLoading,
  members,
  onPageChange,
  page,
  pageSize,
  total,
}: SdkworkPartnerTeamTableProps) {
  const { copy } = intl;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-3" data-slot="partner-team">
      <header>
        <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
          {copy.team.title}
        </h2>
        <p className="text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.team.description}
        </p>
      </header>

      {members.length === 0 ? (
        <p className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.team.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)]">
          <table className="min-w-full divide-y divide-[var(--sdk-color-border-subtle)] text-sm">
            <thead className="bg-[var(--sdk-color-surface-panel-muted)] text-left text-xs uppercase tracking-wide text-[var(--sdk-color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 font-medium">{copy.team.member}</th>
                <th className="px-3 py-2 font-medium">{copy.team.level}</th>
                <th className="px-3 py-2 font-medium">{copy.team.depth}</th>
                <th className="px-3 py-2 font-medium">{copy.team.customerCount}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.team.totalCommission}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {copy.team.availableBalance}
                </th>
                <th className="px-3 py-2 font-medium">{copy.team.joinedAt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel)]">
              {members.map((member) => (
                <tr key={member.partnerId}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--sdk-color-text-primary)]">
                      {member.name || member.partnerId}
                    </div>
                    <div className="text-xs text-[var(--sdk-color-text-secondary)]">
                      {copy.team.directTeam} {member.directTeamSize}
                    </div>
                  </td>
                  <td className="px-3 py-2">{member.levelName || member.levelNo}</td>
                  <td className="px-3 py-2">{member.depth}</td>
                  <td className="px-3 py-2">{member.customerCount}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {intl.formatMoney(member.totalCommission, currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {intl.formatMoney(member.availableBalance, currency)}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--sdk-color-text-secondary)]">
                    {intl.formatDate(member.joinedAt)}
                  </td>
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
          {copy.team.previousPage}
        </Button>
        <span className="text-xs text-[var(--sdk-color-text-secondary)]">
          {intl.formatPage(copy.team.page, page, pageCount)}
        </span>
        <Button
          disabled={page >= pageCount || isLoading}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          {copy.team.nextPage}
        </Button>
      </div>
    </section>
  );
}
