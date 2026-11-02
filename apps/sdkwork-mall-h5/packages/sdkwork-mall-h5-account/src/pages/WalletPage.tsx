import { useEffect, useState } from "react";

import {
  loadMallH5CashLedger,
  loadMallH5WalletOverview,
  type MallH5CashLedgerEntry,
  type MallH5WalletOverview,
} from "../account-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

export function SdkworkMallH5WalletPage() {
  const [overview, setOverview] = useState<MallH5WalletOverview | null>(null);
  const [ledger, setLedger] = useState<MallH5CashLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([loadMallH5WalletOverview(), loadMallH5CashLedger()])
      .then(([walletOverview, cashLedger]) => {
        if (active) {
          setOverview(walletOverview);
          setLedger(cashLedger);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "钱包加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载钱包...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">钱包</h1>

      {error ? <SdkworkMallH5ErrorState message={error} /> : null}

      <section className="sdk-h5-wallet-hero">
        <div className="sdk-h5-wallet-hero-label">现金余额（元）</div>
        <div className="sdk-h5-wallet-hero-amount">
          {overview?.cashBalanceCny != null ? overview.cashBalanceCny.toFixed(2) : "--"}
        </div>
        <div className="sdk-h5-wallet-hero-points">
          <span className="sdk-h5-wallet-hero-points-label">积分余额</span>
          <strong className="sdk-h5-wallet-hero-points-value">
            {overview?.pointsBalance != null ? overview.pointsBalance : "--"}
          </strong>
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>现金流水</h2>
        {ledger.length === 0 ? (
          <div className="sdk-h5-empty">暂无流水记录</div>
        ) : (
          <div className="sdk-h5-ledger-list">
            {ledger.map((entry) => {
              const positive = entry.amountCny != null && entry.amountCny >= 0;
              return (
                <div className="sdk-h5-ledger-row" key={entry.id}>
                  <span className="sdk-h5-ledger-icon" aria-hidden="true">
                    {positive ? "入" : "出"}
                  </span>
                  <div className="sdk-h5-ledger-body">
                    <strong>{entry.summary}</strong>
                    {entry.occurredAt ? (
                      <div className="sdk-h5-muted">{new Date(entry.occurredAt).toLocaleString("zh-CN")}</div>
                    ) : null}
                  </div>
                  <strong className={positive ? "sdk-h5-ledger-amount-in" : "sdk-h5-ledger-amount-out"}>
                    {entry.amountCny != null ? `${positive ? "+" : "-"}¥${Math.abs(entry.amountCny).toFixed(2)}` : "--"}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="sdk-h5-muted sdk-h5-footnote">充值与提现将在支付渠道接入后开放。</p>
    </div>
  );
}
