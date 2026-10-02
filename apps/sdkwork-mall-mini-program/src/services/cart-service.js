const { request } = require("./transport");

async function getCart() {
  const payload = await request({ path: "/cart/current" });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    id: String(payload.id ?? "current"),
    items: items.map((item) => {
      const sku = item.sku ?? {};
      const spu = item.spu ?? sku.spu ?? {};
      const shop = item.shop ?? spu.shop ?? {};
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

async function addToCart(options) {
  return request({
    path: "/cart/items",
    method: "POST",
    body: { quantity: options.quantity ?? 1, skuId: options.skuId, spuId: options.spuId },
  });
}

async function updateCartItem(cartItemId, quantity) {
  return request({ path: `/cart/items/${cartItemId}`, method: "PUT", body: { quantity } });
}

async function removeCartItem(cartItemId) {
  return request({ path: `/cart/items/${cartItemId}`, method: "DELETE" });
}

async function listPaymentMethods() {
  const payload = await request({ path: "/payments/methods" });
  return (payload.items ?? []).map((item, index) => ({
    id: String(item.id ?? item.code ?? `method-${index + 1}`),
    code: String(item.code ?? item.id ?? `method-${index + 1}`),
    label: String(item.label ?? item.name ?? item.code ?? "支付方式"),
  }));
}

async function listUserCoupons() {
  const payload = await request({ path: "/promotions/user_coupons", query: { page: 1, page_size: 50 } });
  return (payload.items ?? [])
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

async function createCheckoutQuote(options = {}) {
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

async function submitOrder(options) {
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
      quoteId: quote.quoteId || undefined,
    },
  });
  const orderId = String(order.id ?? order.orderId ?? "");
  if (!orderId) {
    throw new Error("订单创建失败");
  }

  if (options.couponId) {
    await request({
      path: "/promotions/discount_applications",
      method: "POST",
      body: { orderId, userCouponId: options.couponId },
    });
  }

  if (options.useWallet) {
    try {
      await request({ path: "/wallet/holds", method: "POST", body: { assetType: "cash", orderId } });
    } catch (error) {
      // 钱包抵扣为可选增强，失败时订单全额支付。
    }
  }
  if (options.usePoints) {
    try {
      await request({ path: "/wallet/holds", method: "POST", body: { assetType: "points", orderId } });
    } catch (error) {
      // 积分抵扣为可选增强，失败时订单全额支付。
    }
  }

  return { orderId, quote };
}

async function payOrder(orderId, paymentMethod) {
  const payment = await request({
    path: `/orders/${orderId}/payments`,
    method: "POST",
    body: { paymentMethod },
  });
  return String(payment.paymentId ?? payment.id ?? "");
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  listPaymentMethods,
  listUserCoupons,
  createCheckoutQuote,
  submitOrder,
  payOrder,
};
