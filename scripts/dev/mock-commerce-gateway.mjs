#!/usr/bin/env node
// Local development mock of the Cloud Router federation gateway (port 3900).
// Serves the commerce app-api surfaces the mall clients exercise, with
// in-memory JD-style data, so the full browse → cart → checkout → pay flow
// can be tested end-to-end without the platform backend.
//
// THIS IS A DEVELOPMENT/TEST DOUBLE ONLY. It never runs in production and
// holds no secrets; auth headers are accepted without verification.
import http from "node:http";

const PORT = 3900;
let seq = 1000;
const nextId = (prefix) => `${prefix}-${(seq += 1)}`;
const ok = (data) => ({ code: 0, data, traceId: `mock-${Math.random().toString(36).slice(2, 10)}` });

const categories = [
  { id: "cat-digital", name: "数码家电" },
  { id: "cat-digital-phone", parentId: "cat-digital", name: "手机通讯" },
  { id: "cat-digital-laptop", parentId: "cat-digital", name: "电脑办公" },
  { id: "cat-home", name: "家居家装" },
  { id: "cat-food", name: "食品生鲜" },
];

const spus = [
  { id: "spu-phone-1", categoryId: "cat-digital-phone", title: "SDKWork Phone X1 旗舰手机 12GB+256GB", priceCny: 3999, sales: 1200, description: "6.7 英寸 OLED 屏,5000mAh 电池,旗舰芯片。", shopId: "shop-1", skus: [{ id: "sku-phone-black", title: "曜石黑", priceCny: 3999, stock: 50 }, { id: "sku-phone-white", title: "皓月白", priceCny: 4099, stock: 30 }] },
  { id: "spu-phone-2", categoryId: "cat-digital-phone", title: "SDKWork Phone Lite 轻薄手机", priceCny: 1999, sales: 3400, description: "轻薄机身,长续航。", shopId: "shop-1", skus: [{ id: "sku-lite-blue", title: "远峰蓝", priceCny: 1999, stock: 80 }] },
  { id: "spu-laptop-1", categoryId: "cat-digital-laptop", title: "SDKWork Book 14 轻薄本", priceCny: 5499, sales: 860, description: "14 英寸 2.8K 屏,标压处理器。", shopId: "shop-1", skus: [{ id: "sku-book-16", title: "16GB+512GB", priceCny: 5499, stock: 40 }, { id: "sku-book-32", title: "32GB+1TB", priceCny: 7299, stock: 15 }] },
  { id: "spu-chair-1", categoryId: "cat-home", title: "人体工学椅 Pro", priceCny: 1299, sales: 2200, description: "全网面,4D 扶手。", shopId: "shop-1", skus: [{ id: "sku-chair-black", title: "黑色", priceCny: 1299, stock: 60 }] },
  { id: "spu-rice-1", categoryId: "cat-food", title: "东北五常大米 10kg", priceCny: 89, sales: 9000, description: "当年新米。", shopId: "shop-1", skus: [{ id: "sku-rice-10", title: "10kg 装", priceCny: 89, stock: 500 }] },
  { id: "spu-phone-3", categoryId: "cat-digital-phone", title: "SDKWork Phone Ultra 影像旗舰", priceCny: 6999, sales: 500, description: "一英寸大底,卫星通信。", shopId: "shop-1", skus: [{ id: "sku-ultra-ti", title: "钛金属", priceCny: 6999, stock: 10 }] },
];

const shop = { id: "shop-1", name: "SDKWork 官方旗舰店", logoUrl: "", rating: 4.9, status: "active" };

const addresses = [
  { id: "addr-1", receiverName: "张三", receiverPhone: "13800000000", addressLine: "浙江省杭州市西湖区文一路 96 号", isDefault: true },
];

const paymentMethods = [
  { id: "pm-wechat", code: "WECHAT", label: "微信支付" },
  { id: "pm-alipay", code: "ALIPAY", label: "支付宝" },
];

const offers = [
  { id: "offer-seckill-1", title: "限时秒杀 · 手机专场", activityType: "flash-sale", status: "active", discountText: "最高直降 1000 元", highlight: "每晚 8 点开抢", startAt: new Date(Date.now() - 3600_000).toISOString(), endAt: new Date(Date.now() + 86400_000).toISOString(), claimable: true },
  { id: "offer-brand-1", title: "SDKWork 品牌日", activityType: "brand-day", status: "active", discountText: "满 2999 减 300", highlight: "全场参与", status2: "active", claimable: true },
];

const cart = { items: [] };
const orders = [];
const afterSalesRequests = [];
const invoices = [];
const shipmentByOrder = new Map();

function couponFromOffer(offer, override = {}) {
  return {
    id: nextId("uc"),
    offerId: offer?.id,
    title: offer?.title ?? "SDKWork 优惠券",
    status: "AVAILABLE",
    discountAmountCny: override.discountAmountCny ?? 100,
    minSpendCny: override.minSpendCny ?? 999,
    validUntil: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  };
}

const userCoupons = [
  couponFromOffer(offers[1], { discountAmountCny: 300, minSpendCny: 2999 }),
  couponFromOffer(null, { title: "无门槛新人券", discountAmountCny: 15, minSpendCny: 0 }),
];
const discountApplications = [];
const walletHolds = [];

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

function cartTotal(items = cart.items) {
  return items.reduce((sum, item) => sum + item.priceCny * item.quantity, 0);
}

function selectCartItems(cartItemIds) {
  if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
    return cart.items;
  }
  const wanted = new Set(cartItemIds.map(String));
  return cart.items.filter((item) => wanted.has(item.id));
}

function orderStatus(order) {
  if (order.cancelled) return "CANCELLED";
  return order.paid ? (order.receiptConfirmed ? "COMPLETED" : "PENDING_RECEIPT") : "PENDING_PAYMENT";
}

function shipmentFor(order) {
  if (!order.paid) return null;
  if (!shipmentByOrder.has(order.id)) {
    const now = Date.now();
    shipmentByOrder.set(order.id, {
      shipment: { id: `ship-${order.id}`, shipmentNo: `SF${100000 + orders.indexOf(order) * 7}`, carrierName: "SDKWork 次日达", statusName: "运输中" },
      packages: [{ packageId: `pkg-${order.id}`, packageName: "标准包裹" }],
      trackingEvents: [
        { description: "包裹已发出", occurredAt: new Date(now - 7200_000).toISOString(), statusName: "已发货" },
        { description: "快件已到达杭州转运中心", occurredAt: new Date(now - 3600_000).toISOString(), statusName: "运输中" },
        { description: "派送中,请保持电话畅通", occurredAt: new Date(now - 600_000).toISOString(), statusName: "派送中" },
      ],
    });
  }
  return shipmentByOrder.get(order.id);
}

async function handle(method, url, body) {
  const path = url.replace(/\?.*$/u, "");
  const query = new URL(url, "http://mock").searchParams;
  const p = `${method} ${path}`;

  // ── catalog ──
  if (p === "GET /app/v3/api/catalog/categories") {
    return ok({ items: categories, pageInfo: { page: 1, total: categories.length } });
  }
  if (p === "GET /app/v3/api/catalog/spus") {
    let rows = spus.map(({ skus, ...rest }) => ({ ...rest, skus }));
    const categoryId = query.get("category_id");
    if (categoryId) {
      const childIds = categories.filter((cat) => cat.parentId === categoryId).map((cat) => cat.id);
      rows = rows.filter((spu) => spu.categoryId === categoryId || childIds.includes(spu.categoryId));
    }
    const shopId = query.get("shop_id");
    if (shopId) rows = rows.filter((spu) => spu.shopId === shopId);
    const q = query.get("q");
    if (q) rows = rows.filter((spu) => spu.title.includes(q));
    const sort = query.get("sort");
    if (sort === "sales") rows = [...rows].sort((a, b) => b.sales - a.sales);
    if (sort === "price_asc") rows = [...rows].sort((a, b) => a.priceCny - b.priceCny);
    if (sort === "price_desc") rows = [...rows].sort((a, b) => b.priceCny - a.priceCny);
    if (sort === "newest") rows = [...rows].reverse();
    return ok({ items: rows, pageInfo: { page: Number(query.get("page") ?? 1), total: rows.length } });
  }
  const spuMatch = path.match(/^\/app\/v3\/api\/catalog\/spus\/([^/]+)$/u);
  if (method === "GET" && spuMatch) {
    const spu = spus.find((entry) => entry.id === spuMatch[1]);
    if (!spu) return { code: 40401, message: "spu not found" };
    return ok({ ...spu, shopName: shop.name });
  }

  // ── shops ──
  if (p === "GET /app/v3/api/shops") return ok({ items: [shop], pageInfo: { page: 1, total: 1 } });
  const shopMatch = path.match(/^\/app\/v3\/api\/shops\/([^/]+)$/u);
  if (method === "GET" && shopMatch && shopMatch[1] === shop.id) return ok(shop);

  // ── cart ──
  if (p === "GET /app/v3/api/cart/current") {
    return ok({ id: "cart-current", items: cart.items, totalAmountCny: cartTotal() });
  }
  if (p === "POST /app/v3/api/cart/items") {
    const sku = spus.flatMap((spu) => spu.skus).find((entry) => entry.id === body.skuId) ?? { priceCny: 0, title: body.skuId };
    const spu = spus.find((entry) => entry.skus.some((entry2) => entry2.id === body.skuId));
    const existing = cart.items.find((item) => item.skuId === body.skuId);
    if (existing) existing.quantity += body.quantity ?? 1;
    else cart.items.push({ id: nextId("cart"), skuId: body.skuId, spuId: body.spuId ?? spu?.id, quantity: body.quantity ?? 1, priceCny: sku.priceCny, lineTotalCny: sku.priceCny * (body.quantity ?? 1), sku: { id: body.skuId, name: sku.title }, spu: { id: spu?.id, title: spu?.title, imageUrl: "" } });
    return ok({ id: "cart-current" });
  }
  const cartItemMatch = path.match(/^\/app\/v3\/api\/cart\/items\/([^/]+)$/u);
  if (cartItemMatch && method === "PUT") {
    const item = cart.items.find((entry) => entry.id === cartItemMatch[1]);
    if (item) { item.quantity = body.quantity ?? item.quantity; item.lineTotalCny = item.priceCny * item.quantity; }
    return ok({ id: item?.id });
  }
  if (cartItemMatch && method === "DELETE") {
    cart.items = cart.items.filter((entry) => entry.id !== cartItemMatch[1]);
    return ok({});
  }

  // ── addresses ──
  if (p === "GET /app/v3/api/addresses") return ok({ items: addresses, pageInfo: { page: 1, total: addresses.length } });
  if (p === "POST /app/v3/api/addresses") {
    addresses.push({ id: nextId("addr"), isDefault: false, ...body });
    return ok({ id: addresses.at(-1).id });
  }
  const addressMatch = path.match(/^\/app\/v3\/api\/addresses\/([^/]+)$/u);
  if (addressMatch && method === "PUT") {
    const address = addresses.find((entry) => entry.id === addressMatch[1]);
    Object.assign(address, body);
    return ok({ id: address.id });
  }
  if (addressMatch && method === "DELETE") {
    const index = addresses.findIndex((entry) => entry.id === addressMatch[1]);
    if (index >= 0) addresses.splice(index, 1);
    return ok({});
  }
  const defaultSelectionMatch = path.match(/^\/app\/v3\/api\/addresses\/([^/]+)\/default_selection$/u);
  if (defaultSelectionMatch && method === "POST") {
    for (const address of addresses) address.isDefault = address.id === defaultSelectionMatch[1];
    return ok({ addressId: defaultSelectionMatch[1] });
  }
  if (p === "POST /app/v3/api/addresses/default_selection") {
    for (const address of addresses) address.isDefault = address.id === body.addressId;
    return ok({ addressId: body.addressId });
  }

  // ── payments methods ──
  if (p === "GET /app/v3/api/payments/methods") return ok({ items: paymentMethods, pageInfo: { page: 1, total: paymentMethods.length } });

  // ── checkout ──
  if (p === "POST /app/v3/api/checkout/sessions") {
    const selection = selectCartItems(body.cartItemIds);
    const total = cartTotal(selection);
    const discount = discountApplications
      .filter((entry) => !entry.consumed)
      .reduce((sum, entry) => sum + (entry.discountAmountCny ?? 0), 0);
    return ok({ id: nextId("cs"), originalAmountCny: total, discountAmountCny: discount, payableAmountCny: Math.max(0, total - discount) });
  }
  const quoteMatch = path.match(/^\/app\/v3\/api\/checkout\/sessions\/([^/]+)\/quotes$/u);
  if (quoteMatch && method === "POST") return ok({ id: nextId("quote") });
  const checkoutOrderMatch = path.match(/^\/app\/v3\/api\/checkout\/sessions\/([^/]+)\/orders$/u);
  if (checkoutOrderMatch && method === "POST") {
    const selection = selectCartItems(body.cartItemIds);
    const order = { id: nextId("order"), paid: false, cancelled: false, receiptConfirmed: false, totalAmountCny: cartTotal(selection), subject: selection[0]?.spu?.title ?? "SDKWork 订单", createdAt: new Date().toISOString(), items: selection.map((item) => ({ ...item })), quantity: selection.reduce((sum, item) => sum + item.quantity, 0) };
    orders.push(order);
    const orderedIds = new Set(selection.map((item) => item.id));
    cart.items = cart.items.filter((item) => !orderedIds.has(item.id));
    for (const application of discountApplications) {
      if (!application.consumed) application.consumed = true;
    }
    return ok({ id: order.id });
  }

  // ── orders (buyer) ──
  if (p === "GET /app/v3/api/orders") {
    const statusFilter = query.get("status");
    const page = Math.max(1, Number(query.get("page") ?? 1));
    const pageSize = Math.max(1, Number(query.get("page_size") ?? query.get("pageSize") ?? 20));
    let rows = orders.map((order) => ({ orderId: order.id, subject: order.subject, status: orderStatus(order), totalAmount: order.totalAmountCny, paidAmount: order.paid ? order.totalAmountCny : null, paymentMethod: order.paymentMethod, createdAt: order.createdAt }));
    if (statusFilter) {
      rows = rows.filter((order) => order.status === statusFilter.toUpperCase());
    }
    const total = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ content: rows, pageInfo: { page, total } });
  }
  if (p === "GET /app/v3/api/orders/statistics") {
    const count = (match) => orders.filter((order) => match(orderStatus(order))).length;
    return ok({ totalOrders: orders.length, pendingPayment: count((status) => status === "PENDING_PAYMENT"), pendingShipment: count((status) => status === "PENDING_SHIPMENT"), pendingReceipt: count((status) => status === "PENDING_RECEIPT"), completed: count((status) => status === "COMPLETED") });
  }
  const orderMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)$/u);
  if (method === "GET" && orderMatch) {
    const order = orders.find((entry) => entry.id === orderMatch[1]);
    return order ? ok({ orderId: order.id, subject: order.subject, status: orderStatus(order), totalAmount: order.totalAmountCny, paidAmount: order.paid ? order.totalAmountCny : null, paymentMethod: order.paymentMethod, createdAt: order.createdAt, shipmentIds: order.paid ? [shipmentFor(order).shipment.id] : [], items: order.items.map((item) => ({ id: item.skuId, priceCny: item.priceCny, quantity: item.quantity, sku: { name: item.sku?.name ?? item.sku?.title }, spu: { id: item.spuId, imageUrl: item.spu?.imageUrl, title: item.spu?.title } })) }) : { code: 40401, message: "order not found" };
  }
  const statusMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/status$/u);
  if (statusMatch && method === "GET") {
    const order = orders.find((entry) => entry.id === statusMatch[1]);
    return ok({ status: orderStatus(order), statusName: orderStatus(order) });
  }
  const paymentSuccessMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/payment_success$/u);
  if (paymentSuccessMatch && method === "GET") {
    const order = orders.find((entry) => entry.id === paymentSuccessMatch[1]);
    return ok({ paid: Boolean(order?.paid), status: orderStatus(order) });
  }
  const paymentsMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/payments$/u);
  if (paymentsMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === paymentsMatch[1]);
    order.paymentMethod = body.paymentMethod;
    // Mock channel: the payment settles immediately.
    order.paid = true;
    order.paymentId = nextId("pay");
    return ok({ paymentId: order.paymentId, status: "PROCESSING" });
  }
  const receiptMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/receipt_confirmations$/u);
  if (receiptMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === receiptMatch[1]);
    order.receiptConfirmed = true;
    return ok({});
  }
  const cancelMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/cancellations$/u);
  if (cancelMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === cancelMatch[1]);
    order.cancelled = true;
    return ok({});
  }

  // ── shipments ──
  const trackingMatch = path.match(/^\/app\/v3\/api\/shipments\/([^/]+)\/tracking_events$/u);
  if (trackingMatch && method === "GET") {
    for (const entry of shipmentByOrder.values()) {
      if (entry.shipment.id === trackingMatch[1]) return ok({ content: entry.trackingEvents, pageInfo: { page: 1, total: entry.trackingEvents.length } });
    }
    return ok({ content: [], pageInfo: { page: 1, total: 0 } });
  }
  const packagesMatch = path.match(/^\/app\/v3\/api\/shipments\/([^/]+)\/packages$/u);
  if (packagesMatch && method === "GET") {
    for (const entry of shipmentByOrder.values()) {
      if (entry.shipment.id === packagesMatch[1]) return ok({ content: entry.packages, pageInfo: { page: 1, total: entry.packages.length } });
    }
    return ok({ content: [], pageInfo: { page: 1, total: 0 } });
  }
  const shipmentMatch = path.match(/^\/app\/v3\/api\/shipments\/([^/]+)$/u);
  if (shipmentMatch && method === "GET") {
    for (const entry of shipmentByOrder.values()) {
      if (entry.shipment.id === shipmentMatch[1]) return ok({ ...entry.shipment, shipmentId: entry.shipment.id });
    }
    return { code: 40401, message: "shipment not found" };
  }

  // ── promotions ──
  if (p === "GET /app/v3/api/promotions/offers") return ok({ items: offers, pageInfo: { page: 1, total: offers.length } });
  const offerMatch = path.match(/^\/app\/v3\/api\/promotions\/offers\/([^/]+)$/u);
  if (offerMatch && method === "GET") {
    const offer = offers.find((entry) => entry.id === offerMatch[1]);
    return offer ? ok(offer) : { code: 40401, message: "offer not found" };
  }
  if (p === "POST /app/v3/api/promotions/user_coupon_claims") {
    const offer = offers.find((entry) => entry.id === body.offerId);
    const coupon = couponFromOffer(offer, offer?.id === "offer-brand-1" ? { discountAmountCny: 300, minSpendCny: 2999 } : { discountAmountCny: 50, minSpendCny: 999 });
    userCoupons.push(coupon);
    return ok({ id: coupon.id });
  }
  if (p === "GET /app/v3/api/promotions/user_coupons") {
    return ok({ items: userCoupons.filter((coupon) => coupon.status === "AVAILABLE"), pageInfo: { page: 1, total: userCoupons.length } });
  }
  if (p === "POST /app/v3/api/promotions/codes/redemptions") {
    if (!body.code || body.code.length < 6) return { code: 40401, message: "兑换码无效" };
    userCoupons.push(couponFromOffer(null, { title: `兑换券 ${body.code}`, discountAmountCny: 20, minSpendCny: 0 }));
    return ok({});
  }
  if (p === "POST /app/v3/api/promotions/discount_applications") {
    const coupon = userCoupons.find((entry) => entry.id === body.userCouponId && entry.status === "AVAILABLE");
    if (!coupon) return { code: 40401, message: "优惠券不可用" };
    const application = { id: nextId("da"), orderId: body.orderId, userCouponId: coupon.id, discountAmountCny: coupon.discountAmountCny, consumed: false };
    discountApplications.push(application);
    coupon.status = "USED";
    return ok(application);
  }

  // ── wallet holds (checkout offsets) ──
  if (p === "POST /app/v3/api/wallet/holds") {
    const hold = { id: nextId("hold"), orderId: body.orderId, assetType: body.assetType ?? "cash" };
    walletHolds.push(hold);
    return ok(hold);
  }

  // ── after-sales ──
  if (p === "GET /app/v3/api/after_sales/requests") {
    return ok({ items: afterSalesRequests, pageInfo: { page: 1, total: afterSalesRequests.length } });
  }
  if (p === "POST /app/v3/api/after_sales/requests") {
    afterSalesRequests.push({ id: nextId("as"), orderId: body.orderId, reason: body.reason, type: body.type, status: "PENDING", createdAt: new Date().toISOString() });
    return ok({});
  }

  // ── invoices ──
  if (p === "GET /app/v3/api/invoices/mine") {
    return ok({ items: invoices, pageInfo: { page: 1, total: invoices.length } });
  }
  if (p === "POST /app/v3/api/invoices") {
    invoices.push({ id: nextId("inv"), title: body.title, titleType: body.titleType, amountCny: null, status: "PENDING" });
    return ok({});
  }

  // ── wallet (account service paths) ──
  if (p === "GET /app/v3/api/wallet/accounts/cash") return ok({ balanceCny: 1280.5 });
  if (p === "GET /app/v3/api/wallet/accounts/points") return ok({ balance: 8600 });
  if (p === "GET /app/v3/api/wallet/points/summary") return ok({ balance: 8600 });
  if (p === "GET /app/v3/api/wallet/ledger_entries/cash") {
    return ok({ content: [{ id: "ledger-1", summary: "充值", amountCny: 1000, occurredAt: new Date().toISOString() }, { id: "ledger-2", summary: "订单支付", amountCny: -89, occurredAt: new Date().toISOString() }], pageInfo: { page: 1, total: 2 } });
  }
  if (p === "GET /app/v3/api/wallet/points/lots") {
    return ok({ content: [{ id: "lot-1", points: 6000, expiresAt: "2026-12-31" }, { id: "lot-2", points: 2600 }], pageInfo: { page: 1, total: 2 } });
  }

  return { code: 40401, message: `mock gateway: no route for ${p}` };
}

const server = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const result = await handle(req.method ?? "GET", req.url ?? "/", body);
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,access-token,content-type,x-idempotency-key",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  if (req.method === "OPTIONS") { res.end(); return; }
  res.end(JSON.stringify(result));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-commerce-gateway] listening on http://127.0.0.1:${PORT} (dev/test double, in-memory data)`);
});
