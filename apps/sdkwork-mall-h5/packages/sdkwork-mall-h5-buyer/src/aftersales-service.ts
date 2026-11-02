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
  /** Server-provided status name, when the backend localizes it itself. */
  statusLabel?: string;
  /** Catalogue key used when the backend sends no status name. */
  statusLabelKey: string;
  type: MallH5AfterSalesType;
  /** Catalogue key for the request type. */
  typeLabelKey: string;
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
  { labelKey: "afterSales.type.refund", value: "refund" },
  { labelKey: "afterSales.type.return", value: "return" },
  { labelKey: "afterSales.type.exchange", value: "exchange" },
] as const;

export const MALL_H5_AFTER_SALES_REASON_PRESETS = [
  { code: "not-as-described", labelKey: "afterSales.reason.notAsDescribed" },
  { code: "quality-issue", labelKey: "afterSales.reason.qualityIssue" },
  { code: "missing-item", labelKey: "afterSales.reason.missingItem" },
  { code: "shipping-issue", labelKey: "afterSales.reason.shippingIssue" },
  { code: "change-mind", labelKey: "afterSales.reason.changeMind" },
  { code: "other", labelKey: "afterSales.reason.other" },
] as const;

const STATUS_LABEL_KEYS: Record<string, string> = {
  approved: "afterSales.status.approved",
  cancelled: "afterSales.status.cancelled",
  completed: "afterSales.status.completed",
  pending: "afterSales.status.pending",
  rejected: "afterSales.status.rejected",
  reviewing: "afterSales.status.reviewing",
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

function normalizeStatus(raw: string): { key: string; labelKey: string } {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "reviewing" || normalized === "review" || normalized === "processing") {
    return { key: "reviewing", labelKey: STATUS_LABEL_KEYS.reviewing };
  }
  if (normalized === "approved" || normalized === "accept" || normalized === "accepted") {
    return { key: "approved", labelKey: STATUS_LABEL_KEYS.approved };
  }
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "revoked") {
    return { key: "cancelled", labelKey: STATUS_LABEL_KEYS.cancelled };
  }
  if (normalized === "completed" || normalized === "done" || normalized === "finished") {
    return { key: "completed", labelKey: STATUS_LABEL_KEYS.completed };
  }
  if (normalized === "rejected" || normalized === "deny" || normalized === "denied") {
    return { key: "rejected", labelKey: STATUS_LABEL_KEYS.rejected };
  }
  return { key: normalized || "pending", labelKey: STATUS_LABEL_KEYS.pending };
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
    statusLabel: readString(item, ["statusName"]) || undefined,
    statusLabelKey: status.labelKey,
    type,
    typeLabelKey: `afterSales.type.${type}`,
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

/** Carriers offered when the buyer ships the goods back. */
export const MALL_H5_RETURN_CARRIERS = [
  { code: "SF", nameKey: "afterSales.carrier.sf" },
  { code: "ZTO", nameKey: "afterSales.carrier.zto" },
  { code: "YTO", nameKey: "afterSales.carrier.yto" },
  { code: "YUNDA", nameKey: "afterSales.carrier.yunda" },
  { code: "JD", nameKey: "afterSales.carrier.jd" },
  { code: "OTHER", nameKey: "afterSales.carrier.other" },
] as const;

export interface MallH5ReturnShipmentInput {
  carrierCode: string;
  carrierName?: string;
  requestId: string;
  trackingNo: string;
}

/** One entry of the after-sales progress timeline. */
export interface MallH5AfterSalesEvent {
  action: string;
  at?: string;
}

/**
 * Loads the progress timeline of one after-sales request
 * (`GET /after_sales/requests/{id}/events`). PC has shown this since the
 * process screen landed; the mobile roots had no way to see refund progress.
 */
export async function loadMallH5AfterSalesEvents(
  requestId: string,
): Promise<MallH5AfterSalesEvent[]> {
  if (!hasSdkworkOrderSession()) {
    throw new Error("请先登录后查看售后进度。");
  }
  const response = await getSdkworkCommerceService().afterSales.events.list(requestId, {
    page: 1,
    pageSize: 20,
  });
  const payload =
    unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => ({
    action: String(item.eventType ?? item.action ?? item.toStatus ?? "event"),
    at: typeof item.createdAt === "string" ? item.createdAt : undefined,
  }));
}

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Submits the buyer's return tracking number
 * (`POST /after_sales/requests/{id}/return_shipments`). The command is
 * idempotent per submit so a retry cannot create a duplicate shipment.
 */
export async function createMallH5AfterSalesReturnShipment(
  input: MallH5ReturnShipmentInput,
): Promise<void> {
  if (!hasSdkworkOrderSession()) {
    throw new Error("请先登录后填写退货物流。");
  }
  await getSdkworkCommerceService().afterSales.returnShipments.create(
    input.requestId,
    {
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      shipmentDirection: "buyer_return",
      trackingNo: input.trackingNo.trim(),
    },
    { idempotencyKey: createIdempotencyKey() },
  );
}
