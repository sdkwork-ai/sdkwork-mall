/**
 * Buyer review centre.
 *
 * The T1 product-review contract is not published yet, so the centre lists the
 * orders that are reviewable today — completed orders — using the same order
 * app-api the order centre already consumes. This mirrors the PC and H5 review
 * screens instead of inventing a review transport.
 */
import { listOrders } from "./order-service";
import { isLoggedIn } from "./session";

export interface MpPendingReviewOrder {
  id: string;
  paidAmountCny: number | null;
  subject: string;
}

export async function listPendingReviewOrders(): Promise<MpPendingReviewOrder[]> {
  if (!isLoggedIn()) {
    return [];
  }
  const { orders } = await listOrders({ page: 1, pageSize: 20, status: "COMPLETED" });
  return orders.map((order) => ({
    id: order.id,
    paidAmountCny: order.paidAmountCny,
    subject: order.subject.trim() || "订单",
  }));
}
