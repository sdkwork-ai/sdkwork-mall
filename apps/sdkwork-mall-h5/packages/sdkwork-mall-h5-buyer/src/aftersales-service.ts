import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";
import {
  getSdkworkOrderService,
  hasSdkworkOrderSession,
  requireSdkworkOrderSession,
  toNullableSdkworkOrderNumber,
  toSdkworkOrderNumber,
  toSdkworkOrderOptionalString,
  unwrapSdkworkOrderResponse,
} from "@sdkwork/order-service";

export type MallH5AfterSalesType = "exchange" | "refund" | "return";

export interface MallH5AfterSalesRequest {
  afterSalesNo?: string;
  createdAt?: string;
  description?: string;
  id: string;
  orderId: string;
  reason?: string;
  requestedAmountCny: number | null;
  status: string;
  statusLabel: string;
  type: MallH5AfterSalesType;
  typeLabel: string;
}

/** Order snapshot used to prefill the apply form and build the create payload. */
export interface MallH5AfterSalesOrderContext {
  items: Array<{ orderItemId: string; priceCny: number | null; quantity: number; title: string }>;
  orderId: string;
  paidAmountCny: number | null;
  status: string;
  totalAmountCny: number | null;
}

/** One drive-backed evidence item riding the free-form evidenceSnapshot. */
export interface MallH5AfterSalesEvidenceItem {
  /** Backend-addressable `drive://` reference from the host media port. */
  reference: string;
  /** Declared file metadata captured at pick time. */
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export interface MallH5AfterSalesApplyInput {
  description?: string;
  evidenceSnapshot?: MallH5AfterSalesEvidenceItem[];
  orderId: string;
  reasonCode: string;
  requestedAmountCny: number;
  type: MallH5AfterSalesType;
  items: Array<{ orderItemId: string; refundAmountCny?: number; requestedQuantity: number }>;
}

export const MALL_H5_AFTER_SALES_TYPES = [
  { value: "refund", label: "仅退款" },
  { value: "return", label: "退货退款" },
  { value: "exchange", label: "换货" },
] as const;

export const MALL_H5_AFTER_SALES_REASON_PRESETS = [
  { code: "not-as-described", label: "商品与描述不符" },
  { code: "quality-issue", label: "质量问题" },
  { code: "missing-item", label: "少件/漏发" },
  { code: "shipping-issue", label: "发货/物流问题" },
  { code: "change-mind", label: "多拍/错拍/不想要了" },
  { code: "other", label: "其他" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  approved: "已通过",
  cancelled: "已撤销",
  completed: "已完成",
  pending: "待审核",
  rejected: "已拒绝",
  reviewing: "审核中",
};

const TYPE_LABELS: Record<MallH5AfterSalesType, string> = {
  exchange: "换货",
  refund: "仅退款",
  return: "退货退款",
};

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function readAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeType(raw: string): MallH5AfterSalesType {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "return" || normalized === "return_refund" || normalized === "return-refund") {
    return "return";
  }
  if (normalized === "exchange") {
    return "exchange";
  }
  return "refund";
}

function normalizeStatus(raw: string): { key: string; label: string } {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "reviewing" || normalized === "review" || normalized === "processing") {
    return { key: normalized, label: STATUS_LABELS.reviewing };
  }
  if (normalized === "approved" || normalized === "accept" || normalized === "accepted") {
    return { key: normalized, label: STATUS_LABELS.approved };
  }
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "revoked") {
    return { key: normalized, label: STATUS_LABELS.cancelled };
  }
  if (normalized === "completed" || normalized === "done" || normalized === "finished") {
    return { key: normalized, label: STATUS_LABELS.completed };
  }
  if (normalized === "rejected" || normalized === "deny" || normalized === "denied") {
    return { key: normalized, label: STATUS_LABELS.rejected };
  }
  return { key: normalized || "pending", label: STATUS_LABELS.pending };
}

function mapRequest(item: Record<string, unknown>): MallH5AfterSalesRequest {
  const type = normalizeType(readString(item, ["afterSalesType", "type", "requestType"]));
  const status = normalizeStatus(readString(item, ["status", "statusName"]));
  return {
    afterSalesNo: readString(item, ["afterSalesNo", "requestNo"]) || undefined,
    createdAt: readString(item, ["createdAt", "created_at", "appliedAt"]) || undefined,
    description: readString(item, ["description", "reasonText"]) || undefined,
    id: readString(item, ["id", "afterSalesRequestId", "requestId"]),
    orderId: readString(item, ["orderId", "order_id"]),
    reason: readString(item, ["reasonCode", "reason"]) || undefined,
    requestedAmountCny: readAmount(item.requestedAmount ?? item.requested_amount),
    status: status.key,
    statusLabel: readString(item, ["statusName"]) || status.label,
    type,
    typeLabel: TYPE_LABELS[type],
  };
}

export async function listMallH5AfterSalesRequests(): Promise<MallH5AfterSalesRequest[]> {
  const response = await getSdkworkCommerceService().afterSales.requests.list({
    page: 1,
    page_size: 50,
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map(mapRequest);
}

/**
 * Loads the buyer order snapshot used to prefill the apply form. Amounts and
 * per-item quantities come from the order domain, never from user input.
 */
export async function loadMallH5AfterSalesOrderContext(
  orderId: string,
): Promise<MallH5AfterSalesOrderContext> {
  requireSdkworkOrderSession("请先登录后申请售后。");
  const payload = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
    await getSdkworkOrderService().orders.retrieve(orderId),
    "订单加载失败",
  );
  if (!payload) {
    throw new Error("订单不存在或已被删除");
  }
  const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  const items = rawItems.map((item, index) => ({
    orderItemId:
      toSdkworkOrderOptionalString(item.orderItemId ?? item.id) || `item-${index + 1}`,
    priceCny: toNullableSdkworkOrderNumber(item.priceCny),
    quantity: toSdkworkOrderNumber(item.quantity) ?? 1,
    title:
      toSdkworkOrderOptionalString(
        (item.spu as Record<string, unknown> | undefined)?.title ?? item.title,
      ) || "商品",
  }));
  return {
    items,
    orderId: toSdkworkOrderOptionalString(payload.orderId) || orderId,
    paidAmountCny: toNullableSdkworkOrderNumber(payload.paidAmount),
    status: toSdkworkOrderOptionalString(payload.status) || "",
    totalAmountCny: toNullableSdkworkOrderNumber(payload.totalAmount),
  };
}

/**
 * Creates an after-sales request with the wire-contract body
 * (`CreateAfterSalesRequest`): orderId, afterSalesType, reasonCode,
 * requestedAmount (decimal string), currencyCode, and at least one item.
 */
export async function createMallH5AfterSalesRequest(input: MallH5AfterSalesApplyInput): Promise<void> {
  if (!hasSdkworkOrderSession()) {
    throw new Error("请先登录后申请售后。");
  }
  const body = {
    afterSalesType: input.type,
    currencyCode: "CNY",
    description: input.description?.trim() ? input.description.trim() : undefined,
    evidenceSnapshot: input.evidenceSnapshot?.length
      ? input.evidenceSnapshot.map((item) => ({
          fileName: item.fileName,
          fileSize: item.fileSize,
          fileType: item.fileType,
          reference: item.reference,
        }))
      : undefined,
    items: input.items.map((item) => ({
      orderItemId: item.orderItemId,
      refundAmount: item.refundAmountCny === undefined ? undefined : item.refundAmountCny.toFixed(2),
      requestedQuantity: item.requestedQuantity,
    })),
    orderId: input.orderId,
    reasonCode: input.reasonCode,
    requestedAmount: input.requestedAmountCny.toFixed(2),
  };
  await getSdkworkCommerceService().afterSales.requests.create(body);
}

/** Revokes a pending after-sales request (`UpdateAfterSalesRequest.status`). */
export async function cancelMallH5AfterSalesRequest(requestId: string): Promise<void> {
  await getSdkworkCommerceService().afterSales.requests.update(requestId, {
    status: "CANCELLED",
  });
}
