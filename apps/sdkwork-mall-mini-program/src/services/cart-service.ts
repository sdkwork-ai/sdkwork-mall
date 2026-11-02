import { errorMessage } from "../types/common";
import { request } from "./transport";

export interface MpCartItem {
  id: string;
  imageUrl: string;
  priceCny: number | null;
  quantity: number;
  shopId: string;
  shopName: string;
  skuId: string;
  skuName: string;
  spuId: string;
  title: string;
}

export interface MpCart {
  id: string;
  items: MpCartItem[];
  totalAmountCny: number;
}

export interface MpAddToCartOptions {
  quantity?: number;
  skuId: string;
  spuId?: string;
}

export interface MpCheckoutQuote {
  sessionId: string;
  quoteId: string;
  originalAmountCny: number | null;
  discountAmountCny: number | null;
  payableAmountCny: number | null;
}

export interface MpCheckoutInvoiceForm {
  email?: string;
  taxNumber?: string;
  title: string;
  titleType: "company" | "personal";
}

export interface MpSubmitOrderOptions {
  buyerRemark?: string;
  cartItemIds?: string[];
  addressId?: string;
  couponId?: string;
  invoiceForm?: MpCheckoutInvoiceForm;
  needInvoice?: boolean;
  usePoints?: boolean;
  useWallet?: boolean;
}

export async function getCart(): Promise<MpCart> {
  const payload = await request({ path: "/cart/current" });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    id: String(payload.id ?? "current"),
    items: items.map((item) => {
      const sku = (item.sku ?? {}) as Record<string, unknown>;
      const spu = (item.spu ?? sku.spu ?? {}) as Record<string, unknown>;
      const shop = (item.shop ?? spu.shop ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        skuId: String(item.skuId ?? sku.id ?? ""),
        spuId: String(item.spuId ?? spu.id ?? ""),
        title: String(spu.title ?? spu.name ?? item.title ?? "商品"),
        skuName: String(sku.title ?? sku.name ?? ""),
        imageUrl: String(item.imageUrl ?? spu.imageUrl ?? sku.imageUrl ?? ""),
        priceCny: Number(item.unitPrice ?? item.priceCny ?? sku.priceCny ?? spu.priceCny) || null,
        quantity: Number(item.quantity) || 1,
        shopId: String(item.shopId ?? shop.id ?? spu.shopId ?? ""),
        shopName: String(item.shopName ?? shop.name ?? spu.shopName ?? "SDKWork 精选"),
      };
    }),
    totalAmountCny: Number(payload.totalAmountCny ?? payload.totalAmount) || 0,
  };
}

export async function addToCart(options: MpAddToCartOptions): Promise<Record<string, unknown>> {
  return request({
    path: "/cart/items",
    method: "POST",
    body: { quantity: options.quantity ?? 1, skuId: options.skuId, spuId: options.spuId },
  });
}

export async function updateCartItem(cartItemId: string, quantity: number): Promise<Record<string, unknown>> {
  return request({ path: `/cart/items/${cartItemId}`, method: "PUT", body: { quantity } });
}

export async function removeCartItem(cartItemId: string): Promise<Record<string, unknown>> {
  return request({ path: `/cart/items/${cartItemId}`, method: "DELETE" });
}

export async function listPaymentMethods(): Promise<Array<{ code: string; id: string; label: string }>> {
  const payload = await request({ path: "/payments/methods" });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((item, index) => ({
    id: String(item.id ?? item.code ?? `method-${index + 1}`),
    code: String(item.code ?? item.id ?? `method-${index + 1}`),
    label: String(item.label ?? item.name ?? item.code ?? "支付方式"),
  }));
}

export async function listUserCoupons(): Promise<Array<{ discountAmountCny: number | null; id: string; minSpendCny: number | null; title: string; validUntil: string }>> {
  const payload = await request({ path: "/promotions/user_coupons", query: { page: 1, page_size: 50 } });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .filter((item) => {
      const status = String(item.status ?? item.statusName ?? "AVAILABLE").toUpperCase();
      return status === "AVAILABLE" || status === "ACTIVE" || status === "UNUSED" || status === "";
    })
    .map((item) => ({
      id: String(item.id ?? item.userCouponId ?? ""),
      title: String(item.title ?? item.name ?? item.couponName ?? "优惠券"),
      discountAmountCny: Number(item.discountAmountCny ?? item.discountAmount ?? item.amount) || null,
      minSpendCny: Number(item.minSpendCny ?? item.minSpend ?? item.thresholdAmount),
      validUntil: String(item.validUntil ?? item.expireTime ?? item.expiredAt ?? ""),
    }))
    .filter((coupon) => coupon.id);
}

export async function createCheckoutQuote(options: { cartItemIds?: string[] } = {}): Promise<MpCheckoutQuote> {
  const body = options.cartItemIds && options.cartItemIds.length ? { cartItemIds: options.cartItemIds } : {};
  const sessionRecord = await request({ path: "/checkout/sessions", method: "POST", body });
  const sessionId = String(sessionRecord.id ?? sessionRecord.sessionId ?? "");
  let quoteId = String(sessionRecord.quoteId ?? sessionRecord.checkoutQuoteId ?? "");
  if (!quoteId && sessionId) {
    const quote = await request({ path: `/checkout/sessions/${sessionId}/quotes`, method: "POST", body: {} });
    quoteId = String(quote.id ?? quote.quoteId ?? "");
  }
  return {
    sessionId,
    quoteId,
    originalAmountCny: Number(sessionRecord.originalAmountCny ?? sessionRecord.originalAmount) || null,
    discountAmountCny: Number(sessionRecord.discountAmountCny ?? sessionRecord.discountAmount) || null,
    payableAmountCny: Number(sessionRecord.payableAmountCny ?? sessionRecord.payableAmount) || null,
  };
}

export async function submitOrder(options: MpSubmitOrderOptions): Promise<{ orderId: string; quote: MpCheckoutQuote; warnings: string[] }> {
  const quote = await createCheckoutQuote({ cartItemIds: options.cartItemIds });

  if (options.addressId) {
    await request({
      path: "/addresses/default_selection",
      method: "POST",
      body: { addressId: options.addressId },
    });
  }

  const order = await request({
    path: `/checkout/sessions/${quote.sessionId}/orders`,
    method: "POST",
    body: {
      buyerRemark: options.buyerRemark,
      cartItemIds: options.cartItemIds && options.cartItemIds.length ? options.cartItemIds : undefined,
      invoiceForm: options.needInvoice ? options.invoiceForm : undefined,
      needInvoice: options.needInvoice ?? false,
      quoteId: quote.quoteId || undefined,
    },
  });
  const orderId = String(order.id ?? order.orderId ?? "");
  if (!orderId) {
    throw new Error("订单创建失败");
  }

  const warnings: string[] = [];

  if (options.couponId) {
    // Coupon application is keyed by order, so it runs after the order exists.
    // A rejected coupon must not surface as a failed checkout: the order will
    // still be paid, so the buyer is warned instead.
    try {
      await request({
        path: "/promotions/discount_applications",
        method: "POST",
        body: { orderId, userCouponId: options.couponId },
      });
    } catch (cause) {
      warnings.push(`优惠券未生效：${errorMessage(cause, "优惠券不可用")}`);
    }
  }

  if (options.useWallet) {
    try {
      await request({ path: "/wallet/holds", method: "POST", body: { assetType: "cash", orderId } });
    } catch (cause) {
      warnings.push(`钱包抵扣未生效：${errorMessage(cause, "余额不可用")}`);
    }
  }
  if (options.usePoints) {
    try {
      await request({ path: "/wallet/holds", method: "POST", body: { assetType: "points", orderId } });
    } catch (cause) {
      warnings.push(`积分抵扣未生效：${errorMessage(cause, "积分不可用")}`);
    }
  }

  return { orderId, quote, warnings };
}

export async function payOrder(orderId: string, paymentMethod: string): Promise<string> {
  const payment = await request({
    path: `/orders/${orderId}/payments`,
    method: "POST",
    body: { paymentMethod },
  });
  return String(payment.paymentId ?? payment.id ?? "");
}
