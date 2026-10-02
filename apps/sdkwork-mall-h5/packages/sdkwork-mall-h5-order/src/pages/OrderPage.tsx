import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  cancelMallH5Order,
  confirmMallH5OrderReceipt,
  loadMallH5OrderDashboard,
  payMallH5Order,
  toRemoteOrderStatusFilter,
  type MallH5OrderDashboard,
  type MallH5OrderStatus,
  type MallH5OrderSummary,
} from "../order-service";
import { recallMallH5PaymentMethod } from "@sdkwork/mall-h5-cart/cart-service";

const STATUS_FILTERS: Array<{ code: "all" | MallH5OrderStatus; label: string }> = [
  { code: "all", label: "全部" },
  { code: "pending-payment", label: "待付款" },
  { code: "pending-shipment", label: "待发货" },
  { code: "pending-receipt", label: "待收货" },
  { code: "completed", label: "已完成" },
];

const STATUS_FILTER_CODES = STATUS_FILTERS.map((filter) => filter.code);

function parseStatusFilter(value: string | null): "all" | MallH5OrderStatus {
  if (value && (STATUS_FILTER_CODES as string[]).includes(value)) {
    return value as "all" | MallH5OrderStatus;
  }
  return "all";
}

function statusLabel(status: MallH5OrderStatus): string {
  return STATUS_FILTERS.find((filter) => filter.code === status)?.label ?? "订单";
}

export function SdkworkMallH5OrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = parseStatusFilter(searchParams.get("status"));
  const [dashboard, setDashboard] = useState<MallH5OrderDashboard | null>(null);
  const [loadedOrders, setLoadedOrders] = useState<MallH5OrderSummary[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (statusFilter: "all" | MallH5OrderStatus) => {
    const data = await loadMallH5OrderDashboard(1, statusFilter);
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
      const data = await loadMallH5OrderDashboard(nextPage, activeFilter);
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
    setLoading(true);
    reload(activeFilter)
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
  }, [activeFilter, reload]);

  async function runOrderAction(orderId: string, action: (id: string) => Promise<void>) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      await action(orderId);
      await reload(activeFilter);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handlePay(orderId: string) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      const paymentMethod = recallMallH5PaymentMethod() || "WECHAT";
      const { paymentId } = await payMallH5Order({ orderId, paymentMethod });
      const query = new URLSearchParams({ orderId, status: paymentId ? "pending" : "pending" });
      if (paymentId) {
        query.set("paymentId", paymentId);
      }
      query.set("paymentMethod", paymentMethod);
      window.location.assign(`/payment/result?${query.toString()}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "发起支付失败");
      setBusyOrderId(null);
    }
  }

  const serverSideFilter = toRemoteOrderStatusFilter(activeFilter) !== undefined;
  const orders = serverSideFilter
    ? loadedOrders
    : loadedOrders.filter((order) => activeFilter === "all" || order.status === activeFilter);

  function renderAction(order: MallH5OrderSummary) {
    const busy = busyOrderId === order.id;
    if (order.status === "pending-payment") {
      return (
        <>
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={busy}
            onClick={() => void handlePay(order.id)}
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
            onClick={() => setSearchParams(filter.code === "all" ? {} : { status: filter.code })}
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
                <Link to={`/buyer/orders/${encodeURIComponent(order.id)}`}>
                  <strong>{order.subject}</strong>
                </Link>
                <span className="sdk-h5-order-status">{statusLabel(order.status)}</span>
              </header>
              <div className="sdk-h5-order-meta">
                <span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
                <strong>{order.totalAmountCny != null ? `¥${order.totalAmountCny.toFixed(2)}` : "--"}</strong>
              </div>
              <footer className="sdk-h5-action-row">
                <Link
                  className="sdk-h5-button sdk-h5-button-ghost"
                  to={`/buyer/orders/${encodeURIComponent(order.id)}`}
                >
                  订单详情
                </Link>
                {renderAction(order)}
              </footer>
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
