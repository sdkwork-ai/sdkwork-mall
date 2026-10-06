import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SdkworkMallH5Cell, SdkworkMallH5SelectCell } from "../components/ActionSheet";
import { consumePendingOrderPick, openOrderPick } from "../order-pick-channel";
import {
  getMallH5AfterSalesMediaRuntime,
  isMallH5AfterSalesMediaRuntimeConfigured,
} from "../after-sales-media-port";

import {
  cancelMallH5AfterSalesRequest,
  createMallH5AfterSalesRequest,
  listMallH5AfterSalesRequests,
  loadMallH5AfterSalesOrderContext,
  MALL_H5_AFTER_SALES_REASON_PRESETS,
  MALL_H5_AFTER_SALES_TYPES,
  type MallH5AfterSalesEvidenceItem,
  type MallH5AfterSalesOrderContext,
  type MallH5AfterSalesRequest,
} from "../aftersales-service";

const MAX_EVIDENCE_FILES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface EvidenceFile {
  id: string;
  name: string;
  previewUrl?: string;
  reference?: string;
  uploadState: "uploading" | "uploaded";
}

function formatCny(amount: number | null): string {
  return amount === null ? "-" : `¥${amount.toFixed(2)}`;
}

export function SdkworkMallH5AfterSalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const presetOrderId = searchParams.get("orderId") ?? "";
  const [requests, setRequests] = useState<MallH5AfterSalesRequest[]>([]);
  const [orderId, setOrderId] = useState(presetOrderId);
  const [orderContext, setOrderContext] = useState<MallH5AfterSalesOrderContext | null>(null);
  const [type, setType] = useState<string>(MALL_H5_AFTER_SALES_TYPES[0].value);
  const [reasonCode, setReasonCode] = useState<string>(MALL_H5_AFTER_SALES_REASON_PRESETS[0].code);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
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
    // navigate-to-select: the picker page completes the pick channel while
    // this form is unmounted, so consume the pending reference on remount.
    const picked = consumePendingOrderPick();
    if (picked) {
      setOrderId(picked);
      void loadOrder(picked);
      return;
    }
    if (presetOrderId) {
      void loadOrder(presetOrderId);
    }
  }, [presetOrderId, loadOrder]);

  function handleEvidenceUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    if (!isMallH5AfterSalesMediaRuntimeConfigured()) {
      // No host media runtime: there is deliberately no local blob:/data-URL
      // persistence — evidence references must be host-uploaded
      // (`DRIVE_SPEC.md` §18).
      setMessage("媒体上传不可用：需要宿主提供存储能力");
      event.target.value = "";
      return;
    }
    const mediaRuntime = getMallH5AfterSalesMediaRuntime();
    const newFiles: EvidenceFile[] = [];
    let skippedForError = false;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setMessage(`文件 ${file.name} 超过 5MB 限制`);
        continue;
      }
      const entry: EvidenceFile = {
        id: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        uploadState: "uploading",
      };
      newFiles.push(entry);
      void mediaRuntime
        .uploadImages([file])
        .then(([reference]) => {
          if (!reference) throw new Error("upload returned no reference");
          setEvidenceFiles((current) =>
            current.map((item) =>
              item.id === entry.id ? { ...item, reference, uploadState: "uploaded" as const } : item,
            ),
          );
        })
        .catch(() => {
          skippedForError = true;
          setEvidenceFiles((current) => current.filter((item) => item.id !== entry.id));
        });
    }
    setEvidenceFiles((current) => [...current, ...newFiles].slice(0, MAX_EVIDENCE_FILES));
    event.target.value = "";
    if (skippedForError) {
      setMessage("部分凭证上传失败，已移除；请重试");
    }
  }

  function removeEvidenceFile(fileId: string) {
    setEvidenceFiles((current) => current.filter((file) => file.id !== fileId));
  }

  async function handleSubmit() {
    if (!orderContext) {
      setMessage("请先选择订单");
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
      const uploadedEvidence: MallH5AfterSalesEvidenceItem[] = evidenceFiles
        .filter((file) => file.uploadState === "uploaded" && file.reference)
        .map((file) => ({
          fileName: file.name,
          reference: file.reference as string,
        }));
      await createMallH5AfterSalesRequest({
        description,
        evidenceSnapshot: uploadedEvidence,
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
      setEvidenceFiles([]);
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
        <SdkworkMallH5Cell
          label="订单号"
          onClick={() => {
            openOrderPick((pickedOrderId) => {
              setOrderId(pickedOrderId);
              void loadOrder(pickedOrderId);
            });
            navigate("/buyer/after-sales/select-order");
          }}
          value={orderContext ? orderContext.orderId || orderId : orderId || ""}
        />
        {orderContext ? (
          <div className="sdk-h5-muted">
            {orderContext.items.length} 项商品 · 实付 {formatCny(orderContext.paidAmountCny)}
            <button className="sdk-h5-link-button" onClick={clearPreset} type="button">
              更换订单
            </button>
          </div>
        ) : null}
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
        <div className="sdk-h5-field">
          凭证上传（可选，最多 {MAX_EVIDENCE_FILES} 张）
          <div className="sdk-h5-evidence-grid">
            {evidenceFiles.map((file) => (
              <div className="sdk-h5-evidence-item" key={file.id}>
                {file.previewUrl ? (
                  <img alt={file.name} src={file.previewUrl} />
                ) : (
                  <span className="sdk-h5-evidence-fallback">{file.name}</span>
                )}
                <button
                  aria-label={`移除 ${file.name}`}
                  className="sdk-h5-evidence-remove"
                  onClick={() => removeEvidenceFile(file.id)}
                  type="button"
                >
                  ×
                </button>
                <span className="sdk-h5-evidence-state">
                  {file.uploadState === "uploading" ? "上传中..." : "已上传"}
                </span>
              </div>
            ))}
            {evidenceFiles.length < MAX_EVIDENCE_FILES ? (
              <label className="sdk-h5-evidence-add">
                <input
                  accept="image/*"
                  multiple
                  onChange={handleEvidenceUpload}
                  style={{ display: "none" }}
                  type="file"
                />
                +
              </label>
            ) : null}
          </div>
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
