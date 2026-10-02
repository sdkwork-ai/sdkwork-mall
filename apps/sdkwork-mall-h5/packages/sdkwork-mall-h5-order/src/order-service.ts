import {
  createSdkworkIdempotencyParams,
  getSdkworkOrderService,
  hasSdkworkOrderSession,
  requireSdkworkOrderSession,
  toNullableSdkworkOrderNumber,
  toSdkworkOrderNumber,
  toSdkworkOrderOptionalString,
  unwrapSdkworkOrderResponse,
} from "@sdkwork/order-service";

export type MallH5OrderStatus =
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

export interface MallH5OrderSummary {
  createdAt: string;
  id: string;
  paidAmountCny: number | null;
  status: MallH5OrderStatus;
  subject: string;
  totalAmountCny: number | null;
}

export interface MallH5OrderItemLine {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  quantity: number;
  skuName?: string;
  spuId?: string;
  title: string;
}

export interface MallH5OrderDetail {
  createdAt: string;
  id: string;
  items: MallH5OrderItemLine[];
  paidAmountCny: number | null;
  paymentMethod?: string;
  shipmentIds: string[];
  status: MallH5OrderStatus;
  subject: string;
  totalAmountCny: number | null;
}

export interface MallH5OrderStatistics {
  completed: number;
  pendingPayment: number;
  pendingReceipt: number;
  pendingShipment: number;
  totalOrders: number;
}

export interface MallH5OrderDashboard {
  orders: MallH5OrderSummary[];
  statistics: MallH5OrderStatistics;
}

export interface MallH5ShipmentTrackingEvent {
  description: string;
  occurredAt?: string;
  status?: string;
}

export interface MallH5ShipmentLogistics {
  carrier?: string;
  packages: Array<{ id: string; name?: string }>;
  shipmentId: string;
  shipmentNo?: string;
  statusLabel?: string;
  trackingEvents: MallH5ShipmentTrackingEvent[];
}

interface RemoteOrder {
  createdAt?: string;
  orderId?: string;
  paidAmount?: number | string;
  status?: string;
  subject?: string;
  totalAmount?: number | string;
}

interface RemoteOrderItem {
  id?: string;
  imageUrl?: string;
  priceCny?: number | string;
  quantity?: number | string;
  sku?: { name?: string; title?: string };
  spu?: { id?: string; imageUrl?: string; title?: string };
  spuId?: string;
  title?: string;
}

interface RemoteOrderStatistics {
  completed?: number | string;
  pendingPayment?: number | string;
  pendingReceipt?: number | string;
  pendingShipment?: number | string;
  totalOrders?: number | string;
}

function mapOrderStatus(status: string | undefined): MallH5OrderStatus {
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

function mapSummary(order: RemoteOrder): MallH5OrderSummary {
  return {
    createdAt: toSdkworkOrderOptionalString(order.createdAt) || new Date(0).toISOString(),
    id: toSdkworkOrderOptionalString(order.orderId) || "unknown-order",
    paidAmountCny: toNullableSdkworkOrderNumber(order.paidAmount),
    status: mapOrderStatus(order.status),
    subject: toSdkworkOrderOptionalString(order.subject) || "订单",
    totalAmountCny: toNullableSdkworkOrderNumber(order.totalAmount),
  };
}

function mapItemLine(item: RemoteOrderItem, index: number): MallH5OrderItemLine {
  const spu = (item.spu ?? {}) as NonNullable<RemoteOrderItem["spu"]>;
  const image = item.imageUrl ?? spu.imageUrl;
  return {
    id: toSdkworkOrderOptionalString(item.id) || `item-${index + 1}`,
    imageUrl: image ? String(image) : undefined,
    priceCny: toNullableSdkworkOrderNumber(item.priceCny),
    quantity: toSdkworkOrderNumber(item.quantity) ?? 1,
    skuName: toSdkworkOrderOptionalString(item.sku?.title ?? item.sku?.name),
    spuId: toSdkworkOrderOptionalString(item.spuId ?? spu.id),
    title: toSdkworkOrderOptionalString(spu.title ?? item.title) || "商品",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = toSdkworkOrderOptionalString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

/** Server-side status vocabulary expected by the order app-api. */
export function toRemoteOrderStatusFilter(
  filter: "all" | MallH5OrderStatus,
): string | undefined {
  const mapping: Partial<Record<MallH5OrderStatus, string>> = {
    cancelled: "CANCELLED",
    completed: "COMPLETED",
    expired: "EXPIRED",
    "pending-payment": "PENDING_PAYMENT",
    "pending-receipt": "PENDING_RECEIPT",
    "pending-shipment": "PENDING_SHIPMENT",
    refunded: "REFUNDED",
    refunding: "REFUNDING",
  };
  return filter === "all" ? undefined : mapping[filter];
}

export async function loadMallH5OrderDashboard(
  page = 1,
  statusFilter: "all" | MallH5OrderStatus = "all",
): Promise<MallH5OrderDashboard> {
  if (!hasSdkworkOrderSession()) {
    return {
      orders: [],
      statistics: {
        completed: 0,
        pendingPayment: 0,
        pendingReceipt: 0,
        pendingShipment: 0,
        totalOrders: 0,
      },
    };
  }
  const [orderPagePayload, statisticsPayload] = await Promise.all([
    getSdkworkOrderService().orders.list({
      page,
      pageSize: 20,
      status: toRemoteOrderStatusFilter(statusFilter),
    }),
    getSdkworkOrderService().orders.statistics.retrieve(),
  ]);
  const orderPage = unwrapSdkworkOrderResponse<{ content?: RemoteOrder[] }>(orderPagePayload, "订单加载失败");
  const statistics = unwrapSdkworkOrderResponse<RemoteOrderStatistics | null>(statisticsPayload, "订单统计加载失败");
  return {
    orders: (orderPage.content ?? [])
      .map(mapSummary)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    statistics: {
      completed: toSdkworkOrderNumber(statistics?.completed),
      pendingPayment: toSdkworkOrderNumber(statistics?.pendingPayment),
      pendingReceipt: toSdkworkOrderNumber(statistics?.pendingReceipt),
      pendingShipment: toSdkworkOrderNumber(statistics?.pendingShipment),
      totalOrders: toSdkworkOrderNumber(statistics?.totalOrders),
    },
  };
}

export async function cancelMallH5Order(input: { orderId: string }): Promise<void> {
  requireSdkworkOrderSession("请先登录后管理订单。");
  await unwrapSdkworkOrderResponse<void>(
    await getSdkworkOrderService().orders.cancellations.create(
      input.orderId,
      createSdkworkIdempotencyParams(),
      {},
    ),
    "取消订单失败",
  );
}

export async function loadMallH5OrderDetail(orderId: string): Promise<MallH5OrderDetail> {
  requireSdkworkOrderSession("请先登录后查看订单。");
  const payload = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
    await getSdkworkOrderService().orders.retrieve(orderId),
    "订单加载失败",
  );
  if (!payload) {
    throw new Error("订单不存在或已被删除");
  }
  const items = Array.isArray(payload.items) ? (payload.items as RemoteOrderItem[]) : [];
  return {
    createdAt: toSdkworkOrderOptionalString(payload.createdAt) || new Date(0).toISOString(),
    id: toSdkworkOrderOptionalString(payload.orderId) || orderId,
    items: items.map(mapItemLine),
    paidAmountCny: toNullableSdkworkOrderNumber(payload.paidAmount),
    paymentMethod: toSdkworkOrderOptionalString(payload.paymentMethod),
    shipmentIds: extractShipmentIds(payload),
    status: mapOrderStatus(toSdkworkOrderOptionalString(payload.status)),
    subject: toSdkworkOrderOptionalString(payload.subject) || "订单",
    totalAmountCny: toNullableSdkworkOrderNumber(payload.totalAmount),
  };
}

export async function payMallH5Order(input: {
  orderId: string;
  paymentMethod: string;
}): Promise<{ paymentId?: string }> {
  requireSdkworkOrderSession("请先登录后管理订单。");
  const response = await getSdkworkOrderService().orders.payments.create(
    input.orderId,
    { paymentMethod: input.paymentMethod },
    createSdkworkIdempotencyParams(),
  );
  const payload = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
    response,
    "发起支付失败",
  );
  const paymentId = payload
    ? toSdkworkOrderOptionalString(payload.paymentId ?? payload.id)
    : undefined;
  return { paymentId };
}

export async function confirmMallH5OrderReceipt(input: { orderId: string }): Promise<void> {
  requireSdkworkOrderSession("请先登录后管理订单。");
  await unwrapSdkworkOrderResponse<void>(
    await getSdkworkOrderService().orders.receipts.create(
      input.orderId,
      createSdkworkIdempotencyParams(),
    ),
    "确认收货失败",
  );
}

function extractShipmentIds(detail: Record<string, unknown> | null): string[] {
  const ids: string[] = [];
  if (Array.isArray(detail?.shipmentIds)) {
    for (const entry of detail.shipmentIds) {
      const id = toSdkworkOrderOptionalString(entry);
      if (id) {
        ids.push(id);
      }
    }
  }
  if (Array.isArray(detail?.shipments)) {
    for (const entry of detail.shipments) {
      if (isRecord(entry)) {
        const id = toSdkworkOrderOptionalString(entry.shipmentId ?? entry.id);
        if (id) {
          ids.push(id);
        }
      }
    }
  }
  return [...new Set(ids)];
}

export async function loadMallH5OrderLogistics(input: {
  orderId?: string;
  shipmentId?: string;
}): Promise<{ orderId?: string; shipments: MallH5ShipmentLogistics[] }> {
  requireSdkworkOrderSession("请先登录后查看物流。");
  const orderService = getSdkworkOrderService();
  let shipmentIds = input.shipmentId ? [input.shipmentId] : [];
  let orderId = input.orderId;

  if (shipmentIds.length === 0) {
    if (!orderId) {
      throw new Error("缺少订单参数");
    }
    const detailPayload = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(
      await orderService.orders.retrieve(orderId),
      "订单加载失败",
    );
    shipmentIds = extractShipmentIds(detailPayload).slice(0, 5);
  }

  if (shipmentIds.length === 0) {
    return { orderId, shipments: [] };
  }

  const shipments = await Promise.all(
    shipmentIds.map(async (shipmentId) => {
      const [shipmentPayload, packagesPayload, trackingPayload] = await Promise.all([
        orderService.shipments.retrieve(shipmentId),
        orderService.shipments.packages.list(shipmentId, { page: 1, pageSize: 20 }),
        orderService.shipments.trackingEvents.list(shipmentId, { page: 1, pageSize: 50 }),
      ]);
      const shipment = unwrapSdkworkOrderResponse<Record<string, unknown> | null>(shipmentPayload, "物流加载失败");
      const packagePage = unwrapSdkworkOrderResponse<{ content?: unknown[]; items?: unknown[] } | unknown[] | null>(
        packagesPayload,
        "包裹加载失败",
      );
      const trackingPage = unwrapSdkworkOrderResponse<{ content?: unknown[]; items?: unknown[] } | unknown[] | null>(
        trackingPayload,
        "轨迹加载失败",
      );
      const packageRows = Array.isArray(packagePage) ? packagePage : packagePage?.content ?? packagePage?.items ?? [];
      const trackingRows = Array.isArray(trackingPage) ? trackingPage : trackingPage?.content ?? trackingPage?.items ?? [];
      return {
        carrier: shipment ? pickString(shipment, ["carrierName", "carrier", "logisticsCompany"]) : undefined,
        packages: packageRows.filter(isRecord).map((row, index) => ({
          id: pickString(row, ["packageId", "id"]) || `package-${index + 1}`,
          name: pickString(row, ["packageName", "name", "title"]),
        })),
        shipmentId,
        shipmentNo: shipment ? pickString(shipment, ["shipmentNo", "shipmentNumber", "trackingNumber", "logisticsNo"]) : undefined,
        statusLabel: shipment ? pickString(shipment, ["statusName", "statusLabel"]) : undefined,
        trackingEvents: trackingRows
          .filter(isRecord)
          .map((row) => ({
            description: pickString(row, ["description", "content", "detail", "message"]) || "物流更新",
            occurredAt: pickString(row, ["occurredAt", "eventTime", "createdAt", "time"]),
            status: pickString(row, ["statusName", "status", "eventType"]),
          }))
          .sort((left, right) => {
            const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
            const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
            return rightTime - leftTime;
          }),
      };
    }),
  );

  return { orderId, shipments };
}
