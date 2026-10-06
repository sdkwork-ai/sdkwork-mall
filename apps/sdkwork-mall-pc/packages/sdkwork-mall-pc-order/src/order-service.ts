import {
  createSdkworkIdempotencyParams,
  getSdkworkOrderService,
  hasSdkworkOrderSession,
  requireSdkworkOrderSession,
  toNullableSdkworkOrderNumber,
  toSdkworkOrderNumber,
  toSdkworkOrderOptionalString,
  unwrapSdkworkOrderResponse,
  readSdkworkMediaResource,
  type SdkworkOrderAppService,
  type SdkworkMediaResource,
} from "@sdkwork/order-service";
import {
  createSdkworkOrderMessages,
  type SdkworkOrderMessages,
  type SdkworkOrderMessagesOverrides,
} from "./order-copy";

export type SdkworkOrderStatus =
  | "cancelled"
  | "completed"
  | "expired"
  | "paid"
  | "pending-payment"
  | "pending-receipt"
  | "pending-shipment"
  | "refunded"
  | "refunding"
  | "unknown";

export interface SdkworkOrderSummary {
  createdAt: string;
  discountAmountCny: number | null;
  expireTime?: string;
  id: string;
  orderSn?: string;
  paidAmountCny: number | null;
  payTime?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  productImage?: SdkworkMediaResource;
  quantity: number;
  remark?: string;
  status: SdkworkOrderStatus;
  statusLabel: string;
  subject: string;
  totalAmountCny: number | null;
}

export interface SdkworkOrderStatistics {
  completed: number;
  pendingPayment: number;
  pendingReceipt: number;
  pendingShipment: number;
  totalAmountCny: number | null;
  totalOrders: number;
}

export interface SdkworkOrderItem {
  id: string;
  image?: SdkworkMediaResource;
  name: string;
  quantity: number;
  totalAmountCny: number | null;
  unitPriceCny: number | null;
}

export interface SdkworkOrderTimelineEvent {
  label: string;
  occurredAt?: string;
  tone: "danger" | "default" | "success" | "warning";
}

export interface SdkworkOrderDetail {
  createdAt: string;
  id: string;
  items: SdkworkOrderItem[];
  orderSn?: string;
  outTradeNo?: string;
  paidAmountCny: number | null;
  payTime?: string;
  paymentMethod?: string;
  productImage?: SdkworkMediaResource;
  quantity: number;
  remark?: string;
  status: SdkworkOrderStatus;
  statusLabel: string;
  subject: string;
  timeline: SdkworkOrderTimelineEvent[];
  totalAmountCny: number | null;
  transactionId?: string;
}

export interface SdkworkOrderDashboardData {
  orders: SdkworkOrderSummary[];
  statistics: SdkworkOrderStatistics;
}

export interface SdkworkOrderPaymentInput {
  orderId: string;
  paymentMethod?: string;
  paymentPassword?: string;
}

export interface SdkworkOrderPaymentResult {
  amountCny: number | null;
  orderId: string;
  outTradeNo?: string;
  paymentId?: string;
  paymentMethod?: string;
  paymentParams: Record<string, unknown>;
}

export interface SdkworkOrderCancelInput {
  cancelReason?: string;
  cancelType?: string;
  orderId: string;
}

export interface SdkworkOrderCancelResult {
  cancelled: true;
  orderId: string;
}

export interface SdkworkOrderConfirmReceiptInput {
  orderId: string;
}

export interface SdkworkOrderConfirmReceiptResult {
  confirmed: true;
  orderId: string;
}

export interface SdkworkShipmentTrackingEvent {
  description: string;
  occurredAt?: string;
  status?: string;
}

export interface SdkworkShipmentPackage {
  id: string;
  name?: string;
}

export interface SdkworkShipmentLogistics {
  carrier?: string;
  packages: SdkworkShipmentPackage[];
  shipmentId: string;
  shipmentNo?: string;
  status?: string;
  statusLabel?: string;
  trackingEvents: SdkworkShipmentTrackingEvent[];
}

export interface SdkworkOrderLogistics {
  orderId?: string;
  shipments: SdkworkShipmentLogistics[];
}

export interface SdkworkOrderLogisticsInput {
  orderId?: string;
  shipmentId?: string;
}

export interface CreateSdkworkOrderServiceOptions {
  orderService?: SdkworkOrderAppService;
  locale?: string | null;
  messages?: SdkworkOrderMessagesOverrides;
}

export interface SdkworkOrderService {
  cancelOrder(input: SdkworkOrderCancelInput): Promise<SdkworkOrderCancelResult>;
  confirmReceipt(input: SdkworkOrderConfirmReceiptInput): Promise<SdkworkOrderConfirmReceiptResult>;
  getDashboard(): Promise<SdkworkOrderDashboardData>;
  getEmptyDashboard(): SdkworkOrderDashboardData;
  getOrderDetail(orderId: string): Promise<SdkworkOrderDetail>;
  getOrderLogistics(input: SdkworkOrderLogisticsInput): Promise<SdkworkOrderLogistics>;
  payOrder(input: SdkworkOrderPaymentInput): Promise<SdkworkOrderPaymentResult>;
}

interface RemoteOrder {
  createdAt?: string;
  discountAmount?: number | string;
  expireTime?: string;
  orderId?: string;
  orderSn?: string;
  paidAmount?: number | string;
  payTime?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  productImage?: unknown;
  quantity?: number | string;
  remark?: string;
  status?: string;
  statusName?: string;
  subject?: string;
  totalAmount?: number | string;
}

interface RemoteOrderItem {
  id?: string;
  productImage?: unknown;
  productName?: string;
  /** Dev-double / legacy payloads nest the title under spu/sku; optional so the
   * canonical wire (`productName`) stays authoritative. */
  sku?: unknown;
  spu?: unknown;
  price?: number | string;
  priceCny?: number | string;
  quantity?: number | string;
  title?: string;
  totalAmount?: number | string;
  unitPrice?: number | string;
}

interface RemoteOrderDetail extends RemoteOrder {
  items?: RemoteOrderItem[];
  outTradeNo?: string;
  transactionId?: string;
}

interface RemoteOrderStatistics {
  completed?: number | string;
  pendingPayment?: number | string;
  pendingReceipt?: number | string;
  pendingShipment?: number | string;
  totalAmount?: number | string;
  totalOrders?: number | string;
}

interface RemoteOrderStatus {
  status?: string;
  statusName?: string;
}

interface RemoteOrderPaymentSuccess {
  paid?: boolean;
  status?: string;
  statusName?: string;
}

interface RemotePaymentParams {
  amount?: number | string;
  orderId?: string;
  outTradeNo?: string;
  paymentId?: string;
  paymentMethod?: string;
  paymentParams?: Record<string, unknown>;
}

type SdkworkOrderCopyContext = Pick<SdkworkOrderMessages, "status" | "timeline">;
type SdkworkOrderServiceCopy = SdkworkOrderMessages["service"];

function mapOrderStatus(status: string | undefined): SdkworkOrderStatus {
  const normalized = (status || "").trim().toUpperCase();
  if (normalized === "PENDING_PAYMENT" || normalized === "UNPAID" || normalized === "WAIT_PAY") {
    return "pending-payment";
  }

  if (normalized === "PENDING_SHIPMENT" || normalized === "WAIT_SHIP" || normalized === "WAIT_SEND") {
    return "pending-shipment";
  }

  if (normalized === "PENDING_RECEIPT" || normalized === "WAIT_RECEIVE" || normalized === "SHIPPED") {
    return "pending-receipt";
  }

  if (normalized === "PAID") {
    return "paid";
  }

  if (normalized === "COMPLETED" || normalized === "FINISHED") {
    return "completed";
  }

  if (normalized === "CANCELLED" || normalized === "CANCELED" || normalized === "CLOSED") {
    return "cancelled";
  }

  if (normalized === "EXPIRED" || normalized === "TIMEOUT") {
    return "expired";
  }

  if (normalized === "REFUNDING") {
    return "refunding";
  }

  if (normalized === "REFUNDED") {
    return "refunded";
  }

  return "unknown";
}

function formatStatusLabel(
  status: SdkworkOrderStatus,
  messages: SdkworkOrderCopyContext,
): string {
  if (status === "cancelled") {
    return messages.status.cancelled;
  }

  if (status === "completed") {
    return messages.status.completed;
  }

  if (status === "expired") {
    return messages.status.expired;
  }

  if (status === "paid") {
    return messages.status.paid;
  }

  if (status === "pending-payment") {
    return messages.status.pendingPayment;
  }

  if (status === "pending-shipment") {
    return messages.status.pendingShipment;
  }

  if (status === "pending-receipt") {
    return messages.status.pendingReceipt;
  }

  if (status === "refunded") {
    return messages.status.refunded;
  }

  if (status === "refunding") {
    return messages.status.refunding;
  }

  return messages.status.unknown;
}

function createEmptyDashboard(): SdkworkOrderDashboardData {
  return {
    orders: [],
    statistics: {
      completed: 0,
      pendingPayment: 0,
      pendingReceipt: 0,
      pendingShipment: 0,
      totalAmountCny: 0,
      totalOrders: 0,
    },
  };
}

function mapOrderSummary(
  order: RemoteOrder,
  messages: SdkworkOrderCopyContext,
  copy: SdkworkOrderServiceCopy,
): SdkworkOrderSummary {
  const status = mapOrderStatus(order.status);

  return {
    createdAt: toSdkworkOrderOptionalString(order.createdAt) || new Date(0).toISOString(),
    discountAmountCny: toNullableSdkworkOrderNumber(order.discountAmount),
    expireTime: toSdkworkOrderOptionalString(order.expireTime),
    id: toSdkworkOrderOptionalString(order.orderId) || "unknown-order",
    orderSn: toSdkworkOrderOptionalString(order.orderSn),
    paidAmountCny: toNullableSdkworkOrderNumber(order.paidAmount),
    payTime: toSdkworkOrderOptionalString(order.payTime),
    paymentMethod: toSdkworkOrderOptionalString(order.paymentMethod),
    paymentProvider: toSdkworkOrderOptionalString(order.paymentProvider),
    productImage: readSdkworkMediaResource(order.productImage),
    quantity: toSdkworkOrderNumber(order.quantity, 1),
    remark: toSdkworkOrderOptionalString(order.remark),
    status,
    statusLabel: toSdkworkOrderOptionalString(order.statusName) || formatStatusLabel(status, messages),
    subject: toSdkworkOrderOptionalString(order.subject) || copy.summaryFallbackSubject,
    totalAmountCny: toNullableSdkworkOrderNumber(order.totalAmount),
  };
}

function mapStatistics(statistics: RemoteOrderStatistics | null | undefined): SdkworkOrderStatistics {
  return {
    completed: toSdkworkOrderNumber(statistics?.completed),
    pendingPayment: toSdkworkOrderNumber(statistics?.pendingPayment),
    pendingReceipt: toSdkworkOrderNumber(statistics?.pendingReceipt),
    pendingShipment: toSdkworkOrderNumber(statistics?.pendingShipment),
    totalAmountCny: toNullableSdkworkOrderNumber(statistics?.totalAmount),
    totalOrders: toSdkworkOrderNumber(statistics?.totalOrders),
  };
}

function mapItems(items: RemoteOrderItem[] | undefined, copy: SdkworkOrderServiceCopy): SdkworkOrderItem[] {
  return (items ?? []).map((item, index) => {
    const spu = (isRemoteRecord(item.spu) ?? {}) as Record<string, unknown>;
    const sku = (isRemoteRecord(item.sku) ?? {}) as Record<string, unknown>;
    const unitPriceCny = toNullableSdkworkOrderNumber(item.unitPrice)
      ?? toNullableSdkworkOrderNumber(item.priceCny)
      ?? toNullableSdkworkOrderNumber(item.price);
    const quantity = toSdkworkOrderNumber(item.quantity, 1);
    return {
      id: toSdkworkOrderOptionalString(item.id) || `order-item-${index + 1}`,
      image: readSdkworkMediaResource(item.productImage)
        || readSdkworkMediaResource(spu.imageUrl),
      name: toSdkworkOrderOptionalString(item.productName)
        || toSdkworkOrderOptionalString(spu.title)
        || toSdkworkOrderOptionalString(sku.name)
        || toSdkworkOrderOptionalString(item.title)
        || copy.itemFallbackName,
      quantity,
      totalAmountCny: toNullableSdkworkOrderNumber(item.totalAmount)
        ?? (unitPriceCny != null ? unitPriceCny * quantity : null),
      unitPriceCny,
    };
  });
}

function isRemoteRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function createTimeline(
  detail: RemoteOrderDetail,
  status: RemoteOrderStatus | null,
  paymentSuccess: RemoteOrderPaymentSuccess | null,
  messages: SdkworkOrderCopyContext,
): SdkworkOrderTimelineEvent[] {
  const resolvedStatus = mapOrderStatus(status?.status || detail.status);
  const events: SdkworkOrderTimelineEvent[] = [
    {
      label: messages.timeline.created,
      occurredAt: toSdkworkOrderOptionalString(detail.createdAt),
      tone: "default",
    },
  ];

  const paid = Boolean(paymentSuccess?.paid || resolvedStatus === "paid" || resolvedStatus === "completed");
  if (paid) {
    events.push({
      label: messages.timeline.paid,
      occurredAt: toSdkworkOrderOptionalString(detail.payTime),
      tone: "success",
    });
  }

  const statusLabel = toSdkworkOrderOptionalString(status?.statusName)
    || toSdkworkOrderOptionalString(paymentSuccess?.statusName)
    || toSdkworkOrderOptionalString(detail.statusName)
    || formatStatusLabel(resolvedStatus, messages);
  events.push({
    label: statusLabel,
    tone:
      resolvedStatus === "cancelled" || resolvedStatus === "expired"
        ? "danger"
        : resolvedStatus === "pending-payment"
          ? "warning"
          : "default",
  });

  return events;
}

function mapDetail(
  detail: RemoteOrderDetail | null | undefined,
  status: RemoteOrderStatus | null,
  paymentSuccess: RemoteOrderPaymentSuccess | null,
  messages: SdkworkOrderCopyContext,
  copy: SdkworkOrderServiceCopy,
): SdkworkOrderDetail {
  const summary = mapOrderSummary(detail ?? {}, messages, copy);
  const resolvedStatus = mapOrderStatus(status?.status || detail?.status);

  return {
    createdAt: summary.createdAt,
    id: summary.id,
    items: mapItems(detail?.items, copy),
    orderSn: summary.orderSn,
    outTradeNo: toSdkworkOrderOptionalString(detail?.outTradeNo),
    paidAmountCny: summary.paidAmountCny,
    payTime: summary.payTime,
    paymentMethod: summary.paymentMethod,
    productImage: summary.productImage,
    quantity: summary.quantity,
    remark: summary.remark,
    status: resolvedStatus,
    statusLabel:
      toSdkworkOrderOptionalString(status?.statusName)
      || toSdkworkOrderOptionalString(detail?.statusName)
      || formatStatusLabel(resolvedStatus, messages),
    subject: summary.subject,
    timeline: createTimeline(detail ?? {}, status, paymentSuccess, messages),
    totalAmountCny: summary.totalAmountCny,
    transactionId: toSdkworkOrderOptionalString(detail?.transactionId),
  };
}

function mapPaymentResult(result: RemotePaymentParams | null | undefined): SdkworkOrderPaymentResult {
  return {
    amountCny: toNullableSdkworkOrderNumber(result?.amount),
    orderId: toSdkworkOrderOptionalString(result?.orderId) || "",
    outTradeNo: toSdkworkOrderOptionalString(result?.outTradeNo),
    paymentId: toSdkworkOrderOptionalString(result?.paymentId),
    paymentMethod: toSdkworkOrderOptionalString(result?.paymentMethod),
    paymentParams: (result?.paymentParams ?? {}) as Record<string, unknown>,
  };
}

function pickRemoteString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = toSdkworkOrderOptionalString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function extractRemoteShipmentIds(detail: Record<string, unknown> | null): string[] {
  const ids: string[] = [];
  const directIds = detail?.shipmentIds;
  if (Array.isArray(directIds)) {
    for (const entry of directIds) {
      const id = toSdkworkOrderOptionalString(entry);
      if (id) {
        ids.push(id);
      }
    }
  }
  const shipments = detail?.shipments;
  if (Array.isArray(shipments)) {
    for (const entry of shipments) {
      if (!isPlainRecord(entry)) {
        continue;
      }
      const id = toSdkworkOrderOptionalString(entry.shipmentId ?? entry.id);
      if (id) {
        ids.push(id);
      }
    }
  }
  return [...new Set(ids)];
}

function mapTrackingEvents(payload: unknown, fallbackMessage: string): SdkworkShipmentTrackingEvent[] {
  const page = unwrapSdkworkOrderResponse<{ content?: unknown[]; items?: unknown[] } | unknown[] | null>(
    payload,
    fallbackMessage,
  );
  const rows = Array.isArray(page)
    ? page
    : page?.content ?? page?.items ?? [];
  return rows
    .filter(isPlainRecord)
    .map((row) => ({
      description: pickRemoteString(row, ["description", "content", "detail", "message", "info"])
        || fallbackMessage,
      occurredAt: pickRemoteString(row, ["occurredAt", "eventTime", "createdAt", "time"]),
      status: pickRemoteString(row, ["statusName", "status", "eventType"]),
    }))
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function mapShipmentLogistics(
  shipmentId: string,
  shipment: Record<string, unknown> | null,
  packagesPayload: unknown,
  trackingPayload: unknown,
  copy: SdkworkOrderServiceCopy,
): SdkworkShipmentLogistics {
  const packagesPage = unwrapSdkworkOrderResponse<{ content?: unknown[]; items?: unknown[] } | unknown[] | null>(
    packagesPayload,
    copy.requestFailed,
  );
  const packageRows = Array.isArray(packagesPage)
    ? packagesPage
    : packagesPage?.content ?? packagesPage?.items ?? [];

  return {
    carrier: pickRemoteString(shipment ?? {}, ["carrierName", "carrier", "logisticsCompany", "expressCompany"]),
    packages: packageRows.filter(isPlainRecord).map((row, index) => ({
      id: pickRemoteString(row, ["packageId", "id"]) || `package-${index + 1}`,
      name: pickRemoteString(row, ["packageName", "name", "title"]),
    })),
    shipmentId,
    shipmentNo: pickRemoteString(shipment ?? {}, ["shipmentNo", "shipmentNumber", "trackingNumber", "logisticsNo"]),
    status: pickRemoteString(shipment ?? {}, ["status"]),
    statusLabel: pickRemoteString(shipment ?? {}, ["statusName", "statusLabel"]),
    trackingEvents: mapTrackingEvents(trackingPayload, copy.shipmentMissing),
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createSdkworkOrderService(
  options: CreateSdkworkOrderServiceOptions = {},
): SdkworkOrderService {
  const messages = createSdkworkOrderMessages(options.locale, options.messages);
  const copy = messages.service;
  const getOrderService = () => options.orderService ?? getSdkworkOrderService();

  return {
    async cancelOrder(input) {
      requireSdkworkOrderSession(copy.signInRequired);
      await unwrapSdkworkOrderResponse<void>(
        await getOrderService().orders.cancellations.create(
          input.orderId,
          createSdkworkIdempotencyParams(),
          {
            cancelReason: toSdkworkOrderOptionalString(input.cancelReason),
            cancelType: toSdkworkOrderOptionalString(input.cancelType),
          },
        ),
        copy.cancelFailed,
      );

      return {
        cancelled: true,
        orderId: input.orderId,
      };
    },

    async confirmReceipt(input) {
      requireSdkworkOrderSession(copy.signInRequired);
      await unwrapSdkworkOrderResponse<void>(
        await getOrderService().orders.receipts.create(
          input.orderId,
          createSdkworkIdempotencyParams(),
        ),
        copy.confirmReceiptFailed,
      );

      return {
        confirmed: true,
        orderId: input.orderId,
      };
    },

    async getDashboard() {
      if (!hasSdkworkOrderSession()) {
        return createEmptyDashboard();
      }

      const [orderPagePayload, statisticsPayload] = await Promise.all([
        getOrderService().orders.list({
            page: 1,
            pageSize: 20,
        }),
        getOrderService().orders.statistics.retrieve(),
      ]);
      const orderPage = unwrapSdkworkOrderResponse<{ content?: RemoteOrder[] }>(
        orderPagePayload,
        copy.requestFailed,
      );
      const statistics = unwrapSdkworkOrderResponse<RemoteOrderStatistics | null>(
        statisticsPayload,
        copy.requestFailed,
      );

      return {
        orders: (orderPage.content ?? [])
          .map((order) => mapOrderSummary(order, messages, copy))
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
        statistics: mapStatistics(statistics),
      };
    },

    getEmptyDashboard() {
      return createEmptyDashboard();
    },

    async getOrderDetail(orderId) {
      requireSdkworkOrderSession(copy.signInRequired);
      const [detailPayload, statusPayload, paymentSuccessPayload] = await Promise.all([
        getOrderService().orders.retrieve(orderId),
        getOrderService().orders.status.retrieve(orderId),
        getOrderService().orders.paymentSuccess.retrieve(orderId),
      ]);
      const detail = unwrapSdkworkOrderResponse<RemoteOrderDetail | null>(detailPayload, copy.requestFailed);
      const status = unwrapSdkworkOrderResponse<RemoteOrderStatus | null>(statusPayload, copy.requestFailed);
      const paymentSuccess = unwrapSdkworkOrderResponse<RemoteOrderPaymentSuccess | null>(
        paymentSuccessPayload,
        copy.requestFailed,
      );

      return mapDetail(detail, status, paymentSuccess, messages, copy);
    },

    async getOrderLogistics(input) {
      requireSdkworkOrderSession(copy.signInRequired);
      let shipmentIds = input.shipmentId ? [input.shipmentId] : [];
      let orderId = input.orderId;

      if (shipmentIds.length === 0) {
        if (!orderId) {
          throw new Error(copy.shipmentMissing);
        }
        const detailPayload = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
          await getOrderService().orders.retrieve(orderId),
          copy.requestFailed,
        );
        shipmentIds = extractRemoteShipmentIds(detailPayload).slice(0, 5);
      }

      if (shipmentIds.length === 0) {
        return { orderId, shipments: [] };
      }

      const shipments = await Promise.all(
        shipmentIds.map(async (shipmentId) => {
          const [shipmentPayload, packagesPayload, trackingPayload] = await Promise.all([
            getOrderService().shipments.retrieve(shipmentId),
            getOrderService().shipments.packages.list(shipmentId, { page: 1, pageSize: 20 }),
            getOrderService().shipments.trackingEvents.list(shipmentId, { page: 1, pageSize: 50 }),
          ]);
          const shipment = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
            shipmentPayload,
            copy.requestFailed,
          );
          return mapShipmentLogistics(shipmentId, shipment, packagesPayload, trackingPayload, copy);
        }),
      );

      return { orderId, shipments };
    },

    async payOrder(input) {
      requireSdkworkOrderSession(copy.signInRequired);
      const body = {
        paymentMethod: toSdkworkOrderOptionalString(input.paymentMethod),
        paymentPassword: toSdkworkOrderOptionalString(input.paymentPassword),
      };
      const result = unwrapSdkworkOrderResponse<RemotePaymentParams>(
        await getOrderService().orders.payments.create(
          input.orderId,
          body,
          createSdkworkIdempotencyParams(),
        ),
        copy.payFailed,
      );

      return mapPaymentResult(result);
    },
  };
}

export const sdkworkOrderService = createSdkworkOrderService();
