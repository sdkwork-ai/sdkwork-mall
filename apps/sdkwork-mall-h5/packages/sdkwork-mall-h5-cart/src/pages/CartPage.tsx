import { ShoppingCartPage } from "@sdkwork/shop-mobile-react-shopping";

/**
 * Cart tab surface.
 *
 * The cart page, its shop grouping, selection, totals and empty/loading states
 * are owned by the shop mobile shopping brick; the mall root only binds the
 * brick's cart runtime port to its commerce cart facade
 * (`src/bootstrap/cartBrick.ts`) and supplies the host routes.
 */
export function SdkworkMallH5CartPage() {
  return (
    <ShoppingCartPage
      checkoutPath="/checkout"
      productDetailPath="/product/:productId"
    />
  );
}
