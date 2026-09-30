import { useEffect, useState } from "react";

import { loadMallH5Points, type MallH5PointsSummary } from "../account-service";

export function SdkworkMallH5PointsPage() {
  const [summary, setSummary] = useState<MallH5PointsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMallH5Points()
      .then((data) => {
        if (active) {
          setSummary(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "积分加载失败");
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
    return <div className="sdk-h5-page sdk-h5-loading">加载积分...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">我的积分</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-wallet-hero">
        <div>
          <div className="sdk-h5-wallet-label">可用积分</div>
          <div className="sdk-h5-wallet-amount">{summary?.balance != null ? summary.balance : "--"}</div>
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>积分批次</h2>
        {!summary || summary.lots.length === 0 ? (
          <div className="sdk-h5-empty">暂无积分批次</div>
        ) : (
          summary.lots.map((lot) => (
            <div className="sdk-h5-coupon-row" key={lot.id}>
              <strong>{lot.points != null ? `${lot.points} 分` : "--"}</strong>
              <span className="sdk-h5-muted">{lot.expiresAt ? `${lot.expiresAt} 到期` : "长期有效"}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
