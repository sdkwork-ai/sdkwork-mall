import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  cancelMallH5Order,
  confirmMallH5OrderReceipt,
  loadMallH5OrderDashboard,
  payMallH5Order,
  type MallH5OrderDashboard,
  type MallH5OrderStatus,
  type MallH5OrderSummary,
} from "../order-service";

const STATUS_FILTERS: Array<{ code: "all" | MallH5OrderStatus; label: string }> = [
  { code: "all", label: "全部" },
  { code: "pending-payment", label: "待付款" },
  { code: "pending-shipment", label: "待发货" },
  { code: "pending-receipt", label: "待收货" },
  { code: "completed", label: "已完成" },
];

function statusLabel(status: MallH5OrderStatus): string {
  return STATUS_FILTERS.find((filter) => filter.code === status)?.label ?? "订单";
}

export function SdkworkMallH5OrderPage() {
  const [dashboard, setDashboard] = useState<MallH5OrderDashboard | null>(null);
  const [loadedOrders, setLoadedOrders] = useState<MallH5OrderSummary[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | MallH5OrderStatus>("all");
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await loadMallH5OrderDashboard(1);
    setDashboard(data);
    setLoadedOrders(data.orders);
    setOrdersPage(1);
    setOrdersHasMore(data.orders.length >= 20);
  }, []);

  async function loadMoreOrders() {
    if (loadingMore || !ordersHasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = ordersPage + 1;
      const data = await loadMallH5OrderDashboard(nextPage);
      setDashboard((current) => current ?? data);
      setLoadedOrders((current) => {
        const known = new Set(current.map((order) => order.id));
        return [...current, ...data.orders.filter((order) => !known.has(order.id))];
      });
      setOrdersPage(nextPage);
      setOrdersHasMore(data.orders.length >= 20);
    } catch {
      // 加载更多失败时保留当前列表，用户可重试。
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "订单加载失败");
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

  async function runOrderAction(orderId: string, action: (id: string) => Promise<void>) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      await action(orderId);
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusyOrderId(null);
    }
  }

  const orders = loadedOrders.filter(
    (order) => activeFilter === "all" || order.status === activeFilter,
  );

  function renderAction(order: MallH5OrderSummary) {
    const busy = busyOrderId === order.id;
    if (order.status === "pending-payment") {
      return (
        <>
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={busy}
            onClick={() => void runOrderAction(order.id, (id) => payMallH5Order({ orderId: id, paymentMethod: "WECHAT" }))}
            type="button"
          >
            去支付
          </button>
          <button
            className="sdk-h5-button sdk-h5-button-ghost"
            disabled={busy}
            onClick={() => void runOrderAction(order.id, (id) => cancelMallH5Order({ orderId: id }))}
            type="button"
          >
            取消订单
          </button>
        </>
      );
    }
    if (order.status === "pending-receipt") {
      return (
        <>
          <Link className="sdk-h5-button sdk-h5-button-secondary" to={`/buyer/logistics?orderId=${encodeURIComponent(order.id)}`}>
            查看物流
          </Link>
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={busy}
            onClick={() => void runOrderAction(order.id, (id) => confirmMallH5OrderReceipt({ orderId: id }))}
            type="button"
          >
            确认收货
          </button>
        </>
      );
    }
    if (order.status === "pending-shipment") {
      return <span className="sdk-h5-muted">商家备货中</span>;
    }
    if (order.status === "completed" || order.status === "refunding" || order.status === "refunded") {
      return (
        <Link className="sdk-h5-button sdk-h5-button-secondary" to={`/buyer/after-sales?orderId=${encodeURIComponent(order.id)}`}>
          {order.status === "completed" ? "申请售后" : "售后详情"}
        </Link>
      );
    }
    return null;
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载订单...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-sort-row">
        {STATUS_FILTERS.map((filter) => (
          <button
            className={activeFilter === filter.code ? "sdk-h5-sort sdk-h5-sort-active" : "sdk-h5-sort"}
            key={filter.code}
            onClick={() => setActiveFilter(filter.code)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {orders.length === 0 ? (
        <div className="sdk-h5-empty">暂无订单</div>
      ) : (
        <>
        <div className="sdk-h5-order-list">
          {orders.map((order) => (
            <article className="sdk-h5-order-row" key={order.id}>
              <header>
                <strong>{order.subject}</strong>
                <span className="sdk-h5-order-status">{statusLabel(order.status)}</span>
              </header>
              <div className="sdk-h5-order-meta">
                <span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
                <strong>{order.totalAmountCny != null ? `¥${order.totalAmountCny.toFixed(2)}` : "--"}</strong>
              </div>
              <footer className="sdk-h5-action-row">{renderAction(order)}</footer>
            </article>
          ))}
        </div>
        {ordersHasMore ? (
          <div className="sdk-h5-center">
            <button
              className="sdk-h5-button sdk-h5-button-secondary"
              disabled={loadingMore}
              onClick={() => void loadMoreOrders()}
              type="button"
            >
              {loadingMore ? "加载中..." : "加载更多订单"}
            </button>
          </div>
        ) : null}
        </>
      )}
    </div>
  );
}
