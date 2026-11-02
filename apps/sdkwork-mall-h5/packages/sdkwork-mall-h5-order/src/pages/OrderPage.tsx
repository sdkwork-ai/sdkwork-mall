import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import {
  cancelMallH5Order,
  confirmMallH5OrderReceipt,
  loadMallH5OrderDashboard,
  MALL_H5_ORDER_STATUS_LABEL_KEYS,
  payMallH5Order,
  toRemoteOrderStatusFilter,
  type MallH5OrderDashboard,
  type MallH5OrderStatus,
  type MallH5OrderSummary,
} from "../order-service";
import { recallMallH5PaymentMethod } from "@sdkwork/mall-h5-cart/cart-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

const STATUS_FILTERS: Array<{ code: "all" | MallH5OrderStatus; labelKey: string }> = [
  { code: "all", labelKey: "orderList.filters.all" },
  { code: "pending-payment", labelKey: "orderList.filters.pendingPayment" },
  { code: "pending-shipment", labelKey: "orderList.filters.pendingShipment" },
  { code: "pending-receipt", labelKey: "orderList.filters.pendingReceipt" },
  { code: "completed", labelKey: "orderList.filters.completed" },
];

const STATUS_FILTER_CODES = STATUS_FILTERS.map((filter) => filter.code);

function parseStatusFilter(value: string | null): "all" | MallH5OrderStatus {
  if (value && (STATUS_FILTER_CODES as string[]).includes(value)) {
    return value as "all" | MallH5OrderStatus;
  }
  return "all";
}

export function SdkworkMallH5OrderPage() {
  const { t } = useTranslation();
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

  function statusLabel(status: MallH5OrderStatus): string {
    return t(MALL_H5_ORDER_STATUS_LABEL_KEYS[status] ?? "orderList.statusFallback");
  }

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
          setError(cause instanceof Error ? cause.message : t("orderDetail.errors.load"));
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
  }, [activeFilter, reload, t]);

  async function runOrderAction(orderId: string, action: (id: string) => Promise<void>) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      await action(orderId);
      await reload(activeFilter);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : t("orderDetail.errors.action"));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handlePay(orderId: string) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      const paymentMethod = recallMallH5PaymentMethod() || "WECHAT";
      const { paymentId, paymentUrl } = await payMallH5Order({ orderId, paymentMethod });
      // Real channel cashier URL wins: the buyer completes payment on the
      // channel page, which then returns to the payment-result route.
      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }
      const query = new URLSearchParams({ orderId, status: paymentId ? "pending" : "pending" });
      if (paymentId) {
        query.set("paymentId", paymentId);
      }
      query.set("paymentMethod", paymentMethod);
      window.location.assign(`/payment/result?${query.toString()}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : t("orderDetail.errors.pay"));
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
            {t("orderDetail.actions.pay")}
          </button>
          <button
            className="sdk-h5-button sdk-h5-button-ghost"
            disabled={busy}
            onClick={() => void runOrderAction(order.id, (id) => cancelMallH5Order({ orderId: id }))}
            type="button"
          >
            {t("orderDetail.actions.cancel")}
          </button>
        </>
      );
    }
    if (order.status === "pending-receipt") {
      return (
        <>
          <Link className="sdk-h5-button sdk-h5-button-secondary" to={`/buyer/logistics?orderId=${encodeURIComponent(order.id)}`}>
            {t("orderDetail.actions.logistics")}
          </Link>
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={busy}
            onClick={() => void runOrderAction(order.id, (id) => confirmMallH5OrderReceipt({ orderId: id }))}
            type="button"
          >
            {t("orderDetail.actions.confirm")}
          </button>
        </>
      );
    }
    if (order.status === "pending-shipment") {
      return <span className="sdk-h5-muted">{t("orderList.merchantPreparing")}</span>;
    }
    if (order.status === "completed" || order.status === "refunding" || order.status === "refunded") {
      return (
        <Link className="sdk-h5-button sdk-h5-button-secondary" to={`/buyer/after-sales?orderId=${encodeURIComponent(order.id)}`}>
          {order.status === "completed" ? t("orderList.afterSalesApply") : t("orderList.afterSalesDetail")}
        </Link>
      );
    }
    return null;
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("orderList.loading")}</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("orderList.title")}</h1>
      <div className="sdk-h5-sort-row">
        {STATUS_FILTERS.map((filter) => (
          <button
            className={activeFilter === filter.code ? "sdk-h5-sort sdk-h5-sort-active" : "sdk-h5-sort"}
            key={filter.code}
            onClick={() => setSearchParams(filter.code === "all" ? {} : { status: filter.code })}
            type="button"
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      {error ? <SdkworkMallH5ErrorState message={error} /> : null}

      {orders.length === 0 ? (
        <div className="sdk-h5-empty">{t("orderList.empty")}</div>
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
                  {t("orderList.detail")}
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
              {loadingMore ? t("orderList.loadingMore") : t("orderList.loadMore")}
            </button>
          </div>
        ) : null}
        </>
      )}
    </div>
  );
}
