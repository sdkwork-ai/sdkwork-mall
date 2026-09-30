import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createMallH5AfterSalesRequest,
  listMallH5AfterSalesRequests,
  MALL_H5_AFTER_SALES_TYPES,
  type MallH5AfterSalesRequest,
} from "../aftersales-service";

export function SdkworkMallH5AfterSalesPage() {
  const [searchParams] = useSearchParams();
  const presetOrderId = searchParams.get("orderId") ?? "";
  const [requests, setRequests] = useState<MallH5AfterSalesRequest[]>([]);
  const [orderId, setOrderId] = useState(presetOrderId);
  const [type, setType] = useState<string>(MALL_H5_AFTER_SALES_TYPES[0].value);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRequests(await listMallH5AfterSalesRequests());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "售后列表加载失败");
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

  async function handleSubmit() {
    if (!orderId.trim()) {
      setMessage("请填写订单号");
      return;
    }
    if (!reason.trim()) {
      setMessage("请填写售后原因");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await createMallH5AfterSalesRequest({
        orderId: orderId.trim(),
        reason: reason.trim(),
        type,
      });
      setReason("");
      setMessage("售后申请已提交");
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "售后申请失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载售后...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">售后</h1>

      {message ? <div className="sdk-h5-notice sdk-h5-notice-warning">{message}</div> : null}

      <section className="sdk-h5-section">
        <h2>申请售后</h2>
        <label className="sdk-h5-field">
          订单号
          <input onChange={(event) => setOrderId(event.target.value)} value={orderId} />
        </label>
        <label className="sdk-h5-field">
          售后类型
          <select onChange={(event) => setType(event.target.value)} value={type}>
            {MALL_H5_AFTER_SALES_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="sdk-h5-field">
          售后原因
          <textarea
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="请描述问题（必填）"
            rows={3}
            value={reason}
          />
        </label>
        <button
          className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block"
          disabled={busy}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {busy ? "提交中..." : "提交申请"}
        </button>
      </section>

      <section className="sdk-h5-section">
        <h2>售后记录</h2>
        {requests.length === 0 ? (
          <div className="sdk-h5-empty">暂无售后记录</div>
        ) : (
          requests.map((request) => (
            <div className="sdk-h5-coupon-row" key={request.id}>
              <div>
                <strong>{request.type}</strong>
                <div className="sdk-h5-muted">订单 {request.orderId}</div>
                {request.reason ? <div className="sdk-h5-muted">{request.reason}</div> : null}
              </div>
              <span className="sdk-h5-muted">{request.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
