import {
  configureOrderLogisticsRuntime,
  type OrderLogisticsShipment,
} from "@sdkwork/order-mobile-react-orders";

import { loadMallH5OrderLogistics, type MallH5ShipmentLogistics } from "./order-service";

function toBrickShipment(shipment: MallH5ShipmentLogistics): OrderLogisticsShipment {
  return {
    shipmentId: shipment.shipmentId,
    ...(shipment.shipmentNo ? { shipmentNo: shipment.shipmentNo } : {}),
    ...(shipment.carrier ? { carrier: shipment.carrier } : {}),
    ...(shipment.statusLabel ? { statusLabel: shipment.statusLabel } : {}),
    packages: shipment.packages,
    trackingEvents: shipment.trackingEvents,
  };
}

/**
 * Binds the mall order data plane to the order brick's logistics runtime.
 *
 * Shipment records (order → fulfillment → shipment → packages → tracking
 * events) stay in the mall order service; the brick owns the tracking page.
 */
export function configureSdkworkMallH5OrderLogisticsBrick(): void {
  configureOrderLogisticsRuntime({
    async loadShipments(input: { orderId?: string; shipmentId?: string }) {
      const result = await loadMallH5OrderLogistics(input);
      return {
        ...(result.orderId ? { orderId: result.orderId } : {}),
        shipments: result.shipments.map(toBrickShipment),
      };
    },
  });
}
