import { hasSdkworkOrderSession } from "@sdkwork/order-service";

import { loadMallH5OrderDashboard } from "@sdkwork/mall-h5-order/order-service";

export interface MallH5PendingReviewOrder {
  id: string;
  paidAmountCny: number | null;
  subject: string;
}

/**
 * Review candidates for the buyer review centre.
 *
 * The T1 product-review contract is not published yet, so the centre lists the
 * orders that are reviewable today (completed orders) exactly like the PC root
 * does. No transport is invented here: the order app-api stays the only source.
 */
export async function loadMallH5PendingReviewOrders(): Promise<MallH5PendingReviewOrder[]> {
  if (!hasSdkworkOrderSession()) {
    return [];
  }
  const dashboard = await loadMallH5OrderDashboard(1, "completed");
  return dashboard.orders.map((order) => ({
    id: order.id,
    paidAmountCny: order.paidAmountCny,
    subject: order.subject.trim() || "订单",
  }));
}
