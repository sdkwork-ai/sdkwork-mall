const { request } = require("./transport");

const STATUS_FILTER_MAP = {
  all: "",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_SHIPMENT: "PENDING_SHIPMENT",
  PENDING_RECEIPT: "PENDING_RECEIPT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

function mapSummary(order) {
  return {
    id: String(order.orderId ?? order.id ?? ""),
    subject: String(order.subject ?? "订单"),
    status: String(order.status ?? ""),
    totalAmountCny: Number(order.totalAmount ?? order.totalAmountCny) || null,
    paidAmountCny: Number(order.paidAmount ?? order.paidAmountCny) || null,
    createdAt: String(order.createdAt ?? ""),
  };
}

async function listOrders(options = {}) {
  const statusFilter = STATUS_FILTER_MAP[options.status] || options.status || "";
  const payload = await request({
    path: "/orders",
    query: {
      page: options.page ?? 1,
      page_size: options.pageSize ?? 20,
      status: statusFilter || undefined,
    },
  });
  const rows = Array.isArray(payload.content) ? payload.content : payload.items ?? [];
  return {
    orders: rows.map(mapSummary),
    total: Number(payload.pageInfo && payload.pageInfo.total) || rows.length,
  };
}

async function getOrderStatistics() {
  const payload = await request({ path: "/orders/statistics" });
  return {
    totalOrders: Number(payload.totalOrders) || 0,
    pendingPayment: Number(payload.pendingPayment) || 0,
    pendingShipment: Number(payload.pendingShipment) || 0,
    pendingReceipt: Number(payload.pendingReceipt) || 0,
    completed: Number(payload.completed) || 0,
  };
}

async function getOrderDetail(orderId) {
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
      const sku = item.sku ?? {};
      const spu = item.spu ?? {};
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

async function payOrder(orderId, paymentMethod) {
  const payment = await request({
    path: `/orders/${orderId}/payments`,
    method: "POST",
    body: { paymentMethod },
  });
  return String(payment.paymentId ?? payment.id ?? "");
}

async function cancelOrder(orderId) {
  return request({ path: `/orders/${orderId}/cancellations`, method: "POST", body: {} });
}

async function confirmReceipt(orderId) {
  return request({ path: `/orders/${orderId}/receipt_confirmations`, method: "POST", body: {} });
}

async function getPaymentSuccess(orderId) {
  try {
    return await request({ path: `/orders/${orderId}/payment_success` });
  } catch (error) {
    return null;
  }
}

module.exports = {
  listOrders,
  getOrderStatistics,
  getOrderDetail,
  payOrder,
  cancelOrder,
  confirmReceipt,
  getPaymentSuccess,
};
