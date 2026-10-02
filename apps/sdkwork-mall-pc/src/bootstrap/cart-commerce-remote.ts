import { getSdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureSdkworkCartRemotePort } from "@sdkwork/mall-pc-cart";

export function configureSdkworkMallPcCartCommerceRemotePort(): void {
  const commerce = () => getSdkworkCommerceService();

  configureSdkworkCartRemotePort({
    createCheckoutOrder(sessionId, body) {
      return commerce().checkout.sessions.orders.create(sessionId, body);
    },
    createCheckoutQuote(sessionId, body) {
      return commerce().checkout.sessions.quotes.create(sessionId, body);
    },
    createCheckoutSession(body) {
      return commerce().checkout.sessions.create(body);
    },
    createDiscountApplication(body) {
      return commerce().promotions.discountApplications.create(body);
    },
    createWalletHold(body) {
      return commerce().wallet.holds.create(body);
    },
    deleteCartItem(cartItemId) {
      // Generated signature: delete(cartItemId) — path parameter.
      return commerce().cart.items.delete(cartItemId);
    },
    listAddresses(query) {
      return commerce().addresses.list(query);
    },
    listPaymentMethods(query) {
      return commerce().payments.methods.list(query);
    },
    listUserCoupons(query) {
      return commerce().promotions.userCoupons.list(query);
    },
    payOrder(orderId, body) {
      return commerce().orders.pay(orderId, body);
    },
    retrieveCurrentCart() {
      return commerce().cart.current.retrieve();
    },
    retrieveOrderPaymentSuccess(orderId) {
      return commerce().orders.paymentSuccess.retrieve(orderId);
    },
    retrievePointsAccount() {
      return commerce().wallet.accounts.points.retrieve();
    },
    retrieveWalletOverview() {
      return commerce().wallet.overview.retrieve();
    },
    setDefaultAddress(body) {
      // Generated signature: create(addressId, body) — path parameter, not body.
      return commerce().addresses.defaultSelection.create(body.addressId, {});
    },
    updateCartItem(cartItemId, quantity) {
      // Generated signature: update(cartItemId, body) — path parameter first.
      return commerce().cart.items.update(cartItemId, { quantity });
    },
  });
}
