import { useEffect, useState } from "react";

import {
  loadMallH5CashLedger,
  loadMallH5WalletOverview,
  type MallH5CashLedgerEntry,
  type MallH5WalletOverview,
} from "../account-service";

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
      <h1 className="sdk-h5-page-title">钱包</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-wallet-hero">
        <div>
          <div className="sdk-h5-wallet-label">现金余额</div>
          <div className="sdk-h5-wallet-amount">
            {overview?.cashBalanceCny != null ? `¥${overview.cashBalanceCny.toFixed(2)}` : "--"}
          </div>
        </div>
        <div>
          <div className="sdk-h5-wallet-label">积分</div>
          <div className="sdk-h5-wallet-amount">
            {overview?.pointsBalance != null ? overview.pointsBalance : "--"}
          </div>
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>现金流水</h2>
        {ledger.length === 0 ? (
          <div className="sdk-h5-empty">暂无流水记录</div>
        ) : (
          ledger.map((entry) => (
            <div className="sdk-h5-coupon-row" key={entry.id}>
              <div>
                <strong>{entry.summary}</strong>
                {entry.occurredAt ? <div className="sdk-h5-muted">{new Date(entry.occurredAt).toLocaleString("zh-CN")}</div> : null}
              </div>
              <strong>{entry.amountCny != null ? `¥${entry.amountCny.toFixed(2)}` : "--"}</strong>
            </div>
          ))
        )}
      </section>

      <p className="sdk-h5-muted">充值与提现将在支付渠道接入后开放。</p>
    </div>
  );
}
