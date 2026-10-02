import { useCallback, useEffect, useState } from "react";
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

const STATUS_LABELS: Record<MallH5OrderStatus, string> = {
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

export function SdkworkMallH5OrderDetailPage() {
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
  }, [orderId, reload]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "操作失败");
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
      setError(cause instanceof Error ? cause.message : "发起支付失败");
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载订单详情...</div>;
  }

  if (!detail) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">{error ?? "订单不存在"}</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button" to="/buyer/orders">返回订单列表</Link>
        </div>
      </div>
    );
  }

  const payableNow = detail.status === "pending-payment";

  return (
    <div className="sdk-h5-page">
      <section className="sdk-h5-order-status-hero">
        <h1>{STATUS_LABELS[detail.status]}</h1>
        <p>订单号：{detail.id}</p>
      </section>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-section">
        <h2>商品清单</h2>
        {detail.items.length === 0 ? (
          <p className="sdk-h5-muted">暂无商品明细</p>
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
                    <strong>{item.priceCny != null ? `¥${item.priceCny.toFixed(2)}` : "询价"}</strong>
                    <span>x{item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sdk-h5-section">
        <h2>订单信息</h2>
        <dl className="sdk-h5-spec-list">
          <div>
            <dt>下单时间</dt>
            <dd>{new Date(detail.createdAt).toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt>订单总额</dt>
            <dd>{detail.totalAmountCny != null ? `¥${detail.totalAmountCny.toFixed(2)}` : "--"}</dd>
          </div>
          <div>
            <dt>实付金额</dt>
            <dd>{detail.paidAmountCny != null ? `¥${detail.paidAmountCny.toFixed(2)}` : "未支付"}</dd>
          </div>
          {detail.paymentMethod ? (
            <div>
              <dt>支付方式</dt>
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
            去支付
          </button>
        ) : null}
        {payableNow ? (
          <button
            className="sdk-h5-button sdk-h5-button-ghost"
            disabled={busy}
            onClick={() => void runAction(() => cancelMallH5Order({ orderId: detail.id }))}
            type="button"
          >
            取消订单
          </button>
        ) : null}
        {detail.status === "pending-receipt" ? (
          <>
            <Link
              className="sdk-h5-button sdk-h5-button-secondary"
              to={`/buyer/logistics?orderId=${encodeURIComponent(detail.id)}`}
            >
              查看物流
            </Link>
            <button
              className="sdk-h5-button sdk-h5-button-primary"
              disabled={busy}
              onClick={() => void runAction(() => confirmMallH5OrderReceipt({ orderId: detail.id }))}
              type="button"
            >
              确认收货
            </button>
          </>
        ) : null}
        {detail.status === "completed" ? (
          <Link
            className="sdk-h5-button sdk-h5-button-secondary"
            to={`/buyer/after-sales?orderId=${encodeURIComponent(detail.id)}`}
          >
            申请售后
          </Link>
        ) : null}
        <button className="sdk-h5-button sdk-h5-button-ghost" onClick={() => navigate("/buyer/orders")} type="button">
          返回列表
        </button>
      </div>
    </div>
  );
}
