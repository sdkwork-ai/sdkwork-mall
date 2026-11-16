import { configureShopMobileCheckoutRuntime } from "@sdkwork/shop-mobile-react-shopping";

import {
  createMallH5CheckoutQuote,
  listMallH5Addresses,
  listMallH5PaymentMethods,
  listMallH5SelectableCoupons,
  loadMallH5Cart,
  submitMallH5CheckoutOrder,
  type MallH5CheckoutSubmitInput,
} from "./cart-service";

function decimal(value: number | null | undefined): string | undefined {
  return value == null ? undefined : value.toFixed(2);
}

/**
 * Binds the mall commerce checkout facade to the shop brick's confirm-order
 * runtime port.
 *
 * The brick owns the confirmation UI (address, delivery, payment, coupons,
 * deductions, gift card, invoice, remark, quote, submit); the mall cart package
 * supplies the checkout data plane and keeps the cashier handoff.
 */
export function configureSdkworkMallH5CheckoutBrick(): void {
  configureShopMobileCheckoutRuntime({
    async loadAddresses() {
      const addresses = await listMallH5Addresses();
      return addresses.map((address) => ({
        id: address.id,
        receiverName: address.receiverName,
        receiverPhone: address.receiverPhone,
        addressLine: address.addressLine,
        isDefault: address.isDefault,
      }));
    },
    async loadCoupons() {
      const coupons = await listMallH5SelectableCoupons();
      return coupons.map((coupon) => ({
        id: coupon.id,
        title: coupon.title,
        ...(decimal(coupon.discountAmountCny) ? { discount: decimal(coupon.discountAmountCny) } : {}),
        ...(decimal(coupon.minSpendCny) ? { minSpend: decimal(coupon.minSpendCny) } : {}),
      }));
    },
    async loadItems() {
      const snapshot = await loadMallH5Cart();
      return snapshot.items.map((line) => ({
        id: line.id,
        title: line.title,
        ...(line.imageUrl ? { image: line.imageUrl } : {}),
        price: decimal(line.priceCny) ?? "0.00",
        quantity: line.quantity,
        ...(line.skuName ? { skuName: line.skuName } : {}),
      }));
    },
    async loadPaymentMethods() {
      const methods = await listMallH5PaymentMethods();
      return methods.map((method) => ({ code: method.code, label: method.label }));
    },
    async createQuote(input) {
      const quote = await createMallH5CheckoutQuote(
        input.cartItemIds?.length ? { cartItemIds: input.cartItemIds } : {},
      );
      return {
        ...(decimal(quote.originalAmountCny) ? { originalAmount: decimal(quote.originalAmountCny) } : {}),
        ...(decimal(quote.discountAmountCny) ? { discountAmount: decimal(quote.discountAmountCny) } : {}),
        ...(decimal(quote.payableAmountCny) ? { payableAmount: decimal(quote.payableAmountCny) } : {}),
      };
    },
    async submit(input) {
      const submitInput: MallH5CheckoutSubmitInput = {
        ...(input.addressId ? { addressId: input.addressId } : {}),
        ...(input.buyerRemark ? { buyerRemark: input.buyerRemark } : {}),
        ...(input.cartItemIds?.length ? { cartItemIds: input.cartItemIds } : {}),
        ...(input.couponId ? { couponId: input.couponId } : {}),
        ...(input.deliveryMethod ? { deliveryMethod: input.deliveryMethod } : {}),
        ...(input.giftCardCode ? { giftCardCode: input.giftCardCode } : {}),
        ...(input.invoiceForm
          ? {
              invoiceForm: {
                ...(input.invoiceForm.email ? { email: input.invoiceForm.email } : {}),
                ...(input.invoiceForm.taxNumber ? { taxNumber: input.invoiceForm.taxNumber } : {}),
                title: input.invoiceForm.title,
                titleType: input.invoiceForm.titleType === "company" ? "company" : "personal",
              },
            }
          : {}),
        needInvoice: input.needInvoice ?? false,
        ...(input.paymentMethodCode ? { paymentMethodCode: input.paymentMethodCode } : {}),
        usePoints: input.usePoints ?? false,
        useWallet: input.useWallet ?? false,
      };
      const result = await submitMallH5CheckoutOrder(submitInput);
      return { nextUrl: result.nextUrl, warnings: result.warnings };
    },
  });
}
