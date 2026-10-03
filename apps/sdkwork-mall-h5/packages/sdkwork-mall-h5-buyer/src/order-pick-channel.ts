import type { MallH5OrderStatus } from "@sdkwork/mall-h5-order/order-service";

/**
 * Channel for the navigate-to-select pattern: the form page registers a
 * callback, pushes the picker page, and the picked reference flows back
 * through here (single documented channel; no free-text id inputs for
 * references that have a browsable list — APP_MOBILE_REACT_UI_SPEC §5).
 */
type OrderPickListener = (orderId: string) => void;

let orderPickListener: OrderPickListener | null = null;

export function openOrderPick(onPicked: OrderPickListener): void {
  orderPickListener = onPicked;
}

export function completeOrderPick(orderId: string): void {
  const listener = orderPickListener;
  orderPickListener = null;
  listener?.(orderId);
}

export interface MallH5PickableOrder {
  createdAt: string;
  id: string;
  status: MallH5OrderStatus | string;
  subject: string;
  totalAmountCny: number | null;
}
