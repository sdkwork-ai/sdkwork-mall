import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  loadMallH5PendingReviewOrders,
  type MallH5PendingReviewOrder,
} from "../reviews-service";

export function SdkworkMallH5ReviewsPage() {
  const [orders, setOrders] = useState<MallH5PendingReviewOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setOrders(await loadMallH5PendingReviewOrders());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "评价加载失败");
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
  }, [reload]);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载评价...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">我的评价</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-section">
        <h2>待评价</h2>
        {orders.length === 0 ? (
          error ? null : <div className="sdk-h5-empty">已完成订单可在这里提交评价</div>
        ) : (
          <div className="sdk-h5-cart-list">
            {orders.map((order) => (
              <div className="sdk-h5-cart-row" key={order.id}>
                <div className="sdk-h5-cart-row-body">
                  <Link
                    className="sdk-h5-product-title"
                    to={`/buyer/orders/${encodeURIComponent(order.id)}`}
                  >
                    {order.subject}
                  </Link>
                  <div className="sdk-h5-product-meta">
                    <span className="sdk-h5-muted">订单号 {order.id}</span>
                    {order.paidAmountCny != null ? (
                      <strong>¥{order.paidAmountCny.toFixed(2)}</strong>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="sdk-h5-action-row">
          <Link className="sdk-h5-button sdk-h5-button-secondary" to="/buyer/orders">
            查看全部订单
          </Link>
          <Link className="sdk-h5-button sdk-h5-button-ghost" to="/buyer/after-sales">
            申请售后
          </Link>
        </div>
      </section>

      <p className="sdk-h5-footnote">
        商品晒单与媒体上传需等待 T1 商品评价 API 合约落地。
      </p>
    </div>
  );
}
