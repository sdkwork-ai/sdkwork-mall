import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  listMallH5PaymentMethods,
  MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY,
  retrieveMallH5OrderPaymentSuccess,
  retryMallH5OrderPayment,
} from "../cart-service";

export function SdkworkMallH5PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "unknown";
  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");
  const [paymentInfo, setPaymentInfo] = useState<Record<string, unknown> | null>(null);
  const [checkoutWarnings, setCheckoutWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY);
      if (raw) {
        window.sessionStorage.removeItem(MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY);
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCheckoutWarnings(parsed.filter((entry): entry is string => typeof entry === "string"));
          }
        } catch {
          // 忽略无法解析的警告数据。
        }
      }
    }

    if (!orderId) {
      setLoading(false);
      return;
    }
    let active = true;
    retrieveMallH5OrderPaymentSuccess(orderId)
      .then((info) => {
        if (active) {
          setPaymentInfo(info);
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
  }, [orderId]);

  const paid = status === "success" || paymentInfo?.paid === true || paymentInfo?.status === "paid";
  const failed = status === "failed" || status === "cancelled" || status === "closed";
  const pending = status === "pending";

  async function handleRetry() {
    if (!orderId) {
      return;
    }
    setRetrying(true);
    setMessage(null);
    try {
      const knownMethod =
        searchParams.get("paymentMethod")
        || (typeof paymentInfo?.paymentMethod === "string" ? paymentInfo.paymentMethod : "");
      const paymentMethod = knownMethod || (await listMallH5PaymentMethods())[0]?.code;
      if (!paymentMethod) {
        setMessage("暂无可用支付方式，请稍后再试。");
        return;
      }
      const nextPaymentId = await retryMallH5OrderPayment(orderId, paymentMethod);
      if (nextPaymentId) {
        window.location.assign(
          `/payment/result?status=pending&orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(nextPaymentId)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
        );
        return;
      }
      setMessage("支付重试已发起，请稍后查看订单状态。");
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "支付重试失败，请稍后再试。");
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">查询支付结果...</div>;
  }

  return (
    <div className="sdk-h5-page sdk-h5-payment-result">
      <section className="sdk-h5-payment-hero">
        <h1>{paid ? "支付成功" : pending ? "支付处理中" : failed ? "支付失败" : "支付结果"}</h1>
        {orderId ? <p>订单号：{orderId}</p> : null}
        {paymentId ? <p>支付单号：{paymentId}</p> : null}
      </section>

      {paid ? <div className="sdk-h5-notice sdk-h5-notice-success">支付成功，商家将尽快为您发货。</div> : null}
      {pending ? <div className="sdk-h5-notice sdk-h5-notice-warning">支付处理中，请稍后在订单列表查看最新状态。</div> : null}
      {failed ? <div className="sdk-h5-notice sdk-h5-notice-danger">支付未成功，可重新支付或联系客服。</div> : null}

      {checkoutWarnings.map((warning) => (
        <div className="sdk-h5-notice sdk-h5-notice-warning" key={warning}>
          {warning}
        </div>
      ))}

      {message ? <div className="sdk-h5-error" role="alert">{message}</div> : null}

      <div className="sdk-h5-action-row">
        {orderId ? <Link className="sdk-h5-button sdk-h5-button-secondary" to="/buyer/orders">查看订单</Link> : null}
        {orderId && failed ? (
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={retrying}
            onClick={() => void handleRetry()}
            type="button"
          >
            {retrying ? "重试中..." : "重新支付"}
          </button>
        ) : null}
        <Link className="sdk-h5-button sdk-h5-button-ghost" to="/">继续购物</Link>
      </div>
    </div>
  );
}
