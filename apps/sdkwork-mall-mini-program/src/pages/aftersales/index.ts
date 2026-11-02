import { t } from "../../i18n";
import { errorMessage, type MpPickerChangeEvent, type MpTapEvent, type MpInputEvent } from "../../types/common";
import { formatCny } from "../../utils/format";
import {
  AFTER_SALES_REASON_PRESETS,
  AFTER_SALES_TYPES,
  cancelRequest,
  createRequest,
  createReturnShipment,
  listAfterSalesEvents,
  listRequests,
  RETURN_CARRIERS,
  type MpAfterSalesEvidenceItem,
  type MpAfterSalesItemInput,
} from "../../services/aftersales-service";
import { uploadDriveImage } from "../../services/drive-upload-service";
import { getOrderDetail } from "../../services/order-service";
import { SDKWORK_MALL_MP_AFTER_SALES_EVIDENCE_UPLOAD } from "../../bootstrap/uploadDeclaration";

const MAX_EVIDENCE_FILES = 6;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

interface EvidenceEntry {
  id: string;
  tempPath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  state: "uploading" | "uploaded";
  reference: string;
}

interface AftersalesData {
  presetOrderId: string;
  orderId: string;
  orderLoaded: boolean;
  orderItems: MpAfterSalesItemInput[];
  orderSummary: string;
  types: Array<{ label: string; value: string }>;
  typeIndex: number;
  reasons: Array<{ code: string; label: string }>;
  reasonIndex: number;
  description: string;
  amount: string;
  evidence: EvidenceEntry[];
  requests: Array<{
    id: string;
    afterSalesNo: string;
    orderId: string;
    orderNoText: string;
    requestedAmount: string;
    typeLabel: string;
    statusLabel: string;
    returnable: boolean;
    revokable: boolean;
  }>;
  returnCarriers: ReadonlyArray<{ code: string; name: string }>;
  returnFormRequestId: string;
  returnCarrierIndex: number;
  returnTrackingNo: string;
  returnBusy: boolean;
  progressRequestId: string;
  progressEvents: Array<{ action: string; at: string }>;
  progressLoading: boolean;
  loading: boolean;
  loadingOrder: boolean;
  busy: boolean;
  error: string;
  titleText: string;
  loadingText: string;
  retryText: string;
  applyTitle: string;
  orderLabel: string;
  orderPlaceholder: string;
  readOrderText: string;
  readingText: string;
  changeOrderText: string;
  changeShortText: string;
  typeLabel: string;
  reasonLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  amountLabel: string;
  evidenceLabel: string;
  evidenceUploadingText: string;
  evidenceUploadedText: string;
  submitText: string;
  submittingText: string;
  listTitle: string;
  listEmpty: string;
  cancelText: string;
  returnEntryText: string;
  progressToggleText: string;
  progressCollapseText: string;
  progressLoadingText: string;
  progressEmptyText: string;
  returnCarrierLabel: string;
  returnTrackingLabel: string;
  returnTrackingPlaceholder: string;
  returnSubmitText: string;
  returnSubmitShortText: string;
  returnCancelText: string;
}

function typeOptions(): Array<{ label: string; value: string }> {
  return AFTER_SALES_TYPES.map((entry) => ({ label: t(entry.labelKey), value: entry.value }));
}

function reasonOptions(): Array<{ code: string; label: string }> {
  return AFTER_SALES_REASON_PRESETS.map((entry) => ({
    code: entry.code,
    label: t(entry.labelKey),
  }));
}

function carrierOptions(): Array<{ code: string; name: string }> {
  return RETURN_CARRIERS.map((entry) => ({ code: entry.code, name: t(entry.nameKey) }));
}

Page({
  data: {
    presetOrderId: "",
    orderId: "",
    orderLoaded: false,
    orderItems: [],
    orderSummary: "",
    types: typeOptions(),
    typeIndex: 0,
    reasons: reasonOptions(),
    reasonIndex: 0,
    description: "",
    amount: "",
    evidence: [],
    requests: [],
    returnCarriers: carrierOptions(),
    returnFormRequestId: "",
    returnCarrierIndex: 0,
    returnTrackingNo: "",
    returnBusy: false,
    progressRequestId: "",
    progressEvents: [],
    progressLoading: false,
    loading: true,
    loadingOrder: false,
    busy: false,
    error: "",
    titleText: t("afterSales.page.title"),
    loadingText: t("afterSales.page.loading"),
    retryText: t("afterSales.page.retry"),
    applyTitle: t("afterSales.apply.title"),
    orderLabel: t("afterSales.apply.orderLabel"),
    orderPlaceholder: t("afterSales.apply.orderPlaceholder"),
    readOrderText: t("afterSales.apply.readOrder"),
    readingText: t("afterSales.apply.reading"),
    changeOrderText: t("afterSales.apply.changeOrder"),
    changeShortText: t("afterSales.apply.changeShort"),
    typeLabel: t("afterSales.apply.typeLabel"),
    reasonLabel: t("afterSales.apply.reasonLabel"),
    descriptionLabel: t("afterSales.apply.descriptionLabel"),
    descriptionPlaceholder: t("afterSales.apply.descriptionPlaceholder"),
    amountLabel: t("afterSales.apply.amountLabel"),
    evidenceLabel: t("afterSales.apply.evidenceLabel", { count: MAX_EVIDENCE_FILES }),
    evidenceUploadingText: t("afterSales.apply.evidenceUploading"),
    evidenceUploadedText: t("afterSales.apply.evidenceUploaded"),
    submitText: t("afterSales.apply.submit"),
    submittingText: t("afterSales.apply.submitting"),
    listTitle: t("afterSales.list.title"),
    listEmpty: t("afterSales.list.empty"),
    cancelText: t("afterSales.list.cancel"),
    returnEntryText: t("afterSales.list.returnEntry"),
    progressToggleText: t("afterSales.list.progressToggle"),
    progressCollapseText: t("afterSales.list.progressCollapse"),
    progressLoadingText: t("afterSales.list.progressLoading"),
    progressEmptyText: t("afterSales.list.progressEmpty"),
    returnCarrierLabel: t("afterSales.return.carrierLabel"),
    returnTrackingLabel: t("afterSales.return.trackingLabel"),
    returnTrackingPlaceholder: t("afterSales.return.trackingPlaceholder"),
    returnSubmitText: t("afterSales.return.submit"),
    returnSubmitShortText: t("afterSales.return.submitShort"),
    returnCancelText: t("afterSales.return.cancel"),
  } as AftersalesData,

  onLoad(options: Record<string, string | undefined>) {
    const presetOrderId = options?.orderId ?? "";
    this.setData({ presetOrderId, orderId: presetOrderId });
    if (presetOrderId) {
      void this.loadOrder();
    }
    void this.reloadRequests();
  },

  onOrderIdInput(event: MpInputEvent) {
    this.setData({ orderId: event.detail.value });
  },

  onDescriptionInput(event: MpInputEvent) {
    this.setData({ description: event.detail.value });
  },

  onAmountInput(event: MpInputEvent) {
    this.setData({ amount: event.detail.value });
  },

  onTypeChange(event: MpPickerChangeEvent) {
    this.setData({ typeIndex: Number(event.detail.value) || 0 });
  },

  onReasonChange(event: MpPickerChangeEvent) {
    this.setData({ reasonIndex: Number(event.detail.value) || 0 });
  },

  chooseEvidence() {
    const remaining = MAX_EVIDENCE_FILES - this.data.evidence.length;
    if (remaining <= 0) {
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sizeType: ["compressed"],
      success: (result) => {
        for (const item of result.tempFiles ?? []) {
          void this.uploadOneEvidence(String(item.tempFilePath), Number(item.size ?? 0));
        }
      },
    });
  },

  async uploadOneEvidence(tempPath: string, sizeBytes: number) {
    if (sizeBytes > MAX_EVIDENCE_BYTES) {
      this.setData({ error: t("afterSales.errors.evidenceTooLarge") });
      return;
    }
    const entry: EvidenceEntry = {
      id: `${tempPath}-${Date.now()}`,
      tempPath,
      fileName: tempPath.split("/").pop() || "evidence.jpg",
      fileSize: sizeBytes,
      fileType: "image/jpeg",
      state: "uploading",
      reference: "",
    };
    this.setData({ evidence: [...this.data.evidence, entry].slice(0, MAX_EVIDENCE_FILES) });
    try {
      const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: tempPath,
          success: (read) => resolve(read.data as ArrayBuffer),
          fail: (cause) => reject(new Error(cause?.errMsg ?? t("afterSales.errors.readImageFailed"))),
        });
      });
      const reference = await uploadDriveImage({
        declaration: SDKWORK_MALL_MP_AFTER_SALES_EVIDENCE_UPLOAD,
        appResourceId: SDKWORK_MALL_MP_AFTER_SALES_EVIDENCE_UPLOAD.scene,
        file: {
          fileName: entry.fileName,
          contentType: entry.fileType,
          bytes,
        },
      });
      this.setData({
        evidence: this.data.evidence.map((item) =>
          item.id === entry.id ? { ...item, state: "uploaded", reference } : item,
        ),
      });
    } catch (cause) {
      this.setData({
        evidence: this.data.evidence.filter((item) => item.id !== entry.id),
        error: errorMessage(cause, t("afterSales.errors.evidenceUploadFailed")),
      });
    }
  },

  removeEvidence(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ evidence: this.data.evidence.filter((item) => item.id !== id) });
  },

  async loadOrder() {
    const orderId = this.data.orderId.trim();
    if (!orderId) {
      this.setData({ error: t("afterSales.errors.orderRequired") });
      return;
    }
    this.setData({ loadingOrder: true, error: "" });
    try {
      const detail = await getOrderDetail(orderId);
      const reference = detail.paidAmountCny ?? detail.totalAmountCny;
      this.setData({
        orderLoaded: true,
        loadingOrder: false,
        orderSummary:
          reference != null
            ? t("afterSales.apply.orderSummaryAmount", {
                amount: formatCny(reference),
                count: detail.items.length,
              })
            : t("afterSales.apply.orderSummary", { count: detail.items.length }),
        amount: this.data.amount || (reference != null ? reference.toFixed(2) : ""),
        orderItems: detail.items.map((item) => ({
          orderItemId: item.id,
          requestedQuantity: item.quantity,
          refundAmountCny: item.priceCny != null ? Number((item.priceCny * item.quantity).toFixed(2)) : null,
        })),
      });
    } catch (cause) {
      this.setData({
        loadingOrder: false,
        orderLoaded: false,
        orderItems: [],
        orderSummary: "",
        error: errorMessage(cause, t("afterSales.errors.orderLoadFailed")),
      });
    }
  },

  clearOrder() {
    this.setData({
      orderId: "",
      presetOrderId: "",
      orderLoaded: false,
      orderItems: [],
      orderSummary: "",
      amount: "",
    });
  },

  async reloadRequests() {
    try {
      const rows = await listRequests();
      this.setData({
        requests: rows.map((row) => ({
          ...row,
          statusLabel: row.statusLabelKey ? t(row.statusLabelKey) : row.status,
          typeLabel: row.typeLabelKey ? t(row.typeLabelKey) : row.type,
          orderNoText: t("afterSales.list.orderNo", { id: row.orderId }),
        })),
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("afterSales.errors.listLoadFailed")),
      });
    }
  },

  async submit() {
    if (!this.data.orderLoaded || !this.data.orderItems || this.data.orderItems.length === 0) {
      this.setData({ error: t("afterSales.errors.readOrderFirst") });
      return;
    }
    const amount = Number(this.data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.setData({ error: t("afterSales.errors.amountInvalid") });
      return;
    }
    if (this.data.evidence.some((item) => item.state === "uploading")) {
      this.setData({ error: t("afterSales.errors.evidenceUploading") });
      return;
    }
    const type = this.data.types[this.data.typeIndex];
    this.setData({ busy: true, error: "" });
    try {
      const evidenceSnapshot: MpAfterSalesEvidenceItem[] = this.data.evidence
        .filter((item) => item.state === "uploaded" && item.reference)
        .map((item) => ({
          reference: item.reference,
          fileName: item.fileName,
          fileSize: item.fileSize,
          fileType: item.fileType,
        }));
      await createRequest({
        orderId: this.data.orderId.trim(),
        afterSalesType: type.value,
        reasonCode: this.data.reasons[this.data.reasonIndex].code,
        description: this.data.description,
        evidenceSnapshot,
        requestedAmountCny: amount,
        items: this.data.orderItems,
      });
      this.setData({
        description: "",
        evidence: [],
        orderItems: [],
        orderLoaded: false,
        orderSummary: "",
        amount: "",
        orderId: "",
        presetOrderId: "",
      });
      wx.showToast({ title: t("afterSales.apply.submitted"), icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: errorMessage(cause, t("afterSales.errors.submitFailed")) });
    } finally {
      this.setData({ busy: false });
    }
  },

  async cancelRequest(event: MpTapEvent) {
    const requestId = `${event.currentTarget.dataset.id ?? ""}`;
    if (!requestId) {
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await cancelRequest(requestId);
      wx.showToast({ title: t("afterSales.list.cancelled"), icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: errorMessage(cause, t("afterSales.errors.cancelFailed")) });
    } finally {
      this.setData({ busy: false });
    }
  },

  openReturnForm(event: MpTapEvent) {
    this.setData({
      returnFormRequestId: `${event.currentTarget.dataset.id ?? ""}`,
      returnCarrierIndex: 0,
      returnTrackingNo: "",
    });
  },

  closeReturnForm() {
    this.setData({ returnFormRequestId: "", returnTrackingNo: "" });
  },

  onReturnCarrierChange(event: MpPickerChangeEvent) {
    this.setData({ returnCarrierIndex: Number(event.detail.value) || 0 });
  },

  onReturnTrackingInput(event: MpInputEvent) {
    this.setData({ returnTrackingNo: event.detail.value });
  },

  async submitReturnShipment() {
    const requestId = this.data.returnFormRequestId;
    if (!requestId) {
      return;
    }
    const trackingNo = this.data.returnTrackingNo.trim();
    if (!trackingNo) {
      this.setData({ error: t("afterSales.errors.trackingRequired") });
      return;
    }
    const carrier = this.data.returnCarriers[this.data.returnCarrierIndex];
    this.setData({ returnBusy: true, error: "" });
    try {
      await createReturnShipment({
        requestId,
        carrierCode: carrier.code,
        carrierName: carrier.name,
        trackingNo,
      });
      this.setData({ returnBusy: false, returnFormRequestId: "", returnTrackingNo: "" });
      wx.showToast({ title: t("afterSales.return.submitted"), icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({
        returnBusy: false,
        error: errorMessage(cause, t("afterSales.errors.returnSubmitFailed")),
      });
    }
  },

  async toggleProgress(event: MpTapEvent) {
    const requestId = `${event.currentTarget.dataset.id ?? ""}`;
    if (!requestId) {
      return;
    }
    if (this.data.progressRequestId === requestId) {
      this.setData({ progressRequestId: "" });
      return;
    }
    this.setData({ progressRequestId: requestId, progressEvents: [], progressLoading: true });
    try {
      const events = await listAfterSalesEvents(requestId);
      if (this.data.progressRequestId === requestId) {
        this.setData({ progressEvents: events, progressLoading: false });
      }
    } catch (cause) {
      this.setData({
        progressLoading: false,
        error: errorMessage(cause, t("afterSales.errors.progressLoadFailed")),
      });
    }
  },

  retry() {
    void this.loadOrder(); void this.reloadRequests();
  },
});
