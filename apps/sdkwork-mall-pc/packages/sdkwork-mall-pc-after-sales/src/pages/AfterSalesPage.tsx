import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";

import {
  AFTER_SALES_TYPES,
  createEmptyAfterSalesForm,
  createMallAfterSalesRequest,
  formatAfterSalesCurrencyCny,
  listMallAfterSalesRows,
  loadMallAfterSalesDetail,
  loadMallAfterSalesOrderContext,
  revokeMallAfterSalesRequest,
  STATUS_LABELS,
  validateAfterSalesForm,
  type AfterSalesFormErrors,
  type AfterSalesFormState,
  type AfterSalesOrderContext,
  type AfterSalesRow,
  type AfterSalesStatus,
} from "../after-sales-service";
import {
  getMallAfterSalesMediaRuntime,
  isMallAfterSalesMediaRuntimeConfigured,
} from "../after-sales-media-port";

interface EvidenceFile {
  id: string;
  name: string;
  previewUrl?: string;
  size: number;
  /** Backend-addressable reference (drive://) once the host upload settles. */
  reference?: string;
  uploadState?: "uploading" | "uploaded";
}

const STATUS_TONES: Record<AfterSalesStatus, string> = {
  approved: "text-[var(--sdk-color-state-success)] bg-[var(--sdk-color-state-success)]/10 border-[var(--sdk-color-state-success)]/30",
  cancelled: "text-[var(--sdk-color-text-muted)] bg-[var(--sdk-color-surface-subtle)] border-[var(--sdk-color-border-default)]",
  completed: "text-[var(--sdk-color-state-success)] bg-[var(--sdk-color-state-success)]/10 border-[var(--sdk-color-state-success)]/30",
  pending: "text-[var(--sdk-color-state-warning)] bg-[var(--sdk-color-state-warning)]/10 border-[var(--sdk-color-state-warning)]/30",
  rejected: "text-[var(--sdk-color-state-danger)] bg-[var(--sdk-color-state-danger)]/10 border-[var(--sdk-color-state-danger)]/30",
  reviewing: "text-[var(--sdk-color-brand-primary)] bg-[var(--sdk-color-brand-primary)]/10 border-[var(--sdk-color-brand-primary)]/30",
};

const MAX_EVIDENCE_FILES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function readDetailAmountCny(detail: Record<string, unknown> | null, fallback: number | null): number | null {
  const amount = Number(detail?.requestedAmount ?? detail?.requested_amount ?? fallback ?? Number.NaN);
  return Number.isFinite(amount) ? amount : null;
}

export function SdkworkMallAfterSalesPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<AfterSalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AfterSalesFormState>(createEmptyAfterSalesForm());
  const [errors, setErrors] = useState<AfterSalesFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AfterSalesRow | null>(null);
  const [orderContext, setOrderContext] = useState<AfterSalesOrderContext | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<{ action: string; at?: string }>>([]);
  const [returnShipments, setReturnShipments] = useState<Array<{ id: string; status: string; tracking?: string }>>([]);

  const reload = useCallback(async () => {
    setRows(await listMallAfterSalesRows());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    const orderIdFromUrl = searchParams.get("orderId");
    if (orderIdFromUrl) {
      setForm((current) => ({ ...current, orderId: orderIdFromUrl }));
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvents([]);
      setReturnShipments([]);
      setSelectedRow(null);
      return;
    }
    const detailId = selectedId;
    let active = true;
    async function loadDetail() {
      const snapshot = await loadMallAfterSalesDetail(detailId);
      if (!active) {
        return;
      }
      setDetail(snapshot.detail);
      setEvents(snapshot.events);
      setReturnShipments(snapshot.returnShipments);
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedTypeMeta = useMemo(
    () => AFTER_SALES_TYPES.find((option) => option.value === form.requestType),
    [form.requestType],
  );

  function updateField<K extends keyof AfterSalesFormState>(field: K, value: AfterSalesFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => {
      const nextForm = { ...form, [field]: value };
      const nextErrors = validateAfterSalesForm(nextForm);
      const fieldError = field in nextErrors
        ? nextErrors[field as keyof AfterSalesFormErrors]
        : undefined;
      return {
        ...current,
        [field]: fieldError,
      };
    });
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    if (!isMallAfterSalesMediaRuntimeConfigured()) {
      // No host media runtime: there is deliberately no local blob:/data-URL
      // persistence — evidence references must be host-uploaded
      // (`DRIVE_SPEC.md` §18).
      setMessage("媒体上传不可用：需要宿主提供存储能力");
      event.target.value = "";
      return;
    }
    const mediaRuntime = getMallAfterSalesMediaRuntime();
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
        size: file.size,
        uploadState: "uploading",
      };
      newFiles.push(entry);
      void mediaRuntime
        .uploadImages([file])
        .then(([reference]) => {
          if (!reference) throw new Error("upload returned no reference");
          setForm((current) => ({
            ...current,
            evidenceFiles: current.evidenceFiles.map((item) =>
              item.id === entry.id ? { ...item, reference, uploadState: "uploaded" as const } : item,
            ),
          }));
        })
        .catch(() => {
          skippedForError = true;
          setForm((current) => ({
            ...current,
            evidenceFiles: current.evidenceFiles.filter((item) => item.id !== entry.id),
          }));
        });
    }
    setForm((current) => ({
      ...current,
      evidenceFiles: [...current.evidenceFiles, ...newFiles].slice(0, MAX_EVIDENCE_FILES),
    }));
    event.target.value = "";
    if (skippedForError) {
      setMessage("部分凭证上传失败，已移除；请重试");
    }
  }

  function removeEvidenceFile(fileId: string) {
    setForm((current) => ({
      ...current,
      evidenceFiles: current.evidenceFiles.filter((file) => file.id !== fileId),
    }));
  }

  async function handleCreate() {
    const validationErrors = validateAfterSalesForm(form);
    setErrors(validationErrors);
    setTouched({
      description: true,
      orderId: true,
      reason: true,
      requestedAmountCny: true,
    });
    if (Object.keys(validationErrors).length > 0) {
      setMessage("请修正表单中的错误后再提交");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // Amounts and per-item quantities come from the order domain at submit
      // time; the form amount is user input, the items never are.
      const context = await loadMallAfterSalesOrderContext(form.orderId);
      setOrderContext(context);
      await createMallAfterSalesRequest(form, context);
      setShowForm(false);
      setForm(createEmptyAfterSalesForm());
      setOrderContext(null);
      setErrors({});
      setTouched({});
      setMessage("售后申请已提交，请耐心等待商家审核");
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "提交失败，请确认订单状态后重试");
    } finally {
      setBusy(false);
    }
  }

  async function handleOrderLookup() {
    if (!form.orderId.trim()) {
      return;
    }
    setMessage(null);
    try {
      const context = await loadMallAfterSalesOrderContext(form.orderId);
      setOrderContext(context);
      if (!form.requestedAmountCny.trim()) {
        const reference = context.paidAmountCny ?? context.totalAmountCny;
        if (reference !== null) {
          setForm((current) => ({ ...current, requestedAmountCny: reference.toFixed(2) }));
        }
      }
    } catch (cause: unknown) {
      setOrderContext(null);
      setMessage(cause instanceof Error ? cause.message : "订单读取失败");
    }
  }

  async function handleRevoke(row: AfterSalesRow) {
    setBusy(true);
    setMessage(null);
    try {
      await revokeMallAfterSalesRequest(row.id);
      setMessage("售后申请已撤销");
      await reload();
      if (selectedId === row.id) {
        setSelectedId(null);
      }
    } catch {
      setMessage("撤销失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  function handleModify(row: AfterSalesRow) {
    setForm({
      description: "",
      evidenceFiles: [],
      orderId: row.orderId ?? "",
      reason: row.reason ?? "",
      requestedAmountCny: row.requestedAmountCny != null ? String(row.requestedAmountCny) : "",
      requestType: row.type,
    });
    setOrderContext(null);
    setErrors({});
    setTouched({});
    setShowForm(true);
    setMessage(null);
    void handleOrderLookup();
  }

  function openCreateForm() {
    setForm(createEmptyAfterSalesForm());
    setOrderContext(null);
    setErrors({});
    setTouched({});
    setShowForm(true);
    setMessage(null);
  }

  function openDetail(row: AfterSalesRow) {
    setSelectedId(row.id);
    setSelectedRow(row);
  }

  if (loading) {
    return <LoadingBlock label="加载售后单..." />;
  }

  return (
    <div className="sdkwork-mall-pc-after-sales-page space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">售后中心</h1>
          <p className="mt-1 text-sm text-[var(--sdk-color-text-muted)]">
            管理退款、退货、换货、补发、维修等售后申请
          </p>
        </div>
        <Button onClick={openCreateForm} type="button">申请售后</Button>
      </header>

      {message ? <StatusNotice tone="default">{message}</StatusNotice> : null}

      {showForm ? (
        <section className="rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-6">
          <h2 className="text-lg font-semibold">发起售后</h2>

          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium">
                订单号 <span className="text-[var(--sdk-color-state-danger)]">*</span>
              </span>
              <input
                className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                  touched.orderId && errors.orderId
                    ? "border-[var(--sdk-color-state-danger)]"
                    : "border-[var(--sdk-color-border-default)]"
                }`}
                onChange={(event) => updateField("orderId", event.target.value)}
                onBlur={() => void handleOrderLookup()}
                placeholder="请输入需要售后的订单号"
                value={form.orderId}
              />
              {orderContext ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-success)]">
                  已读取订单：{orderContext.items.length} 项商品 · 实付{" "}
                  {formatAfterSalesCurrencyCny(orderContext.paidAmountCny)}
                </span>
              ) : null}
              {touched.orderId && errors.orderId ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.orderId}</span>
              ) : null}
            </label>

            <fieldset className="block">
              <span className="text-sm font-medium">售后类型</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AFTER_SALES_TYPES.map((option) => (
                  <button
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      form.requestType === option.value
                        ? "border-[var(--sdk-color-brand-primary)] bg-[var(--sdk-color-brand-primary)]/5"
                        : "border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] hover:border-[var(--sdk-color-brand-primary)]"
                    }`}
                    key={option.value}
                    onClick={() => updateField("requestType", option.value)}
                    type="button"
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-[var(--sdk-color-text-muted)]">{option.description}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {(form.requestType === "refund" || form.requestType === "return") ? (
              <label className="block">
                <span className="text-sm font-medium">
                  退款金额 <span className="text-[var(--sdk-color-state-danger)]">*</span>
                </span>
                <input
                  className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                    touched.requestedAmountCny && errors.requestedAmountCny
                      ? "border-[var(--sdk-color-state-danger)]"
                      : "border-[var(--sdk-color-border-default)]"
                  }`}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^\d.]/g, "");
                    updateField("requestedAmountCny", value);
                  }}
                  placeholder="请输入退款金额"
                  value={form.requestedAmountCny}
                />
                {touched.requestedAmountCny && errors.requestedAmountCny ? (
                  <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.requestedAmountCny}</span>
                ) : null}
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium">
                原因说明 <span className="text-[var(--sdk-color-state-danger)]">*</span>
              </span>
              <textarea
                className={`mt-1 w-full rounded-lg border bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)] ${
                  touched.reason && errors.reason
                    ? "border-[var(--sdk-color-state-danger)]"
                    : "border-[var(--sdk-color-border-default)]"
                }`}
                onChange={(event) => updateField("reason", event.target.value)}
                placeholder="请详细描述售后原因，如商品瑕疵、与描述不符等"
                rows={3}
                value={form.reason}
              />
              {touched.reason && errors.reason ? (
                <span className="mt-1 block text-xs text-[var(--sdk-color-state-danger)]">{errors.reason}</span>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium">补充说明（可选）</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sdk-color-border-focus)]"
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="如有其他需要说明的情况请在此填写"
                rows={2}
                value={form.description}
              />
            </label>

            <fieldset className="block">
              <span className="text-sm font-medium">凭证上传（可选，最多 {MAX_EVIDENCE_FILES} 张）</span>
              <div className="mt-2">
                {form.evidenceFiles.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-3">
                    {form.evidenceFiles.map((file) => (
                      <div
                        className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-subtle)]"
                        key={file.id}
                      >
                        {file.previewUrl ? (
                          <img
                            alt={file.name}
                            className="h-full w-full object-cover"
                            src={file.previewUrl}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--sdk-color-text-muted)]">
                            文件
                          </div>
                        )}
                        <button
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sdk-color-surface-panel)] text-xs text-[var(--sdk-color-text-secondary)] shadow-[var(--sdk-shadow-sm)] hover:text-[var(--sdk-color-state-danger)]"
                          onClick={() => removeEvidenceFile(file.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--sdk-color-border-default)] px-4 py-2 text-sm text-[var(--sdk-color-text-secondary)] hover:border-[var(--sdk-color-brand-primary)]">
                  <span>上传凭证图片</span>
                  <input
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                    type="file"
                  />
                </label>
                <p className="mt-1 text-xs text-[var(--sdk-color-text-muted)]">
                  支持 JPG/PNG 格式，单张不超过 5MB
                </p>
              </div>
            </fieldset>

            {selectedTypeMeta ? (
              <div className="rounded-lg border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-subtle)] px-4 py-3 text-xs text-[var(--sdk-color-text-muted)]">
                <strong className="text-[var(--sdk-color-text-secondary)]">{selectedTypeMeta.label}：</strong>
                {selectedTypeMeta.description}
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button disabled={busy} onClick={() => void handleCreate()} type="button">提交申请</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setShowForm(false);
                  setForm(createEmptyAfterSalesForm());
                  setErrors({});
                  setTouched({});
                }}
                type="button"
                variant="ghost"
              >
                取消
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {rows.length === 0 && !showForm ? (
        <EmptyState description="可在订单详情中发起退款/退货/换货/补发/维修申请" title="暂无售后单" />
      ) : rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              className="rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-5"
              key={row.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--sdk-color-brand-primary)]/30 bg-[var(--sdk-color-brand-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--sdk-color-brand-primary)]">
                      {row.typeLabel}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[row.status]}`}
                    >
                      {row.statusLabel}
                    </span>
                    {row.orderId ? (
                      <Link
                        className="text-xs text-[var(--sdk-color-text-secondary)] hover:text-[var(--sdk-color-brand-primary)]"
                        to="/buyer/orders"
                      >
                        订单：{row.orderId}
                      </Link>
                    ) : null}
                    <span className="text-xs text-[var(--sdk-color-text-muted)]">
                      {formatTimestamp(row.createdAt)}
                    </span>
                  </div>
                  {row.reason ? (
                    <p className="mt-2 text-sm text-[var(--sdk-color-text-secondary)]">{row.reason}</p>
                  ) : null}
                  {row.requestedAmountCny != null ? (
                    <p className="mt-1 text-xs text-[var(--sdk-color-text-muted)]">
                      申请金额：{formatAfterSalesCurrencyCny(row.requestedAmountCny)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => openDetail(row)}
                    type="button"
                    variant="outline"
                  >
                    详情
                  </Button>
                  {(row.status === "pending" || row.status === "reviewing") ? (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => void handleModify(row)}
                        type="button"
                        variant="ghost"
                      >
                        修改
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => void handleRevoke(row)}
                        type="button"
                        variant="ghost"
                      >
                        撤销
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {selectedId && (detail || selectedRow) ? (
        <section className="rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">售后详情</h2>
            <Button
              onClick={() => setSelectedId(null)}
              type="button"
              variant="ghost"
            >
              关闭
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">售后单号</div>
              <div className="mt-1 text-sm font-medium">{selectedId}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">售后类型</div>
              <div className="mt-1 text-sm font-medium">
                {selectedRow?.typeLabel ?? String(detail?.type ?? detail?.requestType ?? detail?.afterSalesType ?? "-")}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">状态</div>
              <div className="mt-1">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    selectedRow ? STATUS_TONES[selectedRow.status] : STATUS_TONES.pending
                  }`}
                >
                  {selectedRow?.statusLabel ?? String(detail?.status ?? "-")}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">原因</div>
              <div className="mt-1 text-sm">
                {String(detail?.reasonCode ?? detail?.reason ?? selectedRow?.reason ?? "-")}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">申请金额</div>
              <div className="mt-1 text-sm">
                {formatAfterSalesCurrencyCny(
                  readDetailAmountCny(detail, selectedRow?.requestedAmountCny ?? null),
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--sdk-color-text-muted)]">订单号</div>
              <div className="mt-1 text-sm">
                {selectedRow?.orderId ?? String(detail?.orderId ?? "-")}
              </div>
            </div>
          </div>

          {events.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">处理进度</h3>
              <ol className="mt-3 space-y-2 border-l border-[var(--sdk-color-border-default)] pl-4">
                {events.map((event, index) => (
                  <li className="relative" key={`${event.action}-${index}`}>
                    <span className="absolute -left-[1.4rem] top-1 flex h-2 w-2 items-center justify-center rounded-full bg-[var(--sdk-color-brand-primary)]" />
                    <div className="text-sm font-medium">{event.action}</div>
                    {event.at ? (
                      <div className="text-xs text-[var(--sdk-color-text-muted)]">
                        {formatTimestamp(event.at)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {returnShipments.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">退货物流</h3>
              <ul className="mt-3 space-y-2">
                {returnShipments.map((shipment) => (
                  <li
                    className="flex items-center justify-between rounded-lg border border-[var(--sdk-color-border-subtle)] px-4 py-2 text-sm"
                    key={shipment.id}
                  >
                    <span>
                      <span className="font-medium">{shipment.id}</span>
                      <span className="ml-2 text-[var(--sdk-color-text-muted)]">{shipment.status}</span>
                    </span>
                    {shipment.tracking ? (
                      <span className="text-xs text-[var(--sdk-color-text-secondary)]">
                        运单号：{shipment.tracking}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
