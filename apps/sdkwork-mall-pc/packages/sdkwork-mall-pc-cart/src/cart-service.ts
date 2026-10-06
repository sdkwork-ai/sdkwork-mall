import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";

import { getSdkworkCartRemotePort } from "./cart-remote-port";

export interface MallCartLine {
  id: string;
  imageUrl?: string;
  lineTotalCny: number | null;
  productId: string;
  quantity: number;
  shopName?: string;
  skuId: string;
  skuName?: string;
  title: string;
  unitPriceCny: number | null;
}

export interface MallCartSnapshot {
  id: string;
  items: MallCartLine[];
  totalAmountCny: number;
}

export interface MallCheckoutAddress {
  fullAddress: string;
  id: string;
  isDefault: boolean;
  name: string;
  phone?: string;
}

export interface MallCheckoutCoupon {
  id: string;
  title: string;
}

export interface MallCheckoutPaymentMethod {
  code: string;
  id: string;
  label: string;
}

export interface MallCheckoutContext {
  addresses: MallCheckoutAddress[];
  cart: MallCartSnapshot;
  coupons: MallCheckoutCoupon[];
  paymentMethods: MallCheckoutPaymentMethod[];
  pointsBalance: number;
  walletBalanceCny: number;
}

export interface MallCheckoutQuote {
  discountAmountCny: number;
  originalAmountCny: number;
  payableAmountCny: number;
  quoteId: string;
  sessionId: string;
}

export interface MallCheckoutInvoiceForm {
  titleType: "company" | "personal";
  title: string;
  taxNumber?: string;
  email?: string;
}

export interface MallCheckoutSubmitInput {
  addressId?: string;
  buyerRemark?: string;
  couponId?: string;
  deliveryMethod?: string;
  giftCardCode?: string;
  invoiceForm?: MallCheckoutInvoiceForm;
  needInvoice?: boolean;
  paymentMethodCode?: string;
  usePoints?: boolean;
  useWallet?: boolean;
}

export interface MallCheckoutSubmitResult {
  nextUrl: string;
  orderId: string;
  paymentId?: string;
  warnings: string[];
}

export const MALL_CHECKOUT_WARNINGS_STORAGE_KEY = "sdkwork-mall-pc-checkout-warnings";

function readMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "object" && value !== null && "amount" in value) {
    return readMoney((value as { amount?: unknown }).amount);
  }
  return 0;
}

function readCartLine(record: Record<string, unknown>): MallCartLine {
  const sku = (record.sku ?? null) as Record<string, unknown> | null;
  const spu = (record.spu ?? null) as Record<string, unknown> | null;
  const unitPrice =
    typeof record.unitPrice === "number"
      ? record.unitPrice
      : typeof record.price === "number"
        ? record.price
        : typeof record.priceCny === "number"
          ? record.priceCny
          : typeof sku?.priceCny === "number"
            ? sku.priceCny
            : typeof spu?.priceCny === "number"
              ? spu.priceCny
              : null;
  const quantity = typeof record.quantity === "number" ? record.quantity : 1;
  const imageSource =
    typeof record.imageUrl === "string" && record.imageUrl.length > 0
      ? record.imageUrl
      : typeof record.image === "string" && record.image.length > 0
        ? record.image
        : typeof record.thumbnail === "string" && record.thumbnail.length > 0
          ? record.thumbnail
          : typeof record.productImage === "string" && record.productImage.length > 0
            ? record.productImage
            : typeof spu?.imageUrl === "string" && spu.imageUrl.length > 0
              ? spu.imageUrl
              : undefined;
  const title =
    (typeof record.title === "string" && record.title) ||
    (typeof record.productName === "string" && record.productName) ||
    (typeof spu?.title === "string" && spu.title) ||
    (typeof sku?.name === "string" && sku.name) ||
    "商品";
  const skuName =
    (typeof record.skuName === "string" && record.skuName) ||
    (typeof sku?.name === "string" && sku.name) ||
    undefined;
  const shopName =
    (typeof record.shopName === "string" && record.shopName) || "平台自营";

  return {
    id: String(record.id ?? ""),
    productId: String(record.spuId ?? record.productId ?? ""),
    skuId: String(record.skuId ?? ""),
    title,
    skuName,
    shopName,
    imageUrl: imageSource,
    quantity,
    unitPriceCny: unitPrice,
    lineTotalCny: unitPrice != null ? unitPrice * quantity : null,
  };
}

function readSessionId(record: Record<string, unknown>): string {
  return String(record.checkoutSessionId ?? record.checkout_session_id ?? record.id ?? "");
}

function readQuoteId(record: Record<string, unknown>): string {
  return String(record.quoteId ?? record.quote_id ?? "");
}

function readOrderId(record: Record<string, unknown>): string {
  return String(record.id ?? record.orderId ?? record.order_id ?? "");
}

export async function loadMallCart(): Promise<MallCartSnapshot> {
  const remote = getSdkworkCartRemotePort();
  const response = await remote.retrieveCurrentCart();
  const payload = unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => readCartLine(item as Record<string, unknown>))
    : [];
  const totalAmountCny = items.reduce((sum, item) => sum + (item.lineTotalCny ?? 0), 0);

  return {
    id: String(payload.id ?? "current"),
    items,
    totalAmountCny,
  };
}

export async function updateMallCartItem(cartItemId: string, quantity: number) {
  const remote = getSdkworkCartRemotePort();
  return remote.updateCartItem(cartItemId, quantity);
}

export async function removeMallCartItem(cartItemId: string) {
  const remote = getSdkworkCartRemotePort();
  return remote.deleteCartItem(cartItemId);
}

export async function loadMallCheckoutContext(): Promise<MallCheckoutContext> {
  const remote = getSdkworkCartRemotePort();
  const [cart, addressesResult, couponsResult, methodsResult, walletResult, pointsResult] =
    await Promise.allSettled([
      loadMallCart(),
      remote.listAddresses({ page: 1, page_size: 20 }),
      remote.listUserCoupons({ status: "available", page: 1, page_size: 20 }),
      remote.listPaymentMethods({}),
      remote.retrieveWalletOverview(),
      remote.retrievePointsAccount(),
    ]);

  const addressesPayload =
    addressesResult.status === "fulfilled"
      ? (unwrapSdkworkPaymentResponse(addressesResult.value) as { items?: Record<string, unknown>[] })
      : { items: [] as Record<string, unknown>[] };

  const couponsPayload =
    couponsResult.status === "fulfilled"
      ? (unwrapSdkworkPaymentResponse(couponsResult.value) as { items?: Record<string, unknown>[] })
      : { items: [] as Record<string, unknown>[] };

  const methodsPayload =
    methodsResult.status === "fulfilled"
      ? (unwrapSdkworkPaymentResponse(methodsResult.value) as { items?: Record<string, unknown>[] })
      : { items: [] as Record<string, unknown>[] };

  const walletPayload =
    walletResult.status === "fulfilled"
      ? (unwrapSdkworkPaymentResponse(walletResult.value) as Record<string, unknown>)
      : {};

  const pointsPayload =
    pointsResult.status === "fulfilled"
      ? (unwrapSdkworkPaymentResponse(pointsResult.value) as Record<string, unknown>)
      : {};

  return {
    cart: cart.status === "fulfilled" ? cart.value : { id: "current", items: [], totalAmountCny: 0 },
    addresses:
      addressesPayload.items?.map((item) => ({
        id: String(item.id ?? ""),
        name: String(item.contactName ?? item.name ?? "收件人"),
        phone: typeof item.phone === "string" ? item.phone : undefined,
        fullAddress: [item.province, item.city, item.district, item.detail]
          .filter((part) => typeof part === "string" && part.length > 0)
          .join(" "),
        isDefault: Boolean(item.isDefault ?? item.default),
      })) ?? [],
    coupons:
      couponsPayload.items?.map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? item.name ?? "优惠券"),
      })) ?? [],
    paymentMethods:
      methodsPayload.items?.map((item) => ({
        id: String(item.id ?? item.code ?? ""),
        code: String(item.code ?? item.id ?? ""),
        label: String(item.label ?? item.name ?? item.code ?? "支付方式"),
      })) ?? [],
    walletBalanceCny: readMoney(walletPayload.cashAvailable ?? walletPayload.availableBalance),
    pointsBalance: readMoney(pointsPayload.availablePoints ?? pointsPayload.totalPoints),
  };
}

export async function createMallCheckoutQuote(): Promise<MallCheckoutQuote> {
  const remote = getSdkworkCartRemotePort();
  const sessionResponse = await remote.createCheckoutSession({});
  const session = unwrapSdkworkPaymentResponse(sessionResponse) as Record<string, unknown>;
  const sessionId = readSessionId(session);
  let quoteId = readQuoteId(session);

  if (!quoteId && sessionId) {
    const quoteResponse = await remote.createCheckoutQuote(sessionId, {});
    const quote = unwrapSdkworkPaymentResponse(quoteResponse) as Record<string, unknown>;
    quoteId = readQuoteId(quote);
  }

  return {
    sessionId,
    quoteId,
    originalAmountCny: readMoney(session.originalAmount ?? session.original_amount),
    discountAmountCny: readMoney(session.discountAmount ?? session.discount_amount),
    payableAmountCny: readMoney(session.payableAmount ?? session.payable_amount),
  };
}

export async function submitMallCheckoutOrder(
  input: MallCheckoutSubmitInput,
): Promise<MallCheckoutSubmitResult> {
  const remote = getSdkworkCartRemotePort();
  const quote = await createMallCheckoutQuote();

  if (input.addressId) {
    await remote.setDefaultAddress({ addressId: input.addressId });
  }

  const orderResponse = await remote.createCheckoutOrder(quote.sessionId, {
    buyerRemark: input.buyerRemark,
    deliveryMethod: input.deliveryMethod,
    giftCardCode: input.giftCardCode,
    invoiceForm: input.invoiceForm,
    needInvoice: input.needInvoice,
    quoteId: quote.quoteId,
  });
  const order = unwrapSdkworkPaymentResponse(orderResponse) as Record<string, unknown>;
  const orderId = readOrderId(order);

  if (!orderId) {
    throw new Error("订单创建失败");
  }

  if (input.couponId) {
    await remote.createDiscountApplication({
      orderId,
      userCouponId: input.couponId,
    });
  }

  const warnings: string[] = [];

  if (input.useWallet) {
    try {
      await remote.createWalletHold({ orderId, assetType: "cash" });
    } catch (cause: unknown) {
      warnings.push(
        cause instanceof Error
          ? `钱包抵扣未生效：${cause.message}`
          : "钱包抵扣未生效，订单将全额支付。",
      );
    }
  }

  if (input.usePoints) {
    try {
      await remote.createWalletHold({ orderId, assetType: "points" });
    } catch (cause: unknown) {
      warnings.push(
        cause instanceof Error
          ? `积分抵扣未生效：${cause.message}`
          : "积分抵扣未生效，订单将全额支付。",
      );
    }
  }

  let paymentId: string | undefined;
  // JD-style two-step flow: checkout only creates the order, payment happens
  // on the cashier page where the buyer confirms the payment channel.
  const cashierQuery = new URLSearchParams({ orderId });
  if (input.paymentMethodCode) {
    cashierQuery.set("paymentMethod", input.paymentMethodCode);
  }
  const nextUrl = `/payment/cashier?${cashierQuery.toString()}`;

  return { nextUrl, orderId, paymentId, warnings };
}

export async function retrieveMallOrderPaymentSuccess(
  orderId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const remote = getSdkworkCartRemotePort();
    const response = await remote.retrieveOrderPaymentSuccess(orderId);
    return unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function retryMallOrderPayment(
  orderId: string,
  paymentMethod: string,
): Promise<string | undefined> {
  const remote = getSdkworkCartRemotePort();
  const response = await remote.payOrder(orderId, { paymentMethod });
  const result = unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
  const paymentId = String(result.paymentId ?? result.payment_id ?? result.id ?? "");
  return paymentId || undefined;
}

export async function listMallPaymentMethods(): Promise<
  { code: string; id: string; label: string }[]
> {
  const remote = getSdkworkCartRemotePort();
  const response = await remote.listPaymentMethods({});
  const payload = unwrapSdkworkPaymentResponse(response) as {
    items?: Record<string, unknown>[];
  };
  return (payload.items ?? []).map((item, index) => {
    const code = String(item.code ?? item.methodCode ?? item.id ?? `method-${index + 1}`);
    return {
      code,
      id: String(item.id ?? code),
      label: String(item.label ?? item.name ?? code),
    };
  });
}
