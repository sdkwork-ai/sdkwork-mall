import type { MallH5OrderStatus } from "@sdkwork/mall-h5-order/order-service";

/**
 * Channel for the navigate-to-select pattern: the form page pushes the picker
 * page, the picked reference flows back through here, and the form consumes
 * it on remount (stack navigation unmounts the form while the picker is
 * open, so a plain in-memory callback would die with the old instance).
 * The pending pick also mirrors into sessionStorage as a belt-and-braces
 * fallback for exotic remount flows.
 */
type OrderPickListener = (orderId: string) => void;

const PENDING_KEY = "sdkwork-aftersales-order-pick";

let orderPickListener: OrderPickListener | null = null;
let pendingPick: string | null = null;

export function openOrderPick(onPicked: OrderPickListener): void {
  orderPickListener = onPicked;
}

export function completeOrderPick(orderId: string): void {
  pendingPick = orderId;
  try {
    sessionStorage.setItem(PENDING_KEY, orderId);
  } catch {
    // sessionStorage 不可用时保留内存信封。
  }
  const listener = orderPickListener;
  listener?.(orderId);
}

/** Consumes the picked reference once (called by the form on mount). */
export function consumePendingOrderPick(): string | null {
  if (pendingPick) {
    const value = pendingPick;
    pendingPick = null;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    return value;
  }
  try {
    const stored = sessionStorage.getItem(PENDING_KEY);
    if (stored) {
      sessionStorage.removeItem(PENDING_KEY);
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

export interface MallH5PickableOrder {
  createdAt: string;
  id: string;
  status: MallH5OrderStatus | string;
  subject: string;
  totalAmountCny: number | null;
}
