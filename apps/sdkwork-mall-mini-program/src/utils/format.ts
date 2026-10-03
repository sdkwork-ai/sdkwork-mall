export function formatCny(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return `¥${value.toFixed(2)}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_LABELS: Record<string, string> = {
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

export function statusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[String(status || "").toUpperCase()] || "处理中";
}
