/**
 * Buyer order surfaces for the SDKWork Mall mini program.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (order row) and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. Orders belong to the order
 * block: this module projects the generated order app SDK
 * (`@sdkwork/mall-mp-core` `runtime.orderClient`) onto mall view models and owns
 * no wire path of its own.
 *
 * Mapping:
 * - list / statistics / detail / payment-success → `orders.*`
 * - pay → `orders.payments.create` (idempotent)
 * - cancel → `orders.cancellations.create` (idempotent)
 * - confirm receipt → `orders.receipts.create` (idempotent)
 * - logistics → `shipments.retrieve` + `packages.list` + `trackingEvents.list`
 */
import { createMpIdempotencyParams, getMallMpRuntime } from "@sdkwork/mall-mp-core";

import { readPageInfo } from "./page-info";

export interface MpOrderSummary {
  createdAt: string;
  id: string;
  paidAmountCny: number | null;
  /** Distributor bound to the buyer at order creation (empty when none). */
  partnerName: string;
  partnerLevelNo: string;
  status: string;
  subject: string;
  totalAmountCny: number | null;
}

export interface MpOrderDetail {
  createdAt: string;
  id: string;
  items: Array<{ id: string; imageUrl: string; priceCny: number | null; quantity: number; skuName: string; spuId: string; title: string }>;
  paidAmountCny: number | null;
  paymentMethod: string;
  /** Distributor bound to the buyer at order creation (empty when none). */
  partnerName: string;
  partnerLevelNo: string;
  shipmentIds: string[];
  status: string;
  subject: string;
  totalAmountCny: number | null;
}

export interface MpOrderStatistics {
  completed: number;
  pendingPayment: number;
  pendingReceipt: number;
  pendingShipment: number;
  totalOrders: number;
}

const STATUS_FILTER_MAP: Record<string, string> = {
  all: "",
  // The order app-api stores and compares lowercase snake_case statuses
  // (`pending_payment`, …); sending the UI code verbatim matched no rows.
  PENDING_PAYMENT: "pending_payment",
  PENDING_SHIPMENT: "pending_shipment",
  PENDING_RECEIPT: "pending_receipt",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

function ordersClient() {
  return getMallMpRuntime().orderClient.orders;
}

function mapSummary(order: Record<string, unknown>): MpOrderSummary {
  return {
    id: String(order.orderId ?? order.id ?? ""),
    subject: String(order.subject ?? "订单"),
    // The wire status is lowercase snake_case; the view models and templates
    // compare the uppercase API codes.
    status: String(order.status ?? "").toUpperCase(),
    totalAmountCny: Number(order.totalAmount ?? order.totalAmountCny) || null,
    paidAmountCny: Number(order.paidAmount ?? order.paidAmountCny) || null,
    createdAt: String(order.createdAt ?? ""),
    partnerName: String(order.partnerName ?? ""),
    partnerLevelNo: String(order.partnerLevelNo ?? ""),
  };
}

export async function listOrders(options: { page?: number; pageSize?: number; status?: string } = {}): Promise<{
  hasMore: boolean;
  orders: MpOrderSummary[];
  total: number;
}> {
  const page = options.page ?? 1;
  const statusFilter = STATUS_FILTER_MAP[options.status || "all"] ?? options.status ?? "";
  const payload = await ordersClient().list({
    page,
    pageSize: options.pageSize ?? 20,
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const record = (payload ?? {}) as unknown as Record<string, unknown>;
  const rows: Array<Record<string, unknown>> = Array.isArray(record.items)
    ? record.items as Array<Record<string, unknown>>
    : Array.isArray(record.content)
      ? record.content as Array<Record<string, unknown>>
      : [];
  const pageInfo = readPageInfo(record, rows.length, page);
  return {
    hasMore: pageInfo.hasMore,
    orders: rows.map(mapSummary),
    total: pageInfo.totalItems,
  };
}

export async function getOrderStatistics(): Promise<MpOrderStatistics> {
  const payload = await ordersClient().statistics.retrieve();
  return {
    totalOrders: Number(payload.totalOrders) || 0,
    pendingPayment: Number(payload.pendingPayment) || 0,
    pendingShipment: Number(payload.pendingShipment) || 0,
    pendingReceipt: Number(payload.pendingReceipt) || 0,
    completed: Number(payload.completed) || 0,
  };
}

export async function getOrderDetail(orderId: string): Promise<MpOrderDetail> {
  const record = await ordersClient().retrieve(orderId);
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    id: String(record.orderId ?? record.id ?? orderId),
    subject: String(record.subject ?? "订单"),
    status: String(record.status ?? "").toUpperCase(),
    totalAmountCny: Number(record.totalAmount ?? record.totalAmountCny) || null,
    paidAmountCny: Number(record.paidAmount ?? record.paidAmountCny) || null,
    paymentMethod: String(record.paymentMethod ?? ""),
    partnerName: String(record.partnerName ?? ""),
    partnerLevelNo: String(record.partnerLevelNo ?? ""),
    createdAt: String(record.createdAt ?? ""),
    shipmentIds: Array.isArray(record.shipmentIds)
      ? record.shipmentIds.map((entry) => String(entry)).filter(Boolean)
      : [],
    items: items.map((item, index) => {
      const sku = (item.sku ?? {}) as Record<string, unknown>;
      const spu = (item.spu ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id ?? sku.id ?? `item-${index + 1}`),
        spuId: String(item.spuId ?? spu.id ?? ""),
        // The order app-api returns `productName`; `spu.title` never exists, which
        // made every line render as "商品".
        title: String(item.productName ?? spu.title ?? item.title ?? "商品"),
        skuName: String(item.skuName ?? sku.name ?? sku.title ?? ""),
        imageUrl: String(item.imageUrl ?? spu.imageUrl ?? ""),
        priceCny: Number(item.unitPrice ?? item.priceCny) || null,
        quantity: Number(item.quantity) || 1,
      };
    }),
  };
}

export async function payOrder(orderId: string, paymentMethod: string): Promise<string> {
  const payment = await ordersClient().payments.create(
    orderId,
    { paymentMethod },
    createMpIdempotencyParams(),
  );
  return String(payment.paymentId ?? payment.id ?? "");
}

export async function cancelOrder(orderId: string): Promise<Record<string, unknown>> {
  return ordersClient().cancellations.create(orderId, createMpIdempotencyParams(), {}) as unknown as
    Promise<Record<string, unknown>>;
}

export async function confirmReceipt(orderId: string): Promise<Record<string, unknown>> {
  return ordersClient().receipts.create(orderId, createMpIdempotencyParams(), {}) as unknown as
    Promise<Record<string, unknown>>;
}

export async function getPaymentSuccess(orderId: string): Promise<Record<string, unknown> | null> {
  try {
    return (await ordersClient().paymentSuccess.retrieve(orderId)) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface MpShipmentTrackingEvent {
  description: string;
  occurredAt: string;
  status: string;
}

export interface MpShipmentPackage {
  id: string;
  name: string;
}

export interface MpShipmentLogistics {
  carrier: string;
  packages: MpShipmentPackage[];
  shipmentId: string;
  shipmentNo: string;
  statusLabel: string;
  trackingEvents: MpShipmentTrackingEvent[];
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function readRows(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }
  if (Array.isArray(payload.content)) {
    return payload.content as Array<Record<string, unknown>>;
  }
  if (Array.isArray(payload.items)) {
    return payload.items as Array<Record<string, unknown>>;
  }
  return [];
}

function shipmentsClient() {
  return getMallMpRuntime().orderClient.shipments;
}

async function getShipmentLogistics(shipmentId: string): Promise<MpShipmentLogistics> {
  const [shipment, packagesPayload, trackingPayload] = await Promise.all([
    shipmentsClient().retrieve(shipmentId),
    shipmentsClient().packages.list(shipmentId, { page: 1, pageSize: 20 }),
    shipmentsClient().trackingEvents.list(shipmentId, { page: 1, pageSize: 50 }),
  ]);
  const trackingEvents = readRows(trackingPayload as unknown as Record<string, unknown>)
    .map((row) => ({
      description: pickString(row, ["description", "content", "detail", "message"]) || "物流更新",
      occurredAt: pickString(row, ["occurredAt", "eventTime", "createdAt", "time"]),
      status: pickString(row, ["statusName", "status", "eventType"]),
    }))
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });
  return {
    shipmentId,
    shipmentNo: pickString(shipment, ["shipmentNo", "shipmentNumber", "trackingNumber", "logisticsNo"]),
    carrier: pickString(shipment, ["carrierName", "carrier", "logisticsCompany"]),
    statusLabel: pickString(shipment, ["statusName", "statusLabel"]),
    packages: readRows(packagesPayload as unknown as Record<string, unknown>).map((row, index) => ({
      id: pickString(row, ["packageId", "id"]) || `package-${index + 1}`,
      name: pickString(row, ["packageName", "name", "title"]),
    })),
    trackingEvents,
  };
}

/**
 * Loads every shipment trace for an order (or one explicit shipment).
 * Mirrors the H5 `/buyer/logistics` surface: order detail supplies the
 * shipment ids, then the shipment block composes the view.
 */
export async function getOrderLogistics(input: {
  orderId?: string;
  shipmentId?: string;
}): Promise<MpShipmentLogistics[]> {
  let shipmentIds = input.shipmentId ? [input.shipmentId] : [];
  if (shipmentIds.length === 0) {
    if (!input.orderId) {
      throw new Error("缺少订单参数");
    }
    const detail = await getOrderDetail(input.orderId);
    shipmentIds = detail.shipmentIds.slice(0, 5);
  }
  if (shipmentIds.length === 0) {
    return [];
  }
  return Promise.all(shipmentIds.map((shipmentId) => getShipmentLogistics(shipmentId)));
}
