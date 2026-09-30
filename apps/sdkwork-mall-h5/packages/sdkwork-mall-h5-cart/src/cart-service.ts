import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5CartLine {
  id: string;
  imageUrl?: string;
  lineTotalCny: number | null;
  priceCny: number | null;
  quantity: number;
  skuName?: string;
  spuId: string;
  title: string;
}

export interface MallH5CartSnapshot {
  id: string;
  items: MallH5CartLine[];
  totalAmountCny: number | null;
}

export interface MallH5AddressOption {
  addressLine: string;
  id: string;
  isDefault: boolean;
  receiverName: string;
  receiverPhone: string;
}

export interface MallH5PaymentMethodOption {
  code: string;
  id: string;
  label: string;
}

export interface MallH5CheckoutQuote {
  discountAmountCny: number | null;
  originalAmountCny: number | null;
  payableAmountCny: number | null;
  quoteId?: string;
  sessionId: string;
}

export interface MallH5CheckoutSubmitInput {
  addressId?: string;
  buyerRemark?: string;
  couponId?: string;
  paymentMethodCode?: string;
  usePoints?: boolean;
  useWallet?: boolean;
}

export interface MallH5CheckoutSubmitResult {
  nextUrl: string;
  orderId: string;
  paymentId?: string;
  warnings: string[];
}

export const MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY = "sdkwork-mall-h5-checkout-warnings";

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readId(value: unknown): string {
  return typeof value === "string" && value ? value : "";
}

export async function loadMallH5Cart(): Promise<MallH5CartSnapshot> {
  const response = await getSdkworkCommerceService().cart.current.retrieve({});
  const payload = unwrapSdkworkCommerceResponse<Record<string, unknown>>(response) ?? {};
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    id: readId(payload.id) || "current",
    items: items.map((item) => {
      const sku = (item.sku ?? {}) as Record<string, unknown>;
      const spu = (item.spu ?? sku.spu ?? {}) as Record<string, unknown>;
      const image = item.imageUrl ?? spu.imageUrl ?? sku.imageUrl;
      return {
        id: readId(item.id),
        imageUrl: typeof image === "string" && image ? image : undefined,
        lineTotalCny: readMoney(item.lineTotalCny ?? item.lineTotal ?? item.totalAmount),
        priceCny: readMoney(item.unitPrice ?? sku.priceCny ?? spu.priceCny),
        quantity: readMoney(item.quantity) ?? 1,
        skuName: typeof (sku.title ?? sku.name) === "string" ? String(sku.title ?? sku.name) : undefined,
        spuId: readId(item.spuId ?? spu.id),
        title: String(spu.title ?? spu.name ?? item.title ?? "商品"),
      };
    }),
    totalAmountCny: readMoney(payload.totalAmountCny ?? payload.totalAmount ?? payload.payableAmount),
  };
}

export async function updateMallH5CartItem(input: {
  cartItemId: string;
  quantity: number;
}): Promise<void> {
  await getSdkworkCommerceService().cart.items.update(input.cartItemId, { quantity: input.quantity });
}

export async function removeMallH5CartItem(cartItemId: string): Promise<void> {
  await getSdkworkCommerceService().cart.items.delete(cartItemId);
}

export async function listMallH5Addresses(): Promise<MallH5AddressOption[]> {
  const response = await getSdkworkCommerceService().addresses.list({ page: 1, page_size: 20 });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => ({
    addressLine: String(item.addressLine ?? item.detailAddress ?? item.address ?? ""),
    id: readId(item.id),
    isDefault: item.isDefault === true || item.is_default === true,
    receiverName: String(item.receiverName ?? item.contactName ?? ""),
    receiverPhone: String(item.receiverPhone ?? item.contactPhone ?? ""),
  }));
}

export async function listMallH5PaymentMethods(): Promise<MallH5PaymentMethodOption[]> {
  const response = await getSdkworkCommerceService().payments.methods.list({});
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item, index) => {
    const code = readId(item.code ?? item.methodCode ?? item.id) || `method-${index + 1}`;
    return {
      code,
      id: readId(item.id) || code,
      label: String(item.label ?? item.name ?? code),
    };
  });
}

export async function createMallH5CheckoutQuote(): Promise<MallH5CheckoutQuote> {
  const remote = getSdkworkCommerceService();
  const sessionResponse = await remote.checkout.sessions.create({});
  const session = unwrapSdkworkCommerceResponse<Record<string, unknown>>(sessionResponse) ?? {};
  const sessionId = readId(session.id ?? session.sessionId ?? session.checkoutSessionId);
  let quoteId = readId(session.quoteId ?? session.checkoutQuoteId);

  if (!quoteId && sessionId) {
    const quoteResponse = await remote.checkout.sessions.quotes.create(sessionId, {});
    const quote = unwrapSdkworkCommerceResponse<Record<string, unknown>>(quoteResponse) ?? {};
    quoteId = readId(quote.id ?? quote.quoteId);
  }

  return {
    discountAmountCny: readMoney(session.discountAmountCny ?? session.discountAmount),
    originalAmountCny: readMoney(session.originalAmountCny ?? session.originalAmount),
    payableAmountCny: readMoney(session.payableAmountCny ?? session.payableAmount),
    quoteId: quoteId || undefined,
    sessionId,
  };
}

export async function submitMallH5CheckoutOrder(
  input: MallH5CheckoutSubmitInput,
): Promise<MallH5CheckoutSubmitResult> {
  const remote = getSdkworkCommerceService();
  const quote = await createMallH5CheckoutQuote();

  if (input.addressId) {
    await remote.addresses.defaultSelection.create({ addressId: input.addressId });
  }

  const orderResponse = await remote.checkout.sessions.orders.create(quote.sessionId, {
    buyerRemark: input.buyerRemark,
    quoteId: quote.quoteId,
  });
  const order = unwrapSdkworkCommerceResponse<Record<string, unknown>>(orderResponse) ?? {};
  const orderId = readId(order.id ?? order.orderId);

  if (!orderId) {
    throw new Error("订单创建失败");
  }

  if (input.couponId) {
    await remote.promotions.discountApplications.create({
      orderId,
      userCouponId: input.couponId,
    });
  }

  const warnings: string[] = [];
  if (input.useWallet) {
    try {
      await remote.wallet.holds.create({ assetType: "cash", orderId });
    } catch (cause: unknown) {
      warnings.push(
        cause instanceof Error ? `钱包抵扣未生效：${cause.message}` : "钱包抵扣未生效，订单将全额支付。",
      );
    }
  }
  if (input.usePoints) {
    try {
      await remote.wallet.holds.create({ assetType: "points", orderId });
    } catch (cause: unknown) {
      warnings.push(
        cause instanceof Error ? `积分抵扣未生效：${cause.message}` : "积分抵扣未生效，订单将全额支付。",
      );
    }
  }

  let paymentId: string | undefined;
  let nextUrl = `/payment/result?status=success&orderId=${encodeURIComponent(orderId)}`;

  if (input.paymentMethodCode) {
    const paymentResponse = await remote.orders.pay(orderId, { paymentMethod: input.paymentMethodCode });
    const payment = unwrapSdkworkCommerceResponse<Record<string, unknown>>(paymentResponse) ?? {};
    paymentId = readId(payment.paymentId ?? payment.id) || undefined;
    if (paymentId) {
      nextUrl = `/payment/result?status=pending&orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}&paymentMethod=${encodeURIComponent(input.paymentMethodCode)}`;
    }
  }

  return { nextUrl, orderId, paymentId, warnings };
}

export async function retrieveMallH5OrderPaymentSuccess(
  orderId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await getSdkworkCommerceService().orders.paymentSuccess.retrieve(orderId);
    return unwrapSdkworkCommerceResponse<Record<string, unknown>>(response);
  } catch {
    return null;
  }
}

export async function retryMallH5OrderPayment(
  orderId: string,
  paymentMethod: string,
): Promise<string | undefined> {
  const response = await getSdkworkCommerceService().orders.pay(orderId, { paymentMethod });
  const payment = unwrapSdkworkCommerceResponse<Record<string, unknown>>(response) ?? {};
  return readId(payment.paymentId ?? payment.id) || undefined;
}
