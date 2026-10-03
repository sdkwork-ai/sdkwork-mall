import { request } from "./transport";

export interface MpOrderSummary {
  createdAt: string;
  id: string;
  paidAmountCny: number | null;
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
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_SHIPMENT: "PENDING_SHIPMENT",
  PENDING_RECEIPT: "PENDING_RECEIPT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

function mapSummary(order: Record<string, unknown>): MpOrderSummary {
  return {
    id: String(order.orderId ?? order.id ?? ""),
    subject: String(order.subject ?? "订单"),
    status: String(order.status ?? ""),
    totalAmountCny: Number(order.totalAmount ?? order.totalAmountCny) || null,
    paidAmountCny: Number(order.paidAmount ?? order.paidAmountCny) || null,
    createdAt: String(order.createdAt ?? ""),
  };
}

export async function listOrders(options: { page?: number; pageSize?: number; status?: string } = {}): Promise<{ orders: MpOrderSummary[]; total: number }> {
  const statusFilter = STATUS_FILTER_MAP[options.status || "all"] ?? options.status ?? "";
  const payload = await request({
    path: "/orders",
    query: {
      page: options.page ?? 1,
      page_size: options.pageSize ?? 20,
      status: statusFilter || undefined,
    },
  });
  const rows: Array<Record<string, unknown>> = Array.isArray(payload.content)
    ? payload.content
    : Array.isArray(payload.items)
      ? payload.items
      : [];
  return {
    orders: rows.map(mapSummary),
    total: Number((payload.pageInfo as Record<string, unknown> | undefined)?.total) || rows.length,
  };
}

export async function getOrderStatistics(): Promise<MpOrderStatistics> {
  const payload = await request({ path: "/orders/statistics" });
  return {
    totalOrders: Number(payload.totalOrders) || 0,
    pendingPayment: Number(payload.pendingPayment) || 0,
    pendingShipment: Number(payload.pendingShipment) || 0,
    pendingReceipt: Number(payload.pendingReceipt) || 0,
    completed: Number(payload.completed) || 0,
  };
}

export async function getOrderDetail(orderId: string): Promise<MpOrderDetail> {
  const record = await request({ path: `/orders/${orderId}` });
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    id: String(record.orderId ?? record.id ?? orderId),
    subject: String(record.subject ?? "订单"),
    status: String(record.status ?? ""),
    totalAmountCny: Number(record.totalAmount ?? record.totalAmountCny) || null,
    paidAmountCny: Number(record.paidAmount ?? record.paidAmountCny) || null,
    paymentMethod: String(record.paymentMethod ?? ""),
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
        title: String(spu.title ?? item.title ?? "商品"),
        skuName: String(sku.name ?? sku.title ?? ""),
        imageUrl: String(item.imageUrl ?? spu.imageUrl ?? ""),
        priceCny: Number(item.priceCny ?? item.unitPrice) || null,
        quantity: Number(item.quantity) || 1,
      };
    }),
  };
}

export async function payOrder(orderId: string, paymentMethod: string): Promise<string> {
  const payment = await request({
    path: `/orders/${orderId}/payments`,
    method: "POST",
    body: { paymentMethod },
  });
  return String(payment.paymentId ?? payment.id ?? "");
}

export async function cancelOrder(orderId: string): Promise<Record<string, unknown>> {
  return request({ path: `/orders/${orderId}/cancellations`, method: "POST", body: {} });
}

export async function confirmReceipt(orderId: string): Promise<Record<string, unknown>> {
  return request({ path: `/orders/${orderId}/receipt_confirmations`, method: "POST", body: {} });
}

export async function getPaymentSuccess(orderId: string): Promise<Record<string, unknown> | null> {
  try {
    return await request({ path: `/orders/${orderId}/payment_success` });
  } catch (error) {
    return null;
  }
}
