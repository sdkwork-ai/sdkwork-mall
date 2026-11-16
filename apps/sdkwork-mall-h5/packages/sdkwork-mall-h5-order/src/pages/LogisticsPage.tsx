import { OrderShipmentPage } from "@sdkwork/order-mobile-react-orders";

/**
 * Logistics tracking surface.
 *
 * The page (shipment header, packages, event timeline, empty/error states) is
 * owned by the order brick; the mall order package binds the brick's logistics
 * runtime port to its commerce order data plane (`src/logistics-brick.ts`).
 */
export function SdkworkMallH5LogisticsPage() {
  return <OrderShipmentPage orderCenterPath="/buyer/orders" />;
}
