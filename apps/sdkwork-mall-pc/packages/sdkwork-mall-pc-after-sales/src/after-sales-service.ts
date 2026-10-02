import {
  formatSdkworkPaymentCurrencyCny,
  unwrapSdkworkPaymentResponse,
} from "@sdkwork/payment-service";

import { getSdkworkAfterSalesRemotePort } from "./after-sales-remote-port";

export type AfterSalesType = "exchange" | "maintenance" | "refund" | "resend" | "return";

export type AfterSalesStatus =
  | "approved"
  | "cancelled"
  | "completed"
  | "pending"
  | "rejected"
  | "reviewing";

export interface AfterSalesRow {
  createdAt?: string;
  id: string;
  orderId?: string;
  reason?: string;
  requestedAmountCny?: number | null;
  status: AfterSalesStatus;
  statusLabel: string;
  type: AfterSalesType;
  typeLabel: string;
}

export interface AfterSalesFormState {
  description: string;
  evidenceFiles: Array<{ id: string; name: string; previewUrl?: string; size: number }>;
  orderId: string;
  reason: string;
  requestedAmountCny: string;
  requestType: AfterSalesType;
}

export interface AfterSalesFormErrors {
  description?: string;
  orderId?: string;
  reason?: string;
  requestedAmountCny?: string;
}

export interface AfterSalesDetailSnapshot {
  detail: Record<string, unknown> | null;
  events: Array<{ action: string; at?: string }>;
  returnShipments: Array<{ id: string; status: string; tracking?: string }>;
}

export const AFTER_SALES_TYPES: Array<{ label: string; value: AfterSalesType; description: string }> = [
  { description: "商品未发货，申请退款", label: "仅退款", value: "refund" },
  { description: "已收货，退回商品并获得退款", label: "退货退款", value: "return" },
  { description: "更换同款商品（颜色/尺码等）", label: "换货", value: "exchange" },
  { description: "商家重新发货（无需退回原商品）", label: "补发", value: "resend" },
  { description: "商品质量问题，申请维修", label: "维修", value: "maintenance" },
];

export const STATUS_LABELS: Record<AfterSalesStatus, string> = {
  approved: "已通过",
  cancelled: "已撤销",
  completed: "已完成",
  pending: "待审核",
  rejected: "已拒绝",
  reviewing: "审核中",
};

export const TYPE_LABELS: Record<AfterSalesType, string> = {
  exchange: "换货",
  maintenance: "维修",
  refund: "仅退款",
  resend: "补发",
  return: "退货退款",
};

export function formatAfterSalesCurrencyCny(value: number | null | undefined): string {
  return formatSdkworkPaymentCurrencyCny(value);
}

export function createEmptyAfterSalesForm(): AfterSalesFormState {
  return {
    description: "",
    evidenceFiles: [],
    orderId: "",
    reason: "",
    requestedAmountCny: "",
    requestType: "refund",
  };
}

export function validateAfterSalesForm(form: AfterSalesFormState): AfterSalesFormErrors {
  const errors: AfterSalesFormErrors = {};
  if (!form.orderId.trim()) {
    errors.orderId = "请填写订单号";
  }
  if (!form.reason.trim()) {
    errors.reason = "请填写售后原因";
  } else if (form.reason.trim().length < 5) {
    errors.reason = "原因说明至少需要 5 个字符";
  }
  if (form.requestType === "refund" || form.requestType === "return") {
    if (!form.requestedAmountCny.trim()) {
      errors.requestedAmountCny = "请填写退款金额";
    } else {
      const amount = Number(form.requestedAmountCny);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.requestedAmountCny = "退款金额必须为正数";
      }
    }
  }
  return errors;
}

function mapStatus(raw: string): AfterSalesStatus {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "approved" || normalized === "accept" || normalized === "accepted") {
    return "approved";
  }
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "revoked") {
    return "cancelled";
  }
  if (normalized === "completed" || normalized === "done" || normalized === "finished") {
    return "completed";
  }
  if (normalized === "rejected" || normalized === "deny" || normalized === "denied") {
    return "rejected";
  }
  if (normalized === "reviewing" || normalized === "review" || normalized === "processing") {
    return "reviewing";
  }
  return "pending";
}

function mapType(raw: string): AfterSalesType {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "exchange" || normalized === "换货") {
    return "exchange";
  }
  if (normalized === "maintenance" || normalized === "repair" || normalized === "维修") {
    return "maintenance";
  }
  if (normalized === "resend" || normalized === "reship" || normalized === "补发") {
    return "resend";
  }
  if (normalized === "return" || normalized === "退货退款" || normalized === "return_refund") {
    return "return";
  }
  return "refund";
}

function mapRowAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const amount = Number(value);
    if (Number.isFinite(amount)) {
      return amount;
    }
  }
  return null;
}

function mapRow(item: Record<string, unknown>): AfterSalesRow {
  const rawType = String(item.type ?? item.requestType ?? item.afterSalesType ?? "refund");
  const rawStatus = String(item.status ?? item.statusName ?? "pending");
  const mappedType = mapType(rawType);
  const mappedStatus = mapStatus(rawStatus);
  const description = typeof item.description === "string" && item.description.trim() !== ""
    ? item.description
    : undefined;
  return {
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    id: String(item.id ?? ""),
    orderId: typeof item.orderId === "string" ? item.orderId : undefined,
    reason: description
      ?? (typeof item.reason === "string" ? item.reason : undefined)
      ?? (typeof item.reasonCode === "string" && item.reasonCode !== "buyer-request" ? item.reasonCode : undefined),
    requestedAmountCny: mapRowAmount(item.requestedAmount ?? item.requested_amount),
    status: mappedStatus,
    statusLabel: typeof item.statusName === "string" ? item.statusName : STATUS_LABELS[mappedStatus],
    type: mappedType,
    typeLabel: TYPE_LABELS[mappedType],
  };
}

export async function listMallAfterSalesRows(): Promise<AfterSalesRow[]> {
  const response = await getSdkworkAfterSalesRemotePort().listAfterSalesRequests({});
  const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
  return payload.items?.map(mapRow) ?? [];
}

/** Order snapshot used to prefill the form and build the create payload. */
export interface AfterSalesOrderContext {
  items: Array<{ orderItemId: string; priceCny: number | null; quantity: number; title: string }>;
  orderId: string;
  paidAmountCny: number | null;
  status: string;
  totalAmountCny: number | null;
}

function readContextAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Loads the buyer order snapshot for the after-sales form. Amounts and
 * per-item quantities come from the order domain, never from user input.
 */
export async function loadMallAfterSalesOrderContext(orderId: string): Promise<AfterSalesOrderContext> {
  const trimmed = orderId.trim();
  if (!trimmed) {
    throw new Error("请填写订单号");
  }
  const payload = unwrapSdkworkPaymentResponse<Record<string, unknown> | null>(
    await getSdkworkAfterSalesRemotePort().retrieveOrder(trimmed),
  );
  if (!payload) {
    throw new Error("订单不存在或已被删除");
  }
  const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    items: rawItems.map((item, index) => ({
      orderItemId: String(item.orderItemId ?? item.id ?? `item-${index + 1}`),
      priceCny: readContextAmount(item.priceCny),
      quantity: readContextAmount(item.quantity) ?? 1,
      title:
        String(
          (item.spu as Record<string, unknown> | undefined)?.title
            ?? item.title
            ?? "商品",
        ),
    })),
    orderId: String(payload.orderId ?? trimmed),
    paidAmountCny: readContextAmount(payload.paidAmount),
    status: String(payload.status ?? ""),
    totalAmountCny: readContextAmount(payload.totalAmount),
  };
}

export async function loadMallAfterSalesDetail(selectedId: string): Promise<AfterSalesDetailSnapshot> {
  const remote = getSdkworkAfterSalesRemotePort();
  const [detailResult, eventsResult, returnResult] = await Promise.allSettled([
    remote.retrieveAfterSalesRequest(selectedId),
    remote.listAfterSalesEvents(selectedId, { page: 1, page_size: 10 }),
    remote.listReturnShipments(selectedId, { page: 1, page_size: 5 }),
  ]);

  const snapshot: AfterSalesDetailSnapshot = {
    detail: null,
    events: [],
    returnShipments: [],
  };

  if (detailResult.status === "fulfilled") {
    snapshot.detail = unwrapSdkworkPaymentResponse(detailResult.value) as Record<string, unknown>;
  }
  if (eventsResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(eventsResult.value) as { items?: Record<string, unknown>[] };
    snapshot.events =
      payload.items?.map((item) => ({
        action: String(item.eventType ?? item.action ?? item.toStatus ?? "event"),
        at: typeof item.createdAt === "string" ? item.createdAt : undefined,
      })) ?? [];
  }
  if (returnResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(returnResult.value) as { items?: Record<string, unknown>[] };
    snapshot.returnShipments =
      payload.items?.map((item) => ({
        id: String(item.id ?? item.returnShipmentNo ?? ""),
        status: String(item.status ?? "pending"),
        tracking: typeof item.trackingNo === "string" ? item.trackingNo : undefined,
      })) ?? [];
  }

  return snapshot;
}

/**
 * Creates an after-sales request with the wire-contract body
 * (`CreateAfterSalesRequest`): orderId, afterSalesType, reasonCode,
 * requestedAmount (decimal string), currencyCode, and at least one order item.
 * The order context supplies the items; call loadMallAfterSalesOrderContext()
 * first.
 */
export async function createMallAfterSalesRequest(
  form: AfterSalesFormState,
  orderContext: AfterSalesOrderContext,
): Promise<void> {
  if (orderContext.items.length === 0) {
    throw new Error("订单没有可售后的商品行");
  }
  const description = [form.reason.trim(), form.description.trim()]
    .filter((part) => part !== "")
    .join("\n");
  const requestBody: Record<string, unknown> = {
    afterSalesType: form.requestType,
    currencyCode: "CNY",
    description: description || undefined,
    evidenceSnapshot:
      form.evidenceFiles.length > 0
        ? form.evidenceFiles.map((file) => ({ fileName: file.name, fileSize: file.size }))
        : undefined,
    items: orderContext.items.map((item) => ({
      orderItemId: item.orderItemId,
      refundAmount:
        (form.requestType === "refund" || form.requestType === "return") && item.priceCny !== null
          ? (item.priceCny * item.quantity).toFixed(2)
          : undefined,
      requestedQuantity: item.quantity,
    })),
    orderId: orderContext.orderId,
    reasonCode: "buyer-request",
    requestedAmount: Number(form.requestedAmountCny).toFixed(2),
  };
  await getSdkworkAfterSalesRemotePort().createAfterSalesRequest(requestBody);
}

export async function revokeMallAfterSalesRequest(rowId: string): Promise<void> {
  await getSdkworkAfterSalesRemotePort().updateAfterSalesRequest(rowId, {
    status: "CANCELLED",
  });
}
