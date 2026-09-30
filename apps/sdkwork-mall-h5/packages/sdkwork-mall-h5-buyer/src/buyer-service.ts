import {
  hasSdkworkOrderSession,
  unwrapSdkworkOrderResponse,
} from "@sdkwork/order-service";

import { loadMallH5OrderDashboard, type MallH5OrderDashboard } from "@sdkwork/mall-h5-order/order-service";

export type { MallH5OrderStatus } from "@sdkwork/mall-h5-order/order-service";

export async function loadMallH5BuyerDashboard(): Promise<MallH5OrderDashboard> {
  if (!hasSdkworkOrderSession()) {
    return {
      orders: [],
      statistics: {
        completed: 0,
        pendingPayment: 0,
        pendingReceipt: 0,
        pendingShipment: 0,
        totalOrders: 0,
      },
    };
  }
  void unwrapSdkworkOrderResponse;
  return loadMallH5OrderDashboard();
}
