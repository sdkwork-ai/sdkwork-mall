import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
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
  createMallH5AfterSalesReturnShipment,
  listMallH5AfterSalesRequests,
  loadMallH5AfterSalesEvents,
  loadMallH5AfterSalesOrderContext,
  MALL_H5_AFTER_SALES_REASON_PRESETS,
  MALL_H5_AFTER_SALES_TYPES,
  MALL_H5_RETURN_CARRIERS,
  type MallH5AfterSalesEvent,
  type MallH5AfterSalesEvidenceItem,
  type MallH5AfterSalesOrderContext,
  type MallH5AfterSalesRequest,
} from "../aftersales-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

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
  const { t } = useTranslation();
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [returnFormRequestId, setReturnFormRequestId] = useState("");
  const [returnCarrierCode, setReturnCarrierCode] = useState<string>(MALL_H5_RETURN_CARRIERS[0].code);
  const [returnTrackingNo, setReturnTrackingNo] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const [progressRequestId, setProgressRequestId] = useState("");
  const [progressEvents, setProgressEvents] = useState<MallH5AfterSalesEvent[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRequests(await listMallH5AfterSalesRequests());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setLoadError(cause instanceof Error ? cause.message : t("afterSales.errors.listLoad"));
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
  }, [reload, t]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    reload()
      .catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : t("afterSales.errors.listLoad"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reload, t]);

  const applyOrderContext = useCallback((context: MallH5AfterSalesOrderContext) => {
    setOrderContext(context);
    const reference = context.paidAmountCny ?? context.totalAmountCny;
    setAmount(reference === null ? "" : reference.toFixed(2));
  }, []);

  const loadOrder = useCallback(
    async (targetOrderId: string) => {
      const trimmed = targetOrderId.trim();
      if (!trimmed) {
        setMessage(t("afterSales.errors.orderRequired"));
        return;
      }
      setLoadingOrder(true);
      setMessage(null);
      try {
        applyOrderContext(await loadMallH5AfterSalesOrderContext(trimmed));
      } catch (cause: unknown) {
        setOrderContext(null);
        setMessage(cause instanceof Error ? cause.message : t("afterSales.errors.orderLoad"));
      } finally {
        setLoadingOrder(false);
      }
    },
    [applyOrderContext, t],
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
      setMessage(t("afterSales.apply.mediaUnavailable"));
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
      setMessage(t("afterSales.apply.evidenceFailed"));
    }
  }

  function removeEvidenceFile(fileId: string) {
    setEvidenceFiles((current) => current.filter((file) => file.id !== fileId));
  }

  async function handleSubmit() {
    if (!orderContext) {
      setMessage(t("afterSales.errors.selectOrder"));
      return;
    }
    const amountNumber = Number(amount);
    if (!reasonCode) {
      setMessage(t("afterSales.errors.reasonRequired"));
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage(t("afterSales.errors.amountInvalid"));
      return;
    }
    if (type !== "exchange" && orderContext.paidAmountCny !== null && amountNumber > orderContext.paidAmountCny) {
      setMessage(t("afterSales.errors.amountExceedsPaid"));
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
      setMessage(t("afterSales.apply.submitted"));
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("afterSales.errors.submitFailed"));
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
      setMessage(cause instanceof Error ? cause.message : t("afterSales.errors.cancelFailed"));
    } finally {
      setBusy(false);
    }
  }

  /** 展开/收起某个售后单的处理进度（按需拉取事件）。 */
  async function toggleProgress(requestId: string) {
    if (progressRequestId === requestId) {
      setProgressRequestId("");
      return;
    }
    setProgressRequestId(requestId);
    setProgressEvents([]);
    setProgressError(null);
    setProgressLoading(true);
    try {
      setProgressEvents(await loadMallH5AfterSalesEvents(requestId));
    } catch (cause: unknown) {
      setProgressError(cause instanceof Error ? cause.message : t("afterSales.progress.failed"));
    } finally {
      setProgressLoading(false);
    }
  }

  /** 退货/换货审核通过后，买家需要回填寄回物流。 */
  function canSubmitReturnShipment(request: MallH5AfterSalesRequest): boolean {
    return request.status === "approved" && (request.type === "return" || request.type === "exchange");
  }

  /** Reason codes are catalogue keys on the page side; unknown codes fall back. */
  function reasonLabel(reason: string): string {
    const preset = MALL_H5_AFTER_SALES_REASON_PRESETS.find((entry) => entry.code === reason);
    return preset ? t(preset.labelKey) : reason;
  }

  async function handleReturnShipment() {
    if (!returnFormRequestId) {
      return;
    }
    const trackingNo = returnTrackingNo.trim();
    if (!trackingNo) {
      setMessage(t("afterSales.errors.trackingRequired"));
      return;
    }
    setReturnBusy(true);
    setMessage(null);
    try {
      const carrier = MALL_H5_RETURN_CARRIERS.find((entry) => entry.code === returnCarrierCode);
      await createMallH5AfterSalesReturnShipment({
        carrierCode: returnCarrierCode,
        carrierName: carrier ? t(carrier.nameKey) : undefined,
        requestId: returnFormRequestId,
        trackingNo,
      });
      setMessage(t("afterSales.return.submitted"));
      setReturnFormRequestId("");
      setReturnTrackingNo("");
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("afterSales.errors.returnSubmitFailed"));
    } finally {
      setReturnBusy(false);
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
    return <div className="sdk-h5-page sdk-h5-loading">{t("afterSales.page.loading")}</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("afterSales.page.title")}</h1>

      {loadError ? <SdkworkMallH5ErrorState message={loadError} onRetry={retryLoad} /> : null}

      {message ? <div className="sdk-h5-notice sdk-h5-notice-warning">{message}</div> : null}

      <section className="sdk-h5-section">
        <h2>{t("afterSales.apply.title")}</h2>
        <SdkworkMallH5Cell
          label={t("afterSales.apply.orderLabel")}
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
            {t("afterSales.apply.orderSummary", {
              amount: formatCny(orderContext.paidAmountCny),
              count: orderContext.items.length,
            })}
            <button className="sdk-h5-link-button" onClick={clearPreset} type="button">
              {t("afterSales.apply.changeOrder")}
            </button>
          </div>
        ) : null}
        <div className="sdk-h5-cell-group">
          <SdkworkMallH5SelectCell
            label={t("afterSales.apply.typeLabel")}
            onChange={setType}
            options={MALL_H5_AFTER_SALES_TYPES.map((option) => ({
              label: t(option.labelKey),
              value: option.value,
            }))}
            value={type}
          />
          <SdkworkMallH5SelectCell
            label={t("afterSales.apply.reasonLabel")}
            onChange={setReasonCode}
            options={MALL_H5_AFTER_SALES_REASON_PRESETS.map((option) => ({
              label: t(option.labelKey),
              value: option.code,
            }))}
            value={reasonCode}
          />
        </div>
        <div className="sdk-h5-cell-group">
        <div className="sdk-h5-field">
          {t("afterSales.apply.descriptionLabel")}
          <textarea
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("afterSales.apply.descriptionPlaceholder")}
            rows={3}
            value={description}
          />
        </div>
        <div className="sdk-h5-field">
          {t("afterSales.apply.amountLabel")}
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            value={amount}
          />
        </div>
        <div className="sdk-h5-field">
          {t("afterSales.apply.evidenceLabel", { count: MAX_EVIDENCE_FILES })}
          <div className="sdk-h5-evidence-grid">
            {evidenceFiles.map((file) => (
              <div className="sdk-h5-evidence-item" key={file.id}>
                {file.previewUrl ? (
                  <img alt={file.name} src={file.previewUrl} />
                ) : (
                  <span className="sdk-h5-evidence-fallback">{file.name}</span>
                )}
                <button
                  aria-label={t("afterSales.apply.evidenceRemove", { name: file.name })}
                  className="sdk-h5-evidence-remove"
                  onClick={() => removeEvidenceFile(file.id)}
                  type="button"
                >
                  ×
                </button>
                <span className="sdk-h5-evidence-state">
                  {file.uploadState === "uploading"
                    ? t("afterSales.apply.evidenceUploading")
                    : t("afterSales.apply.evidenceUploaded")}
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
          {busy ? t("afterSales.apply.submitting") : t("afterSales.apply.submit")}
        </button>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("afterSales.list.title")}</h2>
        {requests.length === 0 ? (
          <div className="sdk-h5-empty">{t("afterSales.list.empty")}</div>
        ) : (
          requests.map((request) => (
            <div className="sdk-h5-coupon-row" key={request.id}>
              <div>
                <strong>{t(request.typeLabelKey)}</strong>
                {request.afterSalesNo ? <span className="sdk-h5-muted"> {request.afterSalesNo}</span> : null}
                <div className="sdk-h5-muted">{t("afterSales.list.orderNo", { id: request.orderId })}</div>
                <div className="sdk-h5-muted">
                  {formatCny(request.requestedAmountCny)}
                  {request.reason ? ` · ${reasonLabel(request.reason)}` : ""}
                </div>
                {canSubmitReturnShipment(request) ? (
                  returnFormRequestId === request.id ? (
                    <div className="sdk-h5-return-shipment-form">
                      <label className="sdk-h5-field">
                        {t("afterSales.return.carrierLabel")}
                        <select
                          aria-label={t("afterSales.return.carrierLabel")}
                          onChange={(event) => setReturnCarrierCode(event.target.value)}
                          value={returnCarrierCode}
                        >
                          {MALL_H5_RETURN_CARRIERS.map((carrier) => (
                            <option key={carrier.code} value={carrier.code}>
                              {t(carrier.nameKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="sdk-h5-field">
                        {t("afterSales.return.trackingLabel")}
                        <input
                          aria-label={t("afterSales.return.trackingLabel")}
                          onChange={(event) => setReturnTrackingNo(event.target.value)}
                          placeholder={t("afterSales.return.trackingPlaceholder")}
                          value={returnTrackingNo}
                        />
                      </label>
                      <div className="sdk-h5-action-row">
                        <button
                          className="sdk-h5-button sdk-h5-button-primary"
                          disabled={returnBusy}
                          onClick={() => void handleReturnShipment()}
                          type="button"
                        >
                          {returnBusy ? t("afterSales.return.submitting") : t("afterSales.return.submit")}
                        </button>
                        <button
                          className="sdk-h5-button sdk-h5-button-ghost"
                          disabled={returnBusy}
                          onClick={() => {
                            setReturnFormRequestId("");
                            setReturnTrackingNo("");
                          }}
                          type="button"
                        >
                          {t("afterSales.return.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="sdk-h5-link-button"
                      onClick={() => {
                        setReturnFormRequestId(request.id);
                        setReturnTrackingNo("");
                      }}
                      type="button"
                    >
                      {t("afterSales.list.returnEntry")}
                    </button>
                  )
                ) : null}
                <button
                  className="sdk-h5-link-button"
                  onClick={() => void toggleProgress(request.id)}
                  type="button"
                >
                  {t("afterSales.progress.toggle")}
                </button>
                {progressRequestId === request.id ? (
                  <div>
                    {progressLoading ? (
                      <p className="sdk-h5-muted">{t("afterSales.progress.loading")}</p>
                    ) : null}
                    {progressError ? (
                      <p className="sdk-h5-notice sdk-h5-notice-danger" role="alert">
                        {progressError}
                      </p>
                    ) : null}
                    {!progressLoading && !progressError && progressEvents.length === 0 ? (
                      <p className="sdk-h5-muted">{t("afterSales.progress.empty")}</p>
                    ) : null}
                    {progressEvents.length > 0 ? (
                      <ol className="sdk-h5-tracking">
                        {progressEvents.map((event, index) => (
                          <li key={`${event.action}-${event.at ?? index}`}>
                            <div className="sdk-h5-tracking-text">{event.action}</div>
                            {event.at ? (
                              <div className="sdk-h5-tracking-meta">
                                {new Date(event.at).toLocaleString("zh-CN")}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div>
                <span className="sdk-h5-muted">{request.statusLabel ?? t(request.statusLabelKey)}</span>
                {request.status === "pending" || request.status === "reviewing" ? (
                  <button
                    className="sdk-h5-link-button"
                    disabled={busy}
                    onClick={() => void handleCancel(request.id)}
                    type="button"
                  >
                    {t("afterSales.list.cancel")}
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
