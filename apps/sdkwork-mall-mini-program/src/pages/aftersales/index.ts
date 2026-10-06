import { errorMessage, type MpPickerChangeEvent, type MpTapEvent, type MpInputEvent } from "../../types/common";
import { formatCny } from "../../utils/format";
import {
  AFTER_SALES_REASON_PRESETS,
  AFTER_SALES_TYPES,
  cancelRequest,
  createRequest,
  listRequests,
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
    requestedAmount: string;
    typeLabel: string;
    statusLabel: string;
    revokable: boolean;
  }>;
  loading: boolean;
  loadingOrder: boolean;
  busy: boolean;
  error: string;
}

Page({
  data: {
    presetOrderId: "",
    orderId: "",
    orderLoaded: false,
    orderItems: [],
    orderSummary: "",
    types: AFTER_SALES_TYPES,
    typeIndex: 0,
    reasons: AFTER_SALES_REASON_PRESETS,
    reasonIndex: 0,
    description: "",
    amount: "",
    evidence: [],
    requests: [],
    loading: true,
    loadingOrder: false,
    busy: false,
    error: "",
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
      this.setData({ error: "单张凭证不能超过 5MB" });
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
          fail: (cause) => reject(new Error(cause?.errMsg ?? "读取图片失败")),
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
        error: errorMessage(cause, "凭证上传失败，已移除；请重试"),
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
      this.setData({ error: "请填写订单号" });
      return;
    }
    this.setData({ loadingOrder: true, error: "" });
    try {
      const detail = await getOrderDetail(orderId);
      const reference = detail.paidAmountCny ?? detail.totalAmountCny;
      this.setData({
        orderLoaded: true,
        loadingOrder: false,
        orderSummary: `${detail.items.length} 项商品${reference != null ? ` · 实付 ${formatCny(reference)}` : ""}`,
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
        error: errorMessage(cause, "订单加载失败"),
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
      const requests = await listRequests();
      this.setData({ requests, loading: false });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "售后列表加载失败"),
      });
    }
  },

  async submit() {
    if (!this.data.orderLoaded || !this.data.orderItems || this.data.orderItems.length === 0) {
      this.setData({ error: "请先读取订单" });
      return;
    }
    const amount = Number(this.data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.setData({ error: "请填写有效的售后金额" });
      return;
    }
    if (this.data.evidence.some((item) => item.state === "uploading")) {
      this.setData({ error: "凭证仍在上传中，请稍候" });
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
      wx.showToast({ title: "售后申请已提交", icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: errorMessage(cause, "售后申请失败") });
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
      wx.showToast({ title: "已撤销", icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: errorMessage(cause, "撤销失败") });
    } finally {
      this.setData({ busy: false });
    }
  },
});
