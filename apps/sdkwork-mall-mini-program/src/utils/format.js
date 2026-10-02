function formatCny(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }
  return `¥${amount.toFixed(2)}`;
}

function formatTime(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_LABELS = {
  CANCELLED: "已取消",
  COMPLETED: "已完成",
  EXPIRED: "已超时",
  PAID: "已支付",
  PENDING_PAYMENT: "待付款",
  PENDING_RECEIPT: "待收货",
  PENDING_SHIPMENT: "待发货",
  REFUNDED: "已退款",
  REFUNDING: "退款中",
};

function statusLabel(status) {
  return STATUS_LABELS[String(status || "").toUpperCase()] || "处理中";
}

module.exports = { formatCny, formatTime, statusLabel };
