/**
 * Cart and checkout surfaces for the SDKWork Mall mini program.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (cart / checkout / payments rows) and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. The cart, checkout, payment
 * method, coupon, address and wallet operations belong to the mall commerce block
 * (`runtime.commerceClient`); the payment intent belongs to the order block
 * (`runtime.orderClient`). This module only projects them onto mall view models —
 * the money-path body builders stay pure so they remain unit-tested.
 */
import { getMallMpRuntime, createMpIdempotencyParams } from "@sdkwork/mall-mp-core";

import { errorMessage } from "../types/common";
import { readCommercePayload } from "./commerce-payload";

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
  /** `standard` | `express` | `sf`; the server prices it into the quote. */
  deliveryMethod?: string;
  giftCardCode?: string;
  invoiceForm?: MpCheckoutInvoiceForm;
  needPoints?: boolean;
  needInvoice?: boolean;
  usePoints?: boolean;
  useWallet?: boolean;
}

/** The commerce block hands back the unwrapped `data` payload (or the envelope). */
function commerce() {
  return getMallMpRuntime().commerceClient;
}

function readRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(record.items)) {
    return record.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(record.content)) {
    return record.content as Array<Record<string, unknown>>;
  }
  return [];
}

export async function getCart(): Promise<MpCart> {
  const payload = await readCommercePayload(commerce().cart.current.retrieve());
  return {
    id: String(payload.id ?? "current"),
    items: readRows(payload).map((item) => {
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
  return readCommercePayload(commerce().cart.items.create({
    quantity: options.quantity ?? 1,
    skuId: options.skuId,
    spuId: options.spuId,
  }));
}

export async function updateCartItem(cartItemId: string, quantity: number): Promise<Record<string, unknown>> {
  return readCommercePayload(commerce().cart.items.update(cartItemId, { quantity }));
}

export async function removeCartItem(cartItemId: string): Promise<Record<string, unknown>> {
  return readCommercePayload(commerce().cart.items.delete(cartItemId));
}

export async function listPaymentMethods(): Promise<Array<{ code: string; id: string; label: string }>> {
  const payload = await readCommercePayload(commerce().payments.methods.list());
  return readRows(payload).map((item, index) => ({
    id: String(item.id ?? item.code ?? `method-${index + 1}`),
    code: String(item.code ?? item.id ?? `method-${index + 1}`),
    label: String(item.label ?? item.name ?? item.code ?? "支付方式"),
  }));
}

export async function listUserCoupons(): Promise<Array<{ discountAmountCny: number | null; id: string; minSpendCny: number | null; title: string; validUntil: string }>> {
  const payload = await readCommercePayload(commerce().promotions.userCoupons.list({ page: 1, pageSize: 50 }));
  return readRows(payload)
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
  const sessionRecord = await readCommercePayload(commerce().checkout.sessions.create(body));
  const sessionId = String(sessionRecord.id ?? sessionRecord.sessionId ?? "");
  let quoteId = String(sessionRecord.quoteId ?? sessionRecord.checkoutQuoteId ?? "");
  if (!quoteId && sessionId) {
    const quote = await readCommercePayload(commerce().checkout.sessions.quotes.create(sessionId, {}));
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

/**
 * Builds the checkout order body. Exported so the money-path fields
 * (`cartItemIds`, `deliveryMethod`, `giftCardCode`, `needInvoice`/`invoiceForm`,
 * `quoteId`) are unit-tested instead of only string-matched in a contract test.
 */
export function buildCheckoutOrderBody(
  options: MpSubmitOrderOptions,
  quote: Pick<MpCheckoutQuote, "quoteId">,
): Record<string, unknown> {
  return {
    buyerRemark: options.buyerRemark,
    cartItemIds: options.cartItemIds && options.cartItemIds.length ? options.cartItemIds : undefined,
    deliveryMethod: options.deliveryMethod,
    giftCardCode: options.giftCardCode,
    invoiceForm: options.needInvoice ? options.invoiceForm : undefined,
    needInvoice: options.needInvoice ?? false,
    quoteId: quote.quoteId || undefined,
  };
}

export async function submitOrder(options: MpSubmitOrderOptions): Promise<{ orderId: string; quote: MpCheckoutQuote; warnings: string[] }> {
  const quote = await createCheckoutQuote({ cartItemIds: options.cartItemIds });

  if (options.addressId) {
    // Marks the checkout address as the account default; the commerce block owns
    // the selection semantics.
    await commerce().addresses.defaultSelection.create(options.addressId, {});
  }

  const order = await readCommercePayload(
    commerce().checkout.sessions.orders.create(quote.sessionId, buildCheckoutOrderBody(options, quote)),
  );
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
      await commerce().promotions.discountApplications.create({ orderId, userCouponId: options.couponId });
    } catch (cause) {
      warnings.push(`优惠券未生效：${errorMessage(cause, "优惠券不可用")}`);
    }
  }

  if (options.useWallet) {
    try {
      await commerce().wallet.holds.create({ assetType: "cash", orderId });
    } catch (cause) {
      warnings.push(`钱包抵扣未生效：${errorMessage(cause, "余额不可用")}`);
    }
  }
  if (options.usePoints) {
    try {
      await commerce().wallet.holds.create({ assetType: "points", orderId });
    } catch (cause) {
      warnings.push(`积分抵扣未生效：${errorMessage(cause, "积分不可用")}`);
    }
  }

  return { orderId, quote, warnings };
}

export interface MpWechatPayParams {
  nonceStr: string;
  package: string;
  paySign: string;
  signType: WechatMiniprogram.RequestPaymentOption["signType"];
  timeStamp: string;
}

export interface MpPaymentStart {
  paymentId: string;
  /** Prepay parameters for `wx.requestPayment`; null when the backend returns none. */
  wechatPay: MpWechatPayParams | null;
  /** Channel cashier URL (H5/QR channels); empty when the backend returns none. */
  paymentUrl: string;
}

const PAYMENT_URL_KEYS = ["paymentUrl", "payUrl", "mwebUrl", "cashierUrl", "redirectUrl"] as const;

function readText(source: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function readPaymentUrl(payment: Record<string, unknown>): string {
  const params = readParams(payment);
  for (const key of PAYMENT_URL_KEYS) {
    for (const source of [payment, params]) {
      const value = source[key];
      if (typeof value === "string" && /^https?:\/\//u.test(value.trim())) {
        return value.trim();
      }
    }
  }
  return "";
}

function readParams(payment: Record<string, unknown>): Record<string, unknown> {
  return payment.paymentParams && typeof payment.paymentParams === "object"
    ? (payment.paymentParams as Record<string, unknown>)
    : {};
}

function readWechatPay(payment: Record<string, unknown>): MpWechatPayParams | null {
  const params = readParams(payment);
  const source = Object.keys(params).length > 0 ? params : payment;
  const timeStamp = readText(source, ["timeStamp", "timestamp"]);
  const nonceStr = readText(source, ["nonceStr", "nonce_str"]);
  const packageValue = readText(source, ["package", "packageValue", "prepayId", "prepay_id"]);
  const paySign = readText(source, ["paySign", "pay_sign", "sign"]);
  if (!timeStamp || !nonceStr || !packageValue || !paySign) {
    return null;
  }
  const signType = readText(source, ["signType", "sign_type"]).toUpperCase();
  return {
    nonceStr,
    package: packageValue,
    paySign,
    // WeChat's own default is MD5; only send RSA/HMAC when the server states it,
    // otherwise a v2 backend that omits the field fails every signature check.
    signType: signType === "MD5" || signType === "HMAC-SHA256" || signType === "RSA" ? signType : "MD5",
    timeStamp,
  };
}

/**
 * Starts the payment intent through the order block.
 *
 * The cashier needs the prepay parameters (`wx.requestPayment`) or a channel
 * URL; both are projected here from the order block's payment record.
 */
export async function payOrder(orderId: string, paymentMethod: string): Promise<MpPaymentStart> {
  const payment = await getMallMpRuntime().orderClient.orders.payments.create(
    orderId,
    { paymentMethod },
    createMpIdempotencyParams(),
  );
  return {
    paymentId: String(payment.paymentId ?? payment.id ?? ""),
    paymentUrl: readPaymentUrl(payment),
    wechatPay: readWechatPay(payment),
  };
}
