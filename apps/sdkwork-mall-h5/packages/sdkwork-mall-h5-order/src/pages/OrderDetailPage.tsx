import { useTranslation } from "react-i18next";
import { OrderDetail } from "@sdkwork/order-mobile-react-orders";

/**
 * Order detail surface.
 *
 * The page, its loading/not-found states, the item/info/shipment cards and the
 * pay/cancel/confirm/refund actions are owned by the shared order mobile brick
 * (`@sdkwork/order-mobile-react-orders`); the brick runtime is injected once in
 * `src/bootstrap/runtime.ts`. The mall root only supplies the host route
 * templates for the cashier and refund entries and keeps an accessible page
 * heading, because the brick's `PageLayout` header is a visual `h2`.
 */
export function SdkworkMallH5OrderDetailPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="sdk-h5-visually-hidden">{t("orderDetail.title")}</h1>
      <OrderDetail
        orderCashierPath="/buyer/orders/:orderId/cashier"
        refundRequestsPath="/buyer/refunds"
      />
    </>
  );
}
