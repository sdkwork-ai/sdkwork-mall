/**
 * Message-center composition service.
 *
 * Mirrors the H5 `/buyer/messages` surface: rows are synthesized from the
 * latest orders and after-sales requests so the buyer sees one progress feed
 * before the push-message service ships. All traffic still funnels through
 * the domain services and the single transport seam.
 */
import { listOrders } from "./order-service";
import { listRequests } from "./aftersales-service";
import { isLoggedIn } from "./session";

export interface MpMessageRow {
  id: string;
  occurredAt: string;
  summary: string;
  title: string;
  type: "after-sales" | "order";
}

export async function listMessageRows(): Promise<MpMessageRow[]> {
  if (!isLoggedIn()) {
    return [];
  }
  const [ordersResult, afterSalesRows] = await Promise.allSettled([
    listOrders({ page: 1, pageSize: 10 }),
    listRequests(1, 10),
  ]);

  const rows: MpMessageRow[] = [];

  if (ordersResult.status === "fulfilled") {
    for (const [index, order] of ordersResult.value.orders.entries()) {
      rows.push({
        id: `order-${order.id || index + 1}`,
        occurredAt: order.createdAt,
        summary: `金额 ${order.totalAmountCny != null ? `¥${order.totalAmountCny.toFixed(2)}` : "--"} · ${order.status || "状态更新"}`,
        title: `订单更新：${order.subject || order.id || "订单"}`,
        type: "order",
      });
    }
  }

  if (afterSalesRows.status === "fulfilled") {
    for (const [index, request] of afterSalesRows.value.entries()) {
      rows.push({
        id: `after-sales-${request.id || index + 1}`,
        occurredAt: "",
        summary: request.description || request.statusLabel || "售后进度更新",
        title: `售后更新：${request.orderId || "售后单"}`,
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
