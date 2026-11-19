/**
 * After-sales domain for the mini program.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (after-sales row). The request
 * lifecycle, progress timeline and return shipment belong to the mall commerce
 * block (`runtime.commerceClient.afterSales`); this module keeps the mall-owned
 * wire bodies (`CreateAfterSalesRequest` fields are a commerce contract) and the
 * presentation constants, and owns no endpoint.
 */
import { createMpIdempotencyParams, getMallMpRuntime } from "@sdkwork/mall-mp-core";

import { readCommercePayload } from "./commerce-payload";

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

function afterSales() {
  return getMallMpRuntime().commerceClient.afterSales;
}

function readRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(record.items)) {
    return record.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(record.content)) {
    return record.content as Array<Record<string, unknown>>;
  }
  return [];
}

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
  const payload = await readCommercePayload(afterSales().requests.list({ page, pageSize }));
  return readRows(payload).map((item) => {
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
  return readCommercePayload(
    afterSales().requests.create(body as never, createMpIdempotencyParams()),
  );
}

export async function cancelRequest(requestId: string): Promise<Record<string, unknown>> {
  return readCommercePayload(afterSales().requests.update(requestId, { status: "CANCELLED" }));
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
 * (`afterSales.events`). PC has shown this since the process screen landed; the
 * mobile roots had no way to see refund progress.
 */
export async function listAfterSalesEvents(requestId: string): Promise<MpAfterSalesEvent[]> {
  const payload = await readCommercePayload(afterSales().events.list(requestId, { page: 1, pageSize: 20 }));
  return readRows(payload).map((item) => ({
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

/**
 * Submits the buyer's return tracking number
 * (`afterSales.returnShipments`), idempotent per submit.
 */
export async function createReturnShipment(input: MpReturnShipmentInput): Promise<Record<string, unknown>> {
  return readCommercePayload(
    afterSales().returnShipments.create(
      input.requestId,
      buildReturnShipmentBody(input) as never,
      createMpIdempotencyParams(),
    ),
  );
}
