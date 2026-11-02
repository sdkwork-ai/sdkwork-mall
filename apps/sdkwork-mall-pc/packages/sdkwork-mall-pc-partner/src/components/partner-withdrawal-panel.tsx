import { useState } from "react";
import { Button } from "@sdkwork/ui-pc-react";
import { Wallet } from "lucide-react";

import type {
  SdkworkPartnerCenterBalance,
  SdkworkPartnerWithdrawal,
} from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";

export interface SdkworkPartnerWithdrawalPanelProps {
  readonly balance: SdkworkPartnerCenterBalance;
  readonly error: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly isLoading: boolean;
  readonly isWithdrawing: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onSubmit: (draft: { amount: string; remark: string }) => Promise<boolean>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly withdrawals: readonly SdkworkPartnerWithdrawal[];
}

export function SdkworkPartnerWithdrawalPanel({
  balance,
  error,
  intl,
  isLoading,
  isWithdrawing,
  onPageChange,
  onSubmit,
  page,
  pageSize,
  total,
  withdrawals,
}: SdkworkPartnerWithdrawalPanelProps) {
  const { copy } = intl;
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const submit = async (): Promise<void> => {
    setSuccess(false);
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setLocalError(copy.withdrawals.invalidAmount);
      return;
    }
    if (parsed > Number(balance.available)) {
      setLocalError(copy.withdrawals.exceedsBalance);
      return;
    }
    if (parsed < Number(balance.minWithdrawal)) {
      setLocalError(copy.withdrawals.belowMin);
      return;
    }
    setLocalError("");
    if (await onSubmit({ amount: amount.trim(), remark: remark.trim() })) {
      setAmount("");
      setRemark("");
      setSuccess(true);
    }
  };

  return (
    <section className="space-y-3" data-slot="partner-withdrawals">
      <header className="flex items-start gap-2">
        <Wallet aria-hidden="true" className="mt-0.5 text-[var(--sdk-color-brand-primary)]" size={18} />
        <div>
          <h2 className="text-lg font-semibold text-[var(--sdk-color-text-primary)]">
            {copy.withdrawals.title}
          </h2>
          <p className="text-sm text-[var(--sdk-color-text-secondary)]">
            {copy.withdrawals.description}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { key: copy.withdrawals.available, value: balance.available },
          { key: copy.withdrawals.pending, value: balance.pending },
          { key: copy.withdrawals.totalEarned, value: balance.settledTotal },
          { key: copy.withdrawals.withdrawn, value: balance.withdrawn },
        ].map((metric) => (
          <div
            className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-3"
            key={metric.key}
          >
            <dt className="text-xs text-[var(--sdk-color-text-secondary)]">{metric.key}</dt>
            <dd className="mt-1 text-lg font-semibold text-[var(--sdk-color-text-primary)]">
              {intl.formatMoney(metric.value, balance.currency)}
            </dd>
          </div>
        ))}
      </dl>

      <form
        className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 flex items-center justify-between text-[var(--sdk-color-text-secondary)]">
              <span>{copy.withdrawals.amount}</span>
              <span className="text-xs">
                {copy.withdrawals.minWithdrawal.replace(
                  "{value}",
                  intl.formatMoney(balance.minWithdrawal, balance.currency),
                )}
              </span>
            </span>
            <input
              className="h-10 w-full rounded-[var(--sdk-radius-control)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 text-sm outline-none focus:border-[var(--sdk-color-border-focus)]"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder={copy.withdrawals.amountPlaceholder}
              value={amount}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--sdk-color-text-secondary)]">
              {copy.withdrawals.remark}
            </span>
            <input
              className="h-10 w-full rounded-[var(--sdk-radius-control)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 text-sm outline-none focus:border-[var(--sdk-color-border-focus)]"
              onChange={(event) => setRemark(event.target.value)}
              placeholder={copy.withdrawals.remarkPlaceholder}
              value={remark}
            />
          </label>
        </div>

        {localError ? (
          <p className="mt-2 text-sm text-[var(--sdk-color-state-danger)]">{localError}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-[var(--sdk-color-state-danger)]">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-2 text-sm text-[var(--sdk-color-state-success)]">
            {copy.withdrawals.success}
          </p>
        ) : null}

        <div className="mt-3 flex justify-end">
          <Button loading={isWithdrawing} type="submit">
            {isWithdrawing ? copy.withdrawals.submitting : copy.withdrawals.submit}
          </Button>
        </div>
      </form>

      {withdrawals.length === 0 ? (
        <p className="rounded-[var(--sdk-radius-panel)] border border-dashed border-[var(--sdk-color-border-strong)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]">
          {copy.withdrawals.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {withdrawals.map((withdrawal) => (
            <li
              className="rounded-[var(--sdk-radius-panel)] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-3"
              key={withdrawal.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold">
                  {intl.formatMoney(withdrawal.amount, balance.currency)}
                </span>
                <span className="rounded-full bg-[var(--sdk-color-brand-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--sdk-color-brand-primary)]">
                  {intl.formatWithdrawalStatus(withdrawal.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--sdk-color-text-secondary)]">
                {copy.withdrawals.requestedAt}: {intl.formatDate(withdrawal.createdAt)}
                {withdrawal.paidAt
                  ? ` · ${copy.withdrawals.paidAt}: ${intl.formatDate(withdrawal.paidAt)}`
                  : ""}
              </p>
              {withdrawal.reviewRemark ? (
                <p className="mt-1 text-sm">
                  {copy.withdrawals.reviewRemark}: {withdrawal.reviewRemark}
                </p>
              ) : null}
              {withdrawal.remark ? (
                <p className="mt-1 text-sm text-[var(--sdk-color-text-secondary)]">
                  {withdrawal.remark}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          variant="outline"
        >
          {copy.withdrawals.previousPage}
        </Button>
        <span className="text-xs text-[var(--sdk-color-text-secondary)]">
          {intl.formatPage(copy.withdrawals.page, page, pageCount)}
        </span>
        <Button
          disabled={page >= pageCount || isLoading}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          {copy.withdrawals.nextPage}
        </Button>
      </div>
    </section>
  );
}
