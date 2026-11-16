import { CheckoutPage as ShopCheckoutPage } from "@sdkwork/shop-mobile-react-shopping";

/**
 * Confirm-order surface.
 *
 * The page (address, delivery, payment method, coupons, wallet/points
 * deduction, gift card, invoice, remark, quote, submit) is owned by the shop
 * mobile shopping brick; the mall cart package only binds the brick's checkout
 * runtime port to its commerce facade (`src/checkout-brick.ts`) and returns the
 * cashier handoff from that adapter.
 */
export function SdkworkMallH5CheckoutPage() {
  return <ShopCheckoutPage />;
}
