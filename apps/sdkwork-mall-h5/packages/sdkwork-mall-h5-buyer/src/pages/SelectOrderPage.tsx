import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { completeOrderPick } from "../order-pick-channel";
import { loadMallH5BuyerOrders } from "../buyer-service";
import { formatMallH5Cny } from "@sdkwork/mall-h5-commons";

const STATUS_TEXT: Record<string, string> = {
  cancelled: "已取消",
  completed: "已完成",
  expired: "已超时",
  paid: "已支付",
  "pending-payment": "待付款",
  "pending-receipt": "待收货",
  "pending-shipment": "待发货",
  refunded: "已退款",
  refunding: "退款中",
  unknown: "处理中",
};

/**
 * Navigate-to-select picker for the after-sales order reference: lists the
 * buyer's orders (paged) and completes the pick channel on selection.
 */
export function SdkworkMallH5SelectOrderPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Array<{
    createdAt: string;
    id: string;
    statusText: string;
    subject: string;
    totalText: string;
  }>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    if (nextPage > 1) {
      setLoadingMore(true);
    }
    try {
      const data = await loadMallH5BuyerOrders(nextPage);
      setOrders((current) => {
        const rows = data.orders.map((order) => ({
          createdAt: order.createdAt,
          id: order.id,
          statusText: STATUS_TEXT[order.status] ?? "处理中",
          subject: order.subject,
          totalText: order.totalAmountCny != null ? formatMallH5Cny(order.totalAmountCny) : "--",
        }));
        const merged = nextPage === 1 ? rows : [...current, ...rows];
        const known = new Set<string>();
        return merged.filter((order) => (known.has(order.id) ? false : (known.add(order.id), true)));
      });
      setHasMore(data.orders.length >= 20);
      setPage(nextPage);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "订单加载失败");
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-cell-group">
        {loading ? <div className="sdk-h5-loading">加载订单...</div> : null}
        {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}
        {!loading && orders.length === 0 ? (
          <div className="sdk-h5-empty">暂无可选订单</div>
        ) : null}
        {orders.map((order) => (
          <button
            className="sdk-h5-cell"
            key={order.id}
            onClick={() => {
              completeOrderPick(order.id);
              navigate(-1);
            }}
            type="button"
          >
            <span className="sdk-h5-cell-main">
              <span className="sdk-h5-cell-title">{order.subject}</span>
              <span className="sdk-h5-cell-sub">{order.id} · {order.statusText} · {order.createdAt.slice(0, 10)}</span>
            </span>
            <span className="sdk-h5-cell-value">{order.totalText}</span>
          </button>
        ))}
      </div>
      {hasMore ? (
        <div className="sdk-h5-center">
          <button
            className="sdk-h5-button sdk-h5-button-secondary"
            disabled={loadingMore}
            onClick={() => void load(page + 1)}
            type="button"
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
