import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";
import {
  getSdkworkOrderService,
  hasSdkworkOrderSession,
  unwrapSdkworkOrderResponse,
} from "@sdkwork/order-service";

export interface MallH5MessageRow {
  id: string;
  occurredAt?: string;
  summary: string;
  title: string;
  type: "after-sales" | "order";
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export async function loadMallH5MessageRows(): Promise<MallH5MessageRow[]> {
  if (!hasSdkworkOrderSession()) {
    return [];
  }
  const [ordersPagePayload, afterSalesPagePayload] = await Promise.allSettled([
    getSdkworkOrderService().orders.list({ page: 1, pageSize: 10 }),
    getSdkworkCommerceService().afterSales.requests.list({ page: 1, page_size: 10 }),
  ]);

  const rows: MallH5MessageRow[] = [];

  if (ordersPagePayload.status === "fulfilled") {
    const orderPage = unwrapSdkworkOrderResponse<{ content?: Record<string, unknown>[] }>(
      ordersPagePayload.value,
      "订单加载失败",
    );
    for (const item of orderPage.content ?? []) {
      const occurredAt = readString(item, ["createdAt", "created_at", "updatedAt"]) || undefined;
      rows.push({
        id: `order-${readString(item, ["orderId", "id"]) || rows.length + 1}`,
        occurredAt,
        summary: `金额 ${readString(item, ["totalAmount"]) || "--"} · ${readString(item, ["statusName", "status"]) || "状态更新"}`,
        title: `订单更新：${readString(item, ["subject"]) || readString(item, ["orderId"]) || "订单"}`,
        type: "order",
      });
    }
  }

  if (afterSalesPagePayload.status === "fulfilled") {
    const afterSalesPage = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(
      afterSalesPagePayload.value,
    ) ?? {};
    for (const [index, item] of (afterSalesPage.items ?? []).entries()) {
      rows.push({
        id: `after-sales-${readString(item, ["id", "afterSalesRequestId"]) || index + 1}`,
        occurredAt: readString(item, ["createdAt", "created_at", "appliedAt"]) || undefined,
        summary: readString(item, ["reason", "reasonText", "description"]) || "售后进度更新",
        title: `售后更新：${readString(item, ["orderId", "order_id"]) || "售后单"}`,
        type: "after-sales",
      });
    }
  }

  return rows.sort((left, right) => {
    const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
    const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
    return rightTime - leftTime;
  });
}
