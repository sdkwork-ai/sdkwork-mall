import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  cancelMallH5Order,
  confirmMallH5OrderReceipt,
  loadMallH5OrderDetail,
  payMallH5Order,
  type MallH5OrderDetail,
  type MallH5OrderStatus,
} from "../order-service";
import { recallMallH5PaymentMethod } from "@sdkwork/mall-h5-cart/cart-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

const STATUS_KEYS: Record<MallH5OrderStatus, string> = {
  cancelled: "orderDetail.status.cancelled",
  completed: "orderDetail.status.completed",
  expired: "orderDetail.status.expired",
  paid: "orderDetail.status.paid",
  "pending-payment": "orderDetail.status.pendingPayment",
  "pending-receipt": "orderDetail.status.pendingReceipt",
  "pending-shipment": "orderDetail.status.pendingShipment",
  refunded: "orderDetail.status.refunded",
  refunding: "orderDetail.status.refunding",
  unknown: "orderDetail.status.unknown",
};

export function SdkworkMallH5OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId = "" } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MallH5OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await loadMallH5OrderDetail(orderId);
    setDetail(data);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    reload()
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
  }, [orderId, reload, t]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : t("orderDetail.errors.action"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (!detail) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const paymentMethod = detail.paymentMethod || recallMallH5PaymentMethod() || "WECHAT";
      const { paymentId } = await payMallH5Order({ orderId: detail.id, paymentMethod });
      const query = new URLSearchParams({ orderId: detail.id, status: "pending" });
      if (paymentId) {
        query.set("paymentId", paymentId);
      }
      query.set("paymentMethod", paymentMethod);
      window.location.assign(`/payment/result?${query.toString()}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : t("orderDetail.errors.pay"));
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("orderDetail.loading")}</div>;
  }

  if (!detail) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">{error ?? t("orderDetail.notFound")}</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button" to="/buyer/orders">{t("orderDetail.actions.back")}</Link>
        </div>
      </div>
    );
  }

  const payableNow = detail.status === "pending-payment";

  return (
    <div className="sdk-h5-page">
      <section className="sdk-h5-order-status-hero">
        <h1>{t(STATUS_KEYS[detail.status])}</h1>
        <p>{t("orderDetail.orderNo", { id: detail.id })}</p>
      </section>

      {error ? <SdkworkMallH5ErrorState message={error} /> : null}

      <section className="sdk-h5-section">
        <h2>{t("orderDetail.sections.items")}</h2>
        {detail.items.length === 0 ? (
          <p className="sdk-h5-muted">{t("orderDetail.itemsEmpty")}</p>
        ) : (
          <div className="sdk-h5-cart-list">
            {detail.items.map((item) => (
              <div className="sdk-h5-cart-row" key={item.id}>
                <div className="sdk-h5-product-image">
                  {item.imageUrl ? (
                    <img alt={item.title} loading="lazy" src={item.imageUrl} />
                  ) : null}
                </div>
                <div className="sdk-h5-cart-row-body">
                  {item.spuId ? (
                    <Link className="sdk-h5-product-title" to={`/product/${encodeURIComponent(item.spuId)}`}>
                      {item.title}
                    </Link>
                  ) : (
                    <span className="sdk-h5-product-title">{item.title}</span>
                  )}
                  {item.skuName ? <div className="sdk-h5-cart-sku">{item.skuName}</div> : null}
                  <div className="sdk-h5-product-meta">
                    <strong>
                      {item.priceCny != null
                        ? `¥${item.priceCny.toFixed(2)}`
                        : t("orderDetail.priceInquiry")}
                    </strong>
                    <span>x{item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sdk-h5-section">
        <h2>{t("orderDetail.sections.info")}</h2>
        <dl className="sdk-h5-spec-list">
          <div>
            <dt>{t("orderDetail.fields.createdAt")}</dt>
            <dd>{new Date(detail.createdAt).toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt>{t("orderDetail.fields.total")}</dt>
            <dd>{detail.totalAmountCny != null ? `¥${detail.totalAmountCny.toFixed(2)}` : "--"}</dd>
          </div>
          <div>
            <dt>{t("orderDetail.fields.paid")}</dt>
            <dd>
              {detail.paidAmountCny != null
                ? `¥${detail.paidAmountCny.toFixed(2)}`
                : t("orderDetail.unpaid")}
            </dd>
          </div>
          {detail.paymentMethod ? (
            <div>
              <dt>{t("orderDetail.fields.paymentMethod")}</dt>
              <dd>{detail.paymentMethod}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="sdk-h5-action-row">
        {payableNow ? (
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={busy}
            onClick={() => void handlePay()}
            type="button"
          >
            {t("orderDetail.actions.pay")}
          </button>
        ) : null}
        {payableNow ? (
          <button
            className="sdk-h5-button sdk-h5-button-ghost"
            disabled={busy}
            onClick={() => void runAction(() => cancelMallH5Order({ orderId: detail.id }))}
            type="button"
          >
            {t("orderDetail.actions.cancel")}
          </button>
        ) : null}
        {detail.status === "pending-receipt" ? (
          <>
            <Link
              className="sdk-h5-button sdk-h5-button-secondary"
              to={`/buyer/logistics?orderId=${encodeURIComponent(detail.id)}`}
            >
              {t("orderDetail.actions.logistics")}
            </Link>
            <button
              className="sdk-h5-button sdk-h5-button-primary"
              disabled={busy}
              onClick={() => void runAction(() => confirmMallH5OrderReceipt({ orderId: detail.id }))}
              type="button"
            >
              {t("orderDetail.actions.confirm")}
            </button>
          </>
        ) : null}
        {detail.status === "paid" || detail.status === "pending-receipt" || detail.status === "completed" ? (
          <Link
            className="sdk-h5-button sdk-h5-button-secondary"
            to={`/buyer/after-sales?orderId=${encodeURIComponent(detail.id)}`}
          >
            {t("orderDetail.actions.afterSales")}
          </Link>
        ) : null}
        <button className="sdk-h5-button sdk-h5-button-ghost" onClick={() => navigate("/buyer/orders")} type="button">
          {t("orderDetail.actions.back")}
        </button>
      </div>
    </div>
  );
}
