import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { SdkworkMallH5SelectCell } from "../components/ActionSheet";

import {
  cancelMallH5AfterSalesRequest,
  createMallH5AfterSalesRequest,
  listMallH5AfterSalesRequests,
  loadMallH5AfterSalesOrderContext,
  MALL_H5_AFTER_SALES_REASON_PRESETS,
  MALL_H5_AFTER_SALES_TYPES,
  type MallH5AfterSalesOrderContext,
  type MallH5AfterSalesRequest,
} from "../aftersales-service";

function formatCny(amount: number | null): string {
  return amount === null ? "-" : `¥${amount.toFixed(2)}`;
}

export function SdkworkMallH5AfterSalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const presetOrderId = searchParams.get("orderId") ?? "";
  const [requests, setRequests] = useState<MallH5AfterSalesRequest[]>([]);
  const [orderId, setOrderId] = useState(presetOrderId);
  const [orderContext, setOrderContext] = useState<MallH5AfterSalesOrderContext | null>(null);
  const [type, setType] = useState<string>(MALL_H5_AFTER_SALES_TYPES[0].value);
  const [reasonCode, setReasonCode] = useState<string>(MALL_H5_AFTER_SALES_REASON_PRESETS[0].code);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
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

  const applyOrderContext = useCallback((context: MallH5AfterSalesOrderContext) => {
    setOrderContext(context);
    const reference = context.paidAmountCny ?? context.totalAmountCny;
    setAmount(reference === null ? "" : reference.toFixed(2));
  }, []);

  const loadOrder = useCallback(
    async (targetOrderId: string) => {
      const trimmed = targetOrderId.trim();
      if (!trimmed) {
        setMessage("请填写订单号");
        return;
      }
      setLoadingOrder(true);
      setMessage(null);
      try {
        applyOrderContext(await loadMallH5AfterSalesOrderContext(trimmed));
      } catch (cause: unknown) {
        setOrderContext(null);
        setMessage(cause instanceof Error ? cause.message : "订单加载失败");
      } finally {
        setLoadingOrder(false);
      }
    },
    [applyOrderContext],
  );

  useEffect(() => {
    if (presetOrderId) {
      void loadOrder(presetOrderId);
    }
  }, [presetOrderId, loadOrder]);

  async function handleSubmit() {
    if (!orderContext) {
      setMessage("请先读取订单");
      return;
    }
    const amountNumber = Number(amount);
    if (!reasonCode) {
      setMessage("请选择售后原因");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage("请填写有效的售后金额");
      return;
    }
    if (type !== "exchange" && orderContext.paidAmountCny !== null && amountNumber > orderContext.paidAmountCny) {
      setMessage("售后金额不能超过订单实付金额");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await createMallH5AfterSalesRequest({
        description,
        items: orderContext.items.map((item) => ({
          orderItemId: item.orderItemId,
          refundAmountCny:
            type === "exchange" || item.priceCny === null
              ? undefined
              : Number((item.priceCny * item.quantity).toFixed(2)),
          requestedQuantity: item.quantity,
        })),
        orderId: orderContext.orderId,
        reasonCode,
        requestedAmountCny: Number(amountNumber.toFixed(2)),
        type: type as MallH5AfterSalesRequest["type"],
      });
      setDescription("");
      setMessage("售后申请已提交");
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "售后申请失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(requestId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await cancelMallH5AfterSalesRequest(requestId);
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "撤销失败");
    } finally {
      setBusy(false);
    }
  }

  function clearPreset() {
    setOrderContext(null);
    setAmount("");
    if (presetOrderId) {
      const next = new URLSearchParams(searchParams);
      next.delete("orderId");
      setSearchParams(next, { replace: true });
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
          <input
            disabled={Boolean(orderContext)}
            onChange={(event) => setOrderId(event.target.value)}
            value={orderId}
          />
        </label>
        {orderContext ? (
          <div className="sdk-h5-muted">
            {orderContext.items.length} 项商品 · 实付 {formatCny(orderContext.paidAmountCny)}
            <button className="sdk-h5-link-button" onClick={clearPreset} type="button">
              更换订单
            </button>
          </div>
        ) : (
          <button
            className="sdk-h5-button sdk-h5-button-secondary"
            disabled={loadingOrder}
            onClick={() => void loadOrder(orderId)}
            type="button"
          >
            {loadingOrder ? "读取中..." : "读取订单"}
          </button>
        )}
        <div className="sdk-h5-cell-group">
          <SdkworkMallH5SelectCell
            label="售后类型"
            onChange={setType}
            options={MALL_H5_AFTER_SALES_TYPES.map((option) => ({ label: option.label, value: option.value }))}
            value={type}
          />
          <SdkworkMallH5SelectCell
            label="售后原因"
            onChange={setReasonCode}
            options={MALL_H5_AFTER_SALES_REASON_PRESETS.map((option) => ({ label: option.label, value: option.code }))}
            value={reasonCode}
          />
        </div>
        <div className="sdk-h5-cell-group">
        <div className="sdk-h5-field">
          问题描述（选填）
          <textarea
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="补充描述有助于加快审核"
            rows={3}
            value={description}
          />
        </div>
        <div className="sdk-h5-field">
          售后金额（元）
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            value={amount}
          />
        </div>
        </div>
        <button
          className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block"
          disabled={busy || loadingOrder}
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
                <strong>{request.typeLabel}</strong>
                {request.afterSalesNo ? <span className="sdk-h5-muted"> {request.afterSalesNo}</span> : null}
                <div className="sdk-h5-muted">订单 {request.orderId}</div>
                <div className="sdk-h5-muted">
                  {formatCny(request.requestedAmountCny)}
                  {request.reason
                    ? ` · ${MALL_H5_AFTER_SALES_REASON_PRESETS.find((preset) => preset.code === request.reason)?.label ?? request.reason}`
                    : ""}
                </div>
              </div>
              <div>
                <span className="sdk-h5-muted">{request.statusLabel}</span>
                {request.status === "pending" || request.status === "reviewing" ? (
                  <button
                    className="sdk-h5-link-button"
                    disabled={busy}
                    onClick={() => void handleCancel(request.id)}
                    type="button"
                  >
                    撤销
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
