import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import {
  listMallH5PaymentMethods,
  MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY,
  retrieveMallH5OrderPaymentSuccess,
  retryMallH5OrderPayment,
} from "../cart-service";

/** Payment providers settle asynchronously; poll, but never forever. */
const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_MAX_ATTEMPTS = 20;

function isPaidPayment(info: Record<string, unknown> | null): boolean {
  if (!info) {
    return false;
  }
  const status = String(info.status ?? "").toUpperCase();
  return info.paid === true || status === "PAID" || status === "COMPLETED";
}

export function SdkworkMallH5PaymentResultPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "unknown";
  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");
  const [paymentInfo, setPaymentInfo] = useState<Record<string, unknown> | null>(null);
  const [checkoutWarnings, setCheckoutWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const pollAttemptsRef = useRef(0);

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
    let timer: number | undefined;
    pollAttemptsRef.current = 0;
    setPollExhausted(false);
    const tick = async () => {
      const info = await retrieveMallH5OrderPaymentSuccess(orderId);
      if (!active) {
        return;
      }
      setPaymentInfo(info);
      setLoading(false);
      if (isPaidPayment(info)) {
        return;
      }
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current >= PAYMENT_POLL_MAX_ATTEMPTS) {
        setPollExhausted(true);
        return;
      }
      timer = window.setTimeout(() => void tick(), PAYMENT_POLL_INTERVAL_MS);
    };
    void tick();
    return () => {
      active = false;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [orderId, refreshToken]);

  const refreshPaymentStatus = useCallback(() => {
    setPollExhausted(false);
    pollAttemptsRef.current = 0;
    setLoading(true);
    setRefreshToken((token) => token + 1);
  }, []);

  const paid = status === "success" || isPaidPayment(paymentInfo);
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
        setMessage(t("paymentResult.noPaymentMethod"));
        return;
      }
      const { paymentId: nextPaymentId, paymentUrl } = await retryMallH5OrderPayment(orderId, paymentMethod);
      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }
      if (nextPaymentId) {
        window.location.assign(
          `/payment/result?status=pending&orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(nextPaymentId)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
        );
        return;
      }
      setMessage(t("paymentResult.retryPending"));
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("paymentResult.retryFailed"));
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("paymentResult.loading")}</div>;
  }

  const titleKey = paid
    ? "paymentResult.title.success"
    : pending
      ? "paymentResult.title.processing"
      : failed
        ? "paymentResult.title.failed"
        : "paymentResult.title.default";

  return (
    <div className="sdk-h5-page sdk-h5-payment-result">
      <section className="sdk-h5-payment-hero">
        <h1>{t(titleKey)}</h1>
        {orderId ? <p>{t("paymentResult.orderNo", { orderId })}</p> : null}
        {paymentId ? <p>{t("paymentResult.paymentNo", { paymentId })}</p> : null}
      </section>

      {paid ? <div className="sdk-h5-notice sdk-h5-notice-success">{t("paymentResult.notice.success")}</div> : null}
      {pending ? <div className="sdk-h5-notice sdk-h5-notice-warning">{t("paymentResult.notice.processing")}</div> : null}
      {failed ? <div className="sdk-h5-notice sdk-h5-notice-danger">{t("paymentResult.notice.failed")}</div> : null}
      {!paid && !failed && pollExhausted ? (
        <div className="sdk-h5-notice sdk-h5-notice-warning">
          {t("paymentResult.notice.timeout")}
          <button className="sdk-h5-link-button" onClick={refreshPaymentStatus} type="button">
            {t("paymentResult.refresh")}
          </button>
        </div>
      ) : null}

      {checkoutWarnings.map((warning) => (
        <div className="sdk-h5-notice sdk-h5-notice-warning" key={warning}>
          {warning}
        </div>
      ))}

      {message ? <div className="sdk-h5-notice sdk-h5-notice-danger" role="alert">{message}</div> : null}

      <div className="sdk-h5-action-row">
        {orderId ? (
          <Link className="sdk-h5-button sdk-h5-button-secondary" to="/buyer/orders">
            {t("paymentResult.viewOrders")}
          </Link>
        ) : null}
        {orderId && failed ? (
          <button
            className="sdk-h5-button sdk-h5-button-primary"
            disabled={retrying}
            onClick={() => void handleRetry()}
            type="button"
          >
            {retrying ? t("paymentResult.retrying") : t("paymentResult.retryPay")}
          </button>
        ) : null}
        <Link className="sdk-h5-button sdk-h5-button-ghost" to="/">
          {t("paymentResult.continueShopping")}
        </Link>
      </div>
    </div>
  );
}
