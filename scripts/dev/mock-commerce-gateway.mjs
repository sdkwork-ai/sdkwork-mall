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

// Dev-only placeholder artwork so galleries/recommendations render like a
// real storefront. Not served in production.
const PALETTE = ["#2563eb", "#7c3aed", "#e93b3d", "#f97316", "#059669", "#0891b2"];
function artImage(label, colorIndex) {
  const bg = PALETTE[colorIndex % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${bg}"/><text x="300" y="290" font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">SDKWork</text><text x="300" y="360" font-family="sans-serif" font-size="34" fill="rgba(255,255,255,0.85)" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const categories = [
  { id: "cat-digital", name: "数码家电" },
  { id: "cat-digital-phone", parentId: "cat-digital", name: "手机通讯" },
  { id: "cat-digital-laptop", parentId: "cat-digital", name: "电脑办公" },
  { id: "cat-home", name: "家居家装" },
  { id: "cat-food", name: "食品生鲜" },
];

const spus = [
  { id: "spu-phone-1", categoryId: "cat-digital-phone", title: "SDKWork Phone X1 旗舰手机 12GB+256GB", priceCny: 3999, sales: 1200, description: "6.7 英寸 OLED 屏,5000mAh 电池,旗舰芯片。", shopId: "shop-1", imageUrl: artImage("Phone X1", 0), images: [artImage("Phone X1 正面", 0), artImage("Phone X1 背面", 3), artImage("Phone X1 影像", 5)], skus: [{ id: "sku-phone-black", title: "曜石黑", priceCny: 3999, stock: 50, imageUrl: artImage("曜石黑", 0) }, { id: "sku-phone-white", title: "皓月白", priceCny: 4099, stock: 30, imageUrl: artImage("皓月白", 4) }] },
  { id: "spu-phone-2", categoryId: "cat-digital-phone", title: "SDKWork Phone Lite 轻薄手机", priceCny: 1999, sales: 3400, description: "轻薄机身,长续航。", shopId: "shop-1", imageUrl: artImage("Phone Lite", 4), images: [artImage("Phone Lite", 4)], skus: [{ id: "sku-lite-blue", title: "远峰蓝", priceCny: 1999, stock: 80, imageUrl: artImage("远峰蓝", 5) }] },
  { id: "spu-laptop-1", categoryId: "cat-digital-laptop", title: "SDKWork Book 14 轻薄本", priceCny: 5499, sales: 860, description: "14 英寸 2.8K 屏,标压处理器。", shopId: "shop-1", imageUrl: artImage("Book 14", 1), images: [artImage("Book 14", 1), artImage("Book 14 键盘", 0)], skus: [{ id: "sku-book-16", title: "16GB+512GB", priceCny: 5499, stock: 40, imageUrl: artImage("16G+512G", 1) }, { id: "sku-book-32", title: "32GB+1TB", priceCny: 7299, stock: 15, imageUrl: artImage("32G+1T", 2) }] },
  { id: "spu-chair-1", categoryId: "cat-home", title: "人体工学椅 Pro", priceCny: 1299, sales: 2200, description: "全网面,4D 扶手。", shopId: "shop-1", imageUrl: artImage("工学椅 Pro", 2), images: [artImage("工学椅 Pro", 2)], skus: [{ id: "sku-chair-black", title: "黑色", priceCny: 1299, stock: 60, imageUrl: artImage("黑色", 0) }] },
  { id: "spu-rice-1", categoryId: "cat-food", title: "东北五常大米 10kg", priceCny: 89, sales: 9000, description: "当年新米。", shopId: "shop-1", imageUrl: artImage("五常大米", 3), images: [artImage("五常大米", 3)], skus: [{ id: "sku-rice-10", title: "10kg 装", priceCny: 89, stock: 500, imageUrl: artImage("10kg", 3) }] },
  { id: "spu-phone-3", categoryId: "cat-digital-phone", title: "SDKWork Phone Ultra 影像旗舰", priceCny: 6999, sales: 500, description: "一英寸大底,卫星通信。", shopId: "shop-1", imageUrl: artImage("Phone Ultra", 5), images: [artImage("Phone Ultra", 5), artImage("Ultra 影像", 2)], skus: [{ id: "sku-ultra-ti", title: "钛金属", priceCny: 6999, stock: 10, imageUrl: artImage("钛金属", 5) }] },
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
const driveSessionNodeBySessionId = new Map();
let afterSalesSeq = 0;

// Wire-contract create body per the commerce app-api OpenAPI
// (CreateAfterSalesRequest): every field is required server-side.
function validateAfterSalesCreateBody(body) {
  const missing = [];
  if (!body.orderId) missing.push("orderId");
  if (!body.afterSalesType) missing.push("afterSalesType");
  if (!body.reasonCode) missing.push("reasonCode");
  if (body.requestedAmount === undefined || body.requestedAmount === null || body.requestedAmount === "") missing.push("requestedAmount");
  if (!body.currencyCode) missing.push("currencyCode");
  if (!Array.isArray(body.items) || body.items.length === 0) missing.push("items");
  return missing;
}

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

// ── IM (sdkwork-im app-api shape): notifications + customer-service chat ──
const notifications = [
  {
    notificationId: "ntf-welcome",
    sourceEventId: "evt-welcome",
    sourceEventType: "system.welcome",
    category: "system",
    channel: "inbox",
    recipientId: "dev-buyer",
    recipientKind: "buyer",
    status: "unread",
    title: "欢迎使用 SDKWork 商城",
    body: "订单动态、物流提醒与优惠活动都会通过消息通知您。",
    requestedAt: new Date(Date.now() - 86400_000).toISOString(),
    dispatchedAt: new Date(Date.now() - 86400_000).toISOString(),
  },
];
function pushNotification(input) {
  const notification = {
    notificationId: nextId("ntf"),
    sourceEventId: nextId("evt"),
    sourceEventType: input.sourceEventType,
    category: input.category ?? "trade",
    channel: "inbox",
    recipientId: "dev-buyer",
    recipientKind: "buyer",
    status: "unread",
    title: input.title,
    body: input.body ?? "",
    requestedAt: new Date().toISOString(),
    dispatchedAt: new Date().toISOString(),
  };
  notifications.unshift(notification);
  return notification;
}

const csAgent = { id: "agent-1", name: "客服小雅", online: true };
const csConversations = [
  { id: "cs-conv-1", title: "官方客服", agentId: csAgent.id, agentName: csAgent.name, unread: 0, lastMessageAt: new Date().toISOString() },
];
const csMessages = new Map();
csMessages.set("cs-conv-1", [
  { id: nextId("msg"), role: "agent", content: "您好，我是 SDKWork 客服小雅，有任何问题都可以随时咨询～", sentAt: new Date().toISOString() },
]);

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

  // ── auth (IAM session contract, dev double) ──
  if (p === "POST /app/v3/api/auth/sessions") {
    const principal = body.username || body.phone || body.email;
    if (!principal || !body.password) {
      return { code: 40001, message: "请输入账号与密码" };
    }
    // Dev double: every credential pair is accepted; tokens are static.
    return ok({
      accessToken: "mock-access-token",
      authToken: "mock-auth-token",
      refreshToken: "mock-refresh-token",
      sessionId: nextId("session"),
      userId: `user-${principal}`,
      context: {
        tenantId: "100001",
        userId: `user-${principal}`,
        organizationId: "0",
        organizationName: "SDKWork",
        appId: "sdkwork-mall",
        environment: "development",
        deploymentMode: "standalone",
        authLevel: "password",
        loginScope: "app",
        dataScope: [],
        permissionScope: [],
      },
    });
  }
  if (p === "DELETE /app/v3/api/auth/sessions/current") return ok({});

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
    pushNotification({ sourceEventType: "order.created", title: "下单成功提醒", body: `订单 ${order.id} 已提交，共 ${order.quantity} 件商品，等待支付。` });
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
    return order ? ok({ orderId: order.id, subject: order.subject, status: orderStatus(order), totalAmount: order.totalAmountCny, paidAmount: order.paid ? order.totalAmountCny : null, paymentMethod: order.paymentMethod, createdAt: order.createdAt, shipmentIds: order.paid ? [shipmentFor(order).shipment.id] : [], items: order.items.map((item) => ({ id: item.id, orderItemId: item.id, priceCny: item.priceCny, quantity: item.quantity, sku: { name: item.sku?.name ?? item.sku?.title }, spu: { id: item.spuId, imageUrl: item.spu?.imageUrl, title: item.spu?.title } })) }) : { code: 40401, message: "order not found" };
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
    pushNotification({ sourceEventType: "order.paid", title: "支付成功提醒", body: `订单 ${order.id} 已完成支付（${body.paymentMethod ?? "线上支付"}），商家将尽快发货。` });
    return ok({ paymentId: order.paymentId, status: "PROCESSING" });
  }
  const receiptMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/receipt_confirmations$/u);
  if (receiptMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === receiptMatch[1]);
    order.receiptConfirmed = true;
    pushNotification({ sourceEventType: "order.received", title: "确认收货提醒", body: `订单 ${order.id} 已确认收货，欢迎评价晒单。` });
    return ok({});
  }
  const cancelMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/cancellations$/u);
  if (cancelMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === cancelMatch[1]);
    order.cancelled = true;
    pushNotification({ sourceEventType: "order.cancelled", title: "订单取消提醒", body: `订单 ${order.id} 已取消，如有疑问请联系客服。` });
    return ok({});
  }

  // ── im (sdkwork-im app-api): notifications + customer-service chat ──
  if (p === "GET /app/v3/api/notifications") {
    const pageSize = Math.max(1, Number(query.get("page_size") ?? 20));
    const cursor = query.get("cursor");
    let start = 0;
    if (cursor) {
      const cursorIndex = notifications.findIndex((entry) => entry.notificationId === cursor);
      start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }
    const rows = notifications.slice(start, start + pageSize);
    const nextCursor = rows.length === pageSize && start + pageSize < notifications.length
      ? rows[rows.length - 1].notificationId
      : undefined;
    return ok({ items: rows, pageInfo: { mode: "cursor", nextCursor, total: notifications.length } });
  }
  const notificationMatch = path.match(/^\/app\/v3\/api\/notifications\/([^/]+)$/u);
  if (notificationMatch && method === "GET") {
    const notification = notifications.find((entry) => entry.notificationId === notificationMatch[1]);
    if (notification) {
      notification.status = "read";
      return ok(notification);
    }
    return { code: 40401, message: "notification not found" };
  }
  if (p === "POST /app/v3/api/notifications/requests") {
    return ok(pushNotification({
      sourceEventType: body.sourceEventType ?? "buyer.request",
      category: body.category ?? "notice",
      title: body.title ?? "消息提醒",
      body: body.body ?? "",
    }));
  }

  if (p === "GET /app/v3/api/im/chat/conversations") {
    for (const conversation of csConversations) {
      conversation.unread = (csMessages.get(conversation.id) ?? []).filter((message) => message.role === "agent" && !message.read).length;
    }
    return ok({ items: csConversations.map((conversation) => ({ ...conversation, lastMessage: (csMessages.get(conversation.id) ?? []).at(-1)?.content ?? "" })), pageInfo: { page: 1, total: csConversations.length } });
  }
  const csMessagesMatch = path.match(/^\/app\/v3\/api\/im\/chat\/conversations\/([^/]+)\/messages$/u);
  if (csMessagesMatch && method === "GET") {
    const rows = csMessages.get(csMessagesMatch[1]) ?? [];
    return ok({ items: rows.map((message) => ({ ...message, read: true })), pageInfo: { page: 1, total: rows.length } });
  }
  const csSendMatch = path.match(/^\/app\/v3\/api\/im\/chat\/conversations\/([^/]+)\/messages$/u);
  if (csSendMatch && method === "POST") {
    const content = String(body.content ?? "").trim();
    if (!content) return { code: 40001, message: "消息内容不能为空" };
    const messages = csMessages.get(csSendMatch[1]) ?? [];
    messages.push({ id: nextId("msg"), role: "buyer", content, sentAt: new Date().toISOString() });
    // Mock agent: acknowledge instantly so the conversation feels alive.
    const reply = content.includes("退款") || content.includes("退货")
      ? "收到您的售后需求，请提供订单号，我们会尽快为您处理退换款。"
      : content.includes("发货") || content.includes("物流")
        ? "商品下单后 48 小时内发货，可在「我的-物流」查看实时轨迹。"
        : "收到啦～已为您记录，客服小雅会尽快跟进您的问题。";
    messages.push({ id: nextId("msg"), role: "agent", content: reply, sentAt: new Date().toISOString() });
    csMessages.set(csSendMatch[1], messages);
    const conversation = csConversations.find((entry) => entry.id === csSendMatch[1]);
    if (conversation) conversation.lastMessageAt = new Date().toISOString();
    return ok({ accepted: true });
  }
  const csReadMatch = path.match(/^\/app\/v3\/api\/im\/chat\/conversations\/([^/]+)\/read$/u);
  if (csReadMatch && method === "POST") {
    for (const message of csMessages.get(csReadMatch[1]) ?? []) {
      message.read = true;
    }
    const conversation = csConversations.find((entry) => entry.id === csReadMatch[1]);
    if (conversation) conversation.unread = 0;
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
    const orderIdFilter = query.get("order_id");
    const page = Math.max(1, Number(query.get("page") ?? 1));
    const pageSize = Math.max(1, Number(query.get("page_size") ?? 20));
    let rows = [...afterSalesRequests];
    if (orderIdFilter) rows = rows.filter((request) => request.orderId === orderIdFilter);
    const total = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ items: rows, pageInfo: { page, total } });
  }
  if (p === "POST /app/v3/api/after_sales/requests") {
    const missing = validateAfterSalesCreateBody(body);
    if (missing.length > 0) {
      return { code: 40001, message: `售后申请缺少必填字段: ${missing.join(", ")}` };
    }
    const order = orders.find((entry) => entry.id === body.orderId);
    if (!order) return { code: 40401, message: "order not found" };
    afterSalesSeq += 1;
    const request = {
      id: nextId("as"),
      afterSalesNo: `AS${String(100000 + afterSalesSeq)}`,
      orderId: body.orderId,
      afterSalesType: body.afterSalesType,
      status: "PENDING",
      reasonCode: body.reasonCode,
      description: body.description ?? "",
      requestedAmount: String(body.requestedAmount),
      currencyCode: body.currencyCode,
      items: body.items,
      createdAt: new Date().toISOString(),
    };
    afterSalesRequests.push(request);
    return ok(request);
  }
  const afterSalesMatch = path.match(/^\/app\/v3\/api\/after_sales\/requests\/([^/]+)$/u);
  if (afterSalesMatch && method === "GET") {
    const request = afterSalesRequests.find((entry) => entry.id === afterSalesMatch[1]);
    return request ? ok(request) : { code: 40401, message: "after-sales request not found" };
  }
  if (afterSalesMatch && method === "PATCH") {
    const request = afterSalesRequests.find((entry) => entry.id === afterSalesMatch[1]);
    if (!request) return { code: 40401, message: "after-sales request not found" };
    if (body.status) request.status = String(body.status).toUpperCase();
    if (body.description !== undefined) request.description = body.description;
    return ok(request);
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

  // ── drive (uploader dev double: presign → raw PUT → register → complete) ──
  if (p === "POST /app/v3/api/drive/uploader/uploads") {
    const sessionId = nextId("usess");
    const nodeId = nextId("node");
    driveSessionNodeBySessionId.set(sessionId, nodeId);
    const session = {
      id: sessionId,
      spaceId: "space-upload",
      nodeId,
      bucket: "mock-bucket",
      objectKey: `uploads/${sessionId}`,
      idempotencyKey: String(body.id ?? sessionId),
      state: "created",
      expiresAtEpochMs: String(Date.now() + 3600_000),
      version: "1",
      storageProviderId: "mock-provider",
      storageUploadId: nextId("supid"),
    };
    const uploadItem = {
      id: nextId("uitem"),
      taskId: String(body.taskId ?? sessionId),
      actorType: "user",
      actorId: "mock-user",
      appId: "sdkwork-mall",
      appResourceType: String(body.appResourceType ?? ""),
      appResourceId: String(body.appResourceId ?? ""),
      uploadProfileCode: String(body.uploadProfileCode ?? "image"),
      fileFingerprint: String(body.fileFingerprint ?? ""),
      spaceId: session.spaceId,
      nodeId,
      uploadSessionId: sessionId,
      storageProviderId: session.storageProviderId,
      storageUploadId: session.storageUploadId,
      originalFileName: String(body.originalFileName ?? "upload.bin"),
      fileExtension: "",
      contentType: String(body.contentType ?? "application/octet-stream"),
      contentTypeGroup: "image",
      detectedContentType: body.contentType,
      contentLength: String(body.contentLength ?? "0"),
      checksumSha256Hex: body.checksumSha256Hex,
      chunkSizeBytes: String(body.chunkSizeBytes ?? "5242880"),
      totalParts: "1",
      uploadedPartsCount: "0",
      uploadedBytes: "0",
      status: "created",
    };
    return ok({ uploadItem, uploadSession: session });
  }
  const presignMatch = path.match(/^\/app\/v3\/api\/drive\/upload_sessions\/([^/]+)\/parts\/(\d+)$/u);
  if (presignMatch && method === "PUT") {
    const partNo = Number(presignMatch[2]);
    return ok({
      uploadUrl: `/app/v3/api/__mock_storage/${presignMatch[1]}/${partNo}`,
      expiresAtEpochMs: String(Date.now() + 600_000),
      method: "PUT",
      headers: {},
      partNo,
      uploadId: presignMatch[1],
    });
  }
  const partRegisterMatch = path.match(/^\/app\/v3\/api\/drive\/uploader\/uploads\/([^/]+)\/parts\/(\d+)$/u);
  if (partRegisterMatch && method === "POST") {
    return ok({
      id: nextId("upart"),
      uploadItemId: partRegisterMatch[1],
      partNo: Number(partRegisterMatch[2]),
      etag: String(body.etag ?? ""),
      sizeBytes: String(body.sizeBytes ?? "0"),
      status: "uploaded",
    });
  }
  const completeMatch = path.match(/^\/app\/v3\/api\/drive\/upload_sessions\/([^/]+)\/complete$/u);
  if (completeMatch && method === "POST") {
    return ok({
      id: completeMatch[1],
      spaceId: "space-upload",
      nodeId: driveSessionNodeBySessionId.get(completeMatch[1]) ?? nextId("node"),
      bucket: "mock-bucket",
      objectKey: `uploads/${completeMatch[1]}`,
      idempotencyKey: completeMatch[1],
      state: "completed",
      expiresAtEpochMs: String(Date.now() + 3600_000),
      version: "2",
      storageProviderId: "mock-provider",
      storageUploadId: nextId("supid"),
    });
  }

  return { code: 40401, message: `mock gateway: no route for ${p}` };
}

const server = http.createServer(async (req, res) => {
  // Raw storage sink for the drive uploader presigned PUT: responds with the
  // ETag header the composed uploader reads back, without envelope wrapping.
  const storageMatch = (req.url ?? "").match(/^\/app\/v3\/api\/__mock_storage\/[^/]+\/\d+$/u);
  if (req.method === "PUT" && storageMatch) {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, {
        etag: `"mock-${Date.now().toString(36)}"`,
        "access-control-allow-origin": "*",
      });
      res.end();
    });
    return;
  }
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
