/**
 * After-sales domain for the mini-program: request list, wire-contract
 * create, and revoke. The create body follows the commerce app-api contract
 * (`CreateAfterSalesRequest`): orderId, afterSalesType, reasonCode,
 * requestedAmount as a decimal string, currencyCode, and at least one order
 * item; amounts and per-item quantities come from the order snapshot, never
 * from user input.
 */
import { request } from "./transport";

export interface MpAfterSalesItemInput {
  orderItemId: string;
  requestedQuantity: number;
  refundAmountCny?: number | null;
}

export interface MpAfterSalesEvidenceItem {
  /** Backend-addressable `drive://spaces/.../nodes/...` reference. */
  reference: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export interface MpAfterSalesCreateInput {
  orderId: string;
  afterSalesType: string;
  reasonCode: string;
  description?: string;
  evidenceSnapshot?: MpAfterSalesEvidenceItem[];
  requestedAmountCny: number;
  items: MpAfterSalesItemInput[];
}

export interface MpAfterSalesRow {
  afterSalesNo: string;
  description: string;
  id: string;
  orderId: string;
  reasonCode: string;
  requestedAmount: string;
  /** 退货/换货审核通过后，买家可回填寄回物流。 */
  returnable: boolean;
  revokable: boolean;
  status: string;
  statusLabelKey: string;
  type: string;
  typeLabelKey: string;
}

export const AFTER_SALES_TYPES = [
  { value: "refund", labelKey: "afterSales.type.refund" },
  { value: "return", labelKey: "afterSales.type.return" },
  { value: "exchange", labelKey: "afterSales.type.exchange" },
];

export const AFTER_SALES_REASON_PRESETS = [
  { code: "not-as-described", labelKey: "afterSales.reason.notAsDescribed" },
  { code: "quality-issue", labelKey: "afterSales.reason.qualityIssue" },
  { code: "missing-item", labelKey: "afterSales.reason.missingItem" },
  { code: "shipping-issue", labelKey: "afterSales.reason.shippingIssue" },
  { code: "change-mind", labelKey: "afterSales.reason.changeMind" },
  { code: "other", labelKey: "afterSales.reason.other" },
];

export const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: "afterSales.status.pending",
  REVIEWING: "afterSales.status.reviewing",
  APPROVED: "afterSales.status.approved",
  REJECTED: "afterSales.status.rejected",
  COMPLETED: "afterSales.status.completed",
  CANCELLED: "afterSales.status.cancelled",
};

export function buildCreateAfterSalesBody(input: MpAfterSalesCreateInput): Record<string, unknown> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("订单没有可售后的商品行");
  }
  const body: Record<string, unknown> = {
    orderId: input.orderId,
    afterSalesType: input.afterSalesType,
    reasonCode: input.reasonCode,
    requestedAmount: Number(input.requestedAmountCny).toFixed(2),
    currencyCode: "CNY",
    items: input.items.map((item) => {
      const entry: Record<string, unknown> = {
        orderItemId: item.orderItemId,
        requestedQuantity: item.requestedQuantity,
      };
      if (input.afterSalesType !== "exchange" && item.refundAmountCny != null) {
        entry.refundAmount = Number(item.refundAmountCny).toFixed(2);
      }
      return entry;
    }),
  };
  if (input.description && input.description.trim() !== "") {
    body.description = input.description.trim();
  }
  if (input.evidenceSnapshot && input.evidenceSnapshot.length > 0) {
    body.evidenceSnapshot = input.evidenceSnapshot.map((item) => ({
      fileName: item.fileName,
      fileSize: item.fileSize,
      fileType: item.fileType,
      reference: item.reference,
    }));
  }
  return body;
}

export async function listRequests(page = 1, pageSize = 50): Promise<MpAfterSalesRow[]> {
  const payload = await request({
    path: "/after_sales/requests",
    query: { page, page_size: pageSize },
  });
  const rows = Array.isArray(payload.items) ? payload.items : [];
  return rows.map((item) => {
    const status = String(item.status ?? "").toUpperCase();
    const type = String(item.afterSalesType ?? item.type ?? "refund").toLowerCase();
    return {
      id: String(item.id ?? ""),
      afterSalesNo: String(item.afterSalesNo ?? item.requestNo ?? ""),
      orderId: String(item.orderId ?? ""),
      reasonCode: String(item.reasonCode ?? ""),
      description: String(item.description ?? ""),
      requestedAmount: String(item.requestedAmount ?? ""),
      typeLabelKey:
        (AFTER_SALES_TYPES.find((entry) => entry.value === type) || { labelKey: "" }).labelKey,
      type,
      status,
      statusLabelKey: STATUS_LABEL_KEYS[status] || "",
      returnable: status === "APPROVED" && (type === "return" || type === "exchange"),
      revokable: status === "PENDING" || status === "REVIEWING",
    };
  });
}

export async function createRequest(input: MpAfterSalesCreateInput): Promise<Record<string, unknown>> {
  const body = buildCreateAfterSalesBody(input);
  return request({ path: "/after_sales/requests", method: "POST", body });
}

export async function cancelRequest(requestId: string): Promise<Record<string, unknown>> {
  return request({
    path: `/after_sales/requests/${requestId}`,
    method: "PATCH",
    body: { status: "CANCELLED" },
  });
}

/** Carriers offered when the buyer ships the goods back. */
export const RETURN_CARRIERS = [
  { code: "SF", nameKey: "afterSales.carrier.sf" },
  { code: "ZTO", nameKey: "afterSales.carrier.zto" },
  { code: "YTO", nameKey: "afterSales.carrier.yto" },
  { code: "YUNDA", nameKey: "afterSales.carrier.yunda" },
  { code: "JD", nameKey: "afterSales.carrier.jd" },
  { code: "OTHER", nameKey: "afterSales.carrier.other" },
] as const;

function createIdempotencyKey(): string {
  return `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface MpReturnShipmentInput {
  carrierCode: string;
  carrierName?: string;
  requestId: string;
  trackingNo: string;
}

/** One entry of the after-sales progress timeline. */
export interface MpAfterSalesEvent {
  action: string;
  at: string;
}

/**
 * Loads the progress timeline of one after-sales request
 * (`GET /after_sales/requests/{id}/events`). PC has shown this since the process
 * screen landed; the mobile roots had no way to see refund progress.
 */
export async function listAfterSalesEvents(requestId: string): Promise<MpAfterSalesEvent[]> {
  const payload = await request({
    path: `/after_sales/requests/${requestId}/events`,
    query: { page: 1, page_size: 20 },
  });
  const rows = Array.isArray(payload.items) ? payload.items : [];
  return rows.map((item) => ({
    action: String(item.eventType ?? item.action ?? item.toStatus ?? "event"),
    at: String(item.createdAt ?? ""),
  }));
}

/** Wire body for the return-shipment command (tracking number is trimmed). */
export function buildReturnShipmentBody(input: MpReturnShipmentInput): Record<string, unknown> {
  return {
    carrierCode: input.carrierCode,
    carrierName: input.carrierName,
    shipmentDirection: "buyer_return",
    trackingNo: input.trackingNo.trim(),
  };
}

/** Full request descriptor, exported so the idempotency header is testable. */
export function buildReturnShipmentRequest(
  input: MpReturnShipmentInput,
  idempotencyKey: string = createIdempotencyKey(),
): {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  method: "POST";
  path: string;
} {
  return {
    body: buildReturnShipmentBody(input),
    headers: { "Idempotency-Key": idempotencyKey },
    method: "POST",
    path: `/after_sales/requests/${input.requestId}/return_shipments`,
  };
}

/**
 * Submits the buyer's return tracking number
 * (`POST /after_sales/requests/{id}/return_shipments`), idempotent per submit.
 */
export async function createReturnShipment(input: MpReturnShipmentInput): Promise<Record<string, unknown>> {
  return request(buildReturnShipmentRequest(input));
}
