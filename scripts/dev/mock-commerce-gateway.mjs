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

/**
 * Paginates one in-memory collection with the canonical v3 page envelope
 * (`pageInfo.totalItems` as an int64 string). Returning the legacy `total`
 * number here made the dev double mask the storefront's broken page reader.
 */
function pageOf(items, page, pageSize) {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pageInfo: {
      mode: "offset",
      page,
      pageSize,
      totalItems: String(total),
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/** Canonical sort tokens (`price-asc`/`price-desc`/`newest`) plus legacy aliases. */
function sortProductRows(rows, sort) {
  if (sort === "price-asc" || sort === "price_asc") {
    return [...rows].sort((a, b) => a.priceCny - b.priceCny);
  }
  if (sort === "price-desc" || sort === "price_desc") {
    return [...rows].sort((a, b) => b.priceCny - a.priceCny);
  }
  if (sort === "newest") {
    return [...rows].reverse();
  }
  if (sort === "sales") {
    return [...rows].sort((a, b) => b.sales - a.sales);
  }
  return rows;
}

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
  { id: "spu-phone-1", categoryId: "cat-digital-phone", title: "SDKWork Phone X1 旗舰手机 12GB+256GB", priceCny: 3999, sales: 1200, description: "6.7 英寸 OLED 屏,5000mAh 电池,旗舰芯片。", shopId: "shop-1", imageUrl: artImage("Phone X1", 0), images: [artImage("Phone X1 正面", 0), artImage("Phone X1 背面", 3), artImage("Phone X1 影像", 5)], attributes: [{ attributeId: "attr-color", attributeNo: "color", attributeName: "配色", displayValue: "曜石黑" }], skus: [{ id: "sku-phone-black", title: "曜石黑", priceCny: 3999, stock: 50, imageUrl: artImage("曜石黑", 0), attributeValues: [{ attributeId: "attr-color", attributeNo: "color", attributeValueId: "color-obsidian", valueCode: "obsidian", displayValue: "曜石黑" }] }, { id: "sku-phone-white", title: "皓月白", priceCny: 4099, stock: 30, imageUrl: artImage("皓月白", 4), attributeValues: [{ attributeId: "attr-color", attributeNo: "color", attributeValueId: "color-white", valueCode: "white", displayValue: "皓月白" }] }] },
  { id: "spu-phone-2", categoryId: "cat-digital-phone", title: "SDKWork Phone Lite 轻薄手机", priceCny: 1999, sales: 3400, description: "轻薄机身,长续航。", shopId: "shop-1", imageUrl: artImage("Phone Lite", 4), images: [artImage("Phone Lite", 4)], skus: [{ id: "sku-lite-blue", title: "远峰蓝", priceCny: 1999, stock: 80, imageUrl: artImage("远峰蓝", 5) }] },
  { id: "spu-laptop-1", categoryId: "cat-digital-laptop", title: "SDKWork Book 14 轻薄本", priceCny: 5499, sales: 860, description: "14 英寸 2.8K 屏,标压处理器。", shopId: "shop-1", imageUrl: artImage("Book 14", 1), images: [artImage("Book 14", 1), artImage("Book 14 键盘", 0)], attributes: [{ attributeId: "attr-storage", attributeNo: "storage", attributeName: "存储容量", displayValue: "16GB+512GB" }], skus: [{ id: "sku-book-16", title: "16GB+512GB", priceCny: 5499, stock: 40, imageUrl: artImage("16G+512G", 1), attributeValues: [{ attributeId: "attr-storage", attributeNo: "storage", attributeValueId: "storage-16-512", valueCode: "16-512", displayValue: "16GB+512GB" }] }, { id: "sku-book-32", title: "32GB+1TB", priceCny: 7299, stock: 15, imageUrl: artImage("32G+1T", 2), attributeValues: [{ attributeId: "attr-storage", attributeNo: "storage", attributeValueId: "storage-32-1t", valueCode: "32-1t", displayValue: "32GB+1TB" }] }] },
  { id: "spu-chair-1", categoryId: "cat-home", title: "人体工学椅 Pro", priceCny: 1299, sales: 2200, description: "全网面,4D 扶手。", shopId: "shop-1", imageUrl: artImage("工学椅 Pro", 2), images: [artImage("工学椅 Pro", 2)], skus: [{ id: "sku-chair-black", title: "黑色", priceCny: 1299, stock: 60, imageUrl: artImage("黑色", 0) }] },
  { id: "spu-rice-1", categoryId: "cat-food", title: "东北五常大米 10kg", priceCny: 89, sales: 9000, description: "当年新米。", shopId: "shop-1", imageUrl: artImage("五常大米", 3), images: [artImage("五常大米", 3)], skus: [{ id: "sku-rice-10", title: "10kg 装", priceCny: 89, stock: 500, imageUrl: artImage("10kg", 3) }] },
  { id: "spu-phone-3", categoryId: "cat-digital-phone", title: "SDKWork Phone Ultra 影像旗舰", priceCny: 6999, sales: 500, description: "一英寸大底,卫星通信。", shopId: "shop-1", imageUrl: artImage("Phone Ultra", 5), images: [artImage("Phone Ultra", 5), artImage("Ultra 影像", 2)], skus: [{ id: "sku-ultra-ti", title: "钛金属", priceCny: 6999, stock: 10, imageUrl: artImage("钛金属", 5) }] },
  // One shelf's worth of products per default CMS floor query (家电/服饰/护肤),
  // so the home floors are distinct in the dev double instead of all falling
  // back to the same six products.
  { id: "spu-appliance-ac", categoryId: "cat-home", title: "智能变频空调 1.5匹 家电", priceCny: 3299, sales: 420, description: "一级能效,静音速冷。", shopId: "shop-1", imageUrl: artImage("变频空调", 2), images: [artImage("变频空调", 2)], skus: [{ id: "sku-ac-1", title: "1.5匹 白色", priceCny: 3299, stock: 25, imageUrl: artImage("1.5匹", 2) }] },
  { id: "spu-appliance-fridge", categoryId: "cat-home", title: "十字对开门冰箱 520L 家电", priceCny: 4599, sales: 310, description: "风冷无霜,一级能效。", shopId: "shop-1", imageUrl: artImage("对开门冰箱", 0), images: [artImage("对开门冰箱", 0)], skus: [{ id: "sku-fridge-1", title: "520L 星岩灰", priceCny: 4599, stock: 18, imageUrl: artImage("520L", 0) }] },
  { id: "spu-appliance-washer", categoryId: "cat-home", title: "滚筒洗衣机 10kg 家电", priceCny: 2799, sales: 380, description: "洗烘一体,除菌螨。", shopId: "shop-1", imageUrl: artImage("滚筒洗衣机", 1), images: [artImage("滚筒洗衣机", 1)], skus: [{ id: "sku-washer-1", title: "10kg 白色", priceCny: 2799, stock: 22, imageUrl: artImage("10kg", 1) }] },
  { id: "spu-fashion-tee", categoryId: "cat-home", title: "纯棉基础圆领 T恤 服饰", priceCny: 99, sales: 8600, description: "260g 重磅纯棉,不易变形。", shopId: "shop-1", imageUrl: artImage("纯棉T恤", 4), images: [artImage("纯棉T恤", 4)], skus: [{ id: "sku-tee-m", title: "白色 M", priceCny: 99, stock: 200, imageUrl: artImage("白色M", 4) }, { id: "sku-tee-l", title: "白色 L", priceCny: 99, stock: 160, imageUrl: artImage("白色L", 4) }] },
  { id: "spu-fashion-jeans", categoryId: "cat-home", title: "直筒水洗牛仔裤 服饰", priceCny: 259, sales: 2100, description: "弹力舒适,四季可穿。", shopId: "shop-1", imageUrl: artImage("水洗牛仔裤", 5), images: [artImage("水洗牛仔裤", 5)], skus: [{ id: "sku-jeans-30", title: "深蓝 30", priceCny: 259, stock: 90, imageUrl: artImage("深蓝30", 5) }] },
  { id: "spu-fashion-dress", categoryId: "cat-home", title: "法式碎花连衣裙 服饰", priceCny: 399, sales: 1200, description: "收腰显瘦,垂坠不易皱。", shopId: "shop-1", imageUrl: artImage("碎花连衣裙", 3), images: [artImage("碎花连衣裙", 3)], skus: [{ id: "sku-dress-s", title: "碎花 S", priceCny: 399, stock: 60, imageUrl: artImage("碎花S", 3) }] },
  { id: "spu-beauty-serum", categoryId: "cat-home", title: "玻尿酸多重保湿精华 护肤", priceCny: 299, sales: 5400, description: "5 重玻尿酸,清爽不黏腻。", shopId: "shop-1", imageUrl: artImage("保湿精华", 5), images: [artImage("保湿精华", 5)], skus: [{ id: "sku-serum-30", title: "30ml", priceCny: 299, stock: 300, imageUrl: artImage("30ml", 5) }] },
  { id: "spu-beauty-cream", categoryId: "cat-home", title: "神经酰胺修护面霜 护肤", priceCny: 219, sales: 3300, description: "屏障修护,四季可用。", shopId: "shop-1", imageUrl: artImage("修护面霜", 1), images: [artImage("修护面霜", 1)], skus: [{ id: "sku-cream-50", title: "50g", priceCny: 219, stock: 210, imageUrl: artImage("50g", 1) }] },
  { id: "spu-beauty-cleanser", categoryId: "cat-home", title: "氨基酸温和洁面乳 护肤", priceCny: 89, sales: 7200, description: "弱酸性,洗后不紧绷。", shopId: "shop-1", imageUrl: artImage("氨基酸洁面", 3), images: [artImage("氨基酸洁面", 3)], skus: [{ id: "sku-cleanser-120", title: "120g", priceCny: 89, stock: 420, imageUrl: artImage("120g", 3) }] },
];

const shop = { id: "shop-1", name: "SDKWork 官方旗舰店", logoUrl: "", rating: 4.9, status: "active" };

const addresses = [
  {
    id: "addr-1",
    name: "张三",
    phone: "13800000000",
    province: "浙江省",
    city: "杭州市",
    district: "西湖区",
    detail: "文一路 96 号",
    tag: "home",
    isDefault: true,
  },
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
const shippedOrderIds = new Set();
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

const MOCK_WALLET_BALANCE = 1280.5;
const MOCK_POINTS_BALANCE = 8600;
const MOCK_POINTS_PER_CNY = 100;

/**
 * Applies the checkout offsets the buyer selected.
 *
 * The session quote and the created order share this calculation so the
 * displayed payable amount is the one the order is created for.
 */
function computeCheckoutAmounts(selection, body = {}) {
  const subtotal = cartTotal(selection);
  const coupon = userCoupons.find((entry) => entry.id === body.couponId);
  const couponDiscount =
    coupon && subtotal >= (coupon.minSpendCny ?? 0)
      ? Math.min(coupon.discountAmountCny ?? 0, subtotal)
      : 0;
  const appliedDiscount = discountApplications
    .filter((entry) => !entry.consumed)
    .reduce((sum, entry) => sum + (entry.discountAmountCny ?? 0), 0);
  const walletApplied = body.useWallet
    ? Math.min(MOCK_WALLET_BALANCE, Math.max(0, subtotal - couponDiscount - appliedDiscount))
    : 0;
  const pointsApplied = body.usePoints
    ? Math.min(
        MOCK_POINTS_BALANCE / MOCK_POINTS_PER_CNY,
        Math.max(0, subtotal - couponDiscount - appliedDiscount - walletApplied),
      )
    : 0;
  const discount = couponDiscount + appliedDiscount + walletApplied + pointsApplied;
  return {
    couponDiscount,
    discount,
    payable: Math.max(0, subtotal - discount),
    subtotal,
  };
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

/**
 * Backend-api fixtures for the admin/merchant consoles.
 *
 * The dev double originally served only `app/v3/api`; the admin product console
 * and the merchant workbench therefore could not be exercised at all. These
 * routes expose the same in-memory catalog/order data through the backend
 * contract (`/backend/v3/api`) with the fields those consoles read.
 */
function backendPage(rows, query) {
  const page = Number(query.get("page") ?? query.get("pageNum") ?? 1) || 1;
  const pageSize = Number(query.get("page_size") ?? query.get("pageSize") ?? 20) || 20;
  const result = pageOf(rows, page, pageSize);
  result.pageInfo.total = rows.length;
  result.content = result.items;
  return result;
}

function adminProductRow(spu) {
  const prices = spu.skus?.map((sku) => sku.priceCny) ?? [spu.priceCny];
  return {
    id: spu.id,
    spuNo: spu.id,
    name: spu.title,
    title: spu.title,
    categoryId: spu.categoryId,
    categoryIds: [spu.categoryId],
    brandId: "brand-sdkwork",
    brand: "SDKWork",
    description: spu.description ?? "",
    images: spu.images ?? [],
    attributes: spu.attributes ?? [],
    status: String(spu.status ?? "PUBLISHED").toUpperCase(),
    version: 1,
    mainImageUrl: spu.imageUrl,
    imageUrl: spu.imageUrl,
    minPriceCny: Math.min(...prices),
    maxPriceCny: Math.max(...prices),
    priceCny: spu.priceCny,
    sales: spu.sales ?? 0,
    stock: spu.skus?.reduce((sum, sku) => sum + (sku.stock ?? 0), 0) ?? 0,
    shopId: spu.shopId ?? shop.id,
    shopName: shop.name,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-11-19T00:00:00.000Z",
  };
}

function adminSkuRows() {
  return spus.flatMap((spu) =>
    (spu.skus ?? []).map((sku) => ({
      id: sku.id,
      skuNo: sku.id,
      productId: spu.id,
      spuId: spu.id,
      productTitle: spu.title,
      title: sku.title,
      name: sku.title,
      priceCny: sku.priceCny,
      priceAmount: sku.priceCny,
      defaultPriceAmount: sku.priceCny,
      defaultCurrencyCode: "CNY",
      currencyCode: "CNY",
      stock: sku.stock ?? 0,
      status: "ACTIVE",
      version: 1,
      imageUrl: sku.imageUrl,
      image: { url: sku.imageUrl },
      attributes: sku.attributeValues ?? [],
      attributeValues: sku.attributeValues ?? [],
      updatedAt: "2026-11-19T00:00:00.000Z",
    })),
  );
}

function handleBackend(method, path, query, body) {
  const p = `${method} ${path}`;

  if (p === "GET /backend/v3/api/catalog/products") {
    let rows = spus.map(adminProductRow);
    const status = query.get("status");
    if (status) {
      rows = rows.filter((row) => row.status === status || row.status === status.toUpperCase());
    }
    return ok(backendPage(rows, query));
  }
  if (method === "POST" && path === "/backend/v3/api/catalog/products") {
    const id = nextId("spu-admin");
    const created = {
      id,
      spuNo: id,
      title: body.title ?? body.name ?? "新商品",
      name: body.title ?? body.name ?? "新商品",
      categoryId: body.categoryId ?? categories[0].id,
      brandId: body.brandId ?? "brand-sdkwork",
      status: body.status ?? "DRAFT",
      version: 1,
      priceCny: Number(body.priceCny ?? body.price ?? 0),
      mainImageUrl: body.mainImageUrl ?? artImage("New", 0),
      shopId: shop.id,
      shopName: shop.name,
      skus: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    spus.push(created);
    return ok(adminProductRow(created));
  }
  const productMatch = path.match(/^\/backend\/v3\/api\/catalog\/products\/([^/]+)$/u);
  if (productMatch) {
    const spu = spus.find((entry) => entry.id === decodeURIComponent(productMatch[1]));
    if (!spu) {
      return { code: 40401, message: "商品不存在" };
    }
    if (method === "GET") {
      return ok(adminProductRow(spu));
    }
    if (method === "PATCH" || method === "PUT") {
      Object.assign(spu, {
        title: body.title ?? body.name ?? spu.title,
        categoryId: body.categoryId ?? spu.categoryId,
        priceCny: body.priceCny != null ? Number(body.priceCny) : spu.priceCny,
        updatedAt: new Date().toISOString(),
      });
      return ok(adminProductRow(spu));
    }
    if (method === "DELETE") {
      const index = spus.indexOf(spu);
      spus.splice(index, 1);
      return ok({ deleted: true });
    }
  }
  const publishMatch = path.match(/^\/backend\/v3\/api\/catalog\/products\/([^/]+)\/(publish|archive)$/u);
  if (publishMatch) {
    const spu = spus.find((entry) => entry.id === decodeURIComponent(publishMatch[1]));
    if (!spu) {
      return { code: 40401, message: "商品不存在" };
    }
    return ok({ ...adminProductRow(spu), status: publishMatch[2] === "publish" ? "PUBLISHED" : "ARCHIVED" });
  }

  if (p === "GET /backend/v3/api/catalog/skus") {
    let rows = adminSkuRows();
    const productId = query.get("productId") ?? query.get("spuId") ?? query.get("product_id");
    if (productId) {
      rows = rows.filter((row) => row.productId === productId);
    }
    return ok(backendPage(rows, query));
  }
  if (method === "POST" && path === "/backend/v3/api/catalog/skus") {
    const id = nextId("sku-admin");
    return ok({
      id,
      skuNo: id,
      productId: body.productId ?? body.spuId ?? spus[0].id,
      title: body.title ?? body.name ?? "新规格",
      priceCny: Number(body.priceCny ?? body.price ?? 0),
      stock: Number(body.stock ?? 0),
      status: body.status ?? "DRAFT",
      version: 1,
    });
  }
  const skuMatch = path.match(/^\/backend\/v3\/api\/catalog\/skus\/([^/]+)$/u);
  if (skuMatch) {
    const sku = adminSkuRows().find((entry) => entry.id === decodeURIComponent(skuMatch[1]));
    if (!sku) {
      return { code: 40401, message: "规格不存在" };
    }
    return ok(method === "PUT" || method === "PATCH" ? { ...sku, ...body, version: sku.version + 1 } : sku);
  }

  if (p === "GET /backend/v3/api/catalog/categories") {
    return ok(backendPage(categories.map((category, index) => ({
      id: category.id,
      categoryNo: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
      sortOrder: index,
      level: category.parentId ? 2 : 1,
      status: "ENABLED",
      version: 1,
    })), query));
  }
  if (p === "GET /backend/v3/api/catalog/brands") {
    return ok(backendPage([{
      id: "brand-sdkwork",
      brandNo: "SDKWORK",
      name: "SDKWork",
      logoUrl: artImage("SDKWork", 0),
      status: "ENABLED",
      version: 1,
    }], query));
  }
  if (p === "GET /backend/v3/api/catalog/attributes") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/catalog/category_attributes") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/catalog/attribute_values") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/catalog/media") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/catalog/price_lists") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/reports/commerce_overview") {
    return ok({
      gmv: 123456.78,
      orderCount: 42,
      newUsers: 8,
      pendingReview: 3,
      gmvCny: 123456.78,
      newUserCount: 8,
      pendingReviewCount: 3,
      refundAmountCny: 1200,
      todayGmvCny: 3999,
    });
  }
  if (p === "GET /backend/v3/api/shops") {
    return ok(backendPage([{
      id: shop.id,
      shopNo: shop.id,
      name: shop.name,
      status: "active",
      reviewStatus: "approved",
      operationStatus: "active",
      ownerName: "张三",
      productCount: spus.length,
      createdAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    }], query));
  }
  if (p === "GET /backend/v3/api/orders") {
    return ok(backendPage([{
      id: "order-demo-1",
      orderNo: "order-demo-1",
      status: "paid",
      subject: "SDKWork Phone X1 旗舰手机 12GB+256GB",
      totalAmount: 3999,
      buyerName: "开发买家",
      createdAt: "2026-11-19T00:00:00.000Z",
    }], query));
  }
  if (p === "GET /backend/v3/api/after_sales/requests") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/memberships/plans") {
    return ok(backendPage([
      { id: "plan-gold-month", name: "黄金月度套餐", price: 39, pointAmount: 500, durationDays: 30, status: "active", version: 1 },
      { id: "plan-gold-year", name: "黄金年度套餐", price: 388, pointAmount: 6000, durationDays: 365, status: "active", version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/memberships/packages") {
    return ok(backendPage([
      { id: "plan-gold-month", packageNo: "plan-gold-month", name: "黄金月度套餐", price: 39, pointAmount: 500, durationDays: 30, status: "active", version: 1 },
      { id: "plan-gold-year", packageNo: "plan-gold-year", name: "黄金年度套餐", price: 388, pointAmount: 6000, durationDays: 365, status: "active", version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/memberships/package_groups") {
    return ok(backendPage([
      { id: "group-gold", name: "黄金会员", status: "active", sortWeight: 1, version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/memberships/levels") {
    return ok(backendPage([
      { id: "level-bronze", name: "青铜会员", levelValue: 0, requiredPoints: 0, status: "active", version: 1 },
      { id: "level-silver", name: "白银会员", levelValue: 1, requiredPoints: 2000, status: "active", version: 1 },
      { id: "level-gold", name: "黄金会员", levelValue: 2, requiredPoints: 5000, status: "active", version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/memberships/benefits") {
    return ok(backendPage([
      { id: "benefit-member-day", name: "会员日 95 折", type: "discount", status: "active", version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/memberships/members") {
    return ok(backendPage([
      {
        id: "member-1",
        userId: "user-demo",
        nickname: "开发会员",
        levelName: "黄金会员",
        status: "active",
        joinedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      },
    ], query));
  }
  if (p === "GET /backend/v3/api/audit/commerce_events") {
    return ok(backendPage([{
      id: "audit-1",
      action: "product.publish",
      operator: "admin",
      target: "spu-phone-1",
      createdAt: "2026-11-19T00:00:00.000Z",
    }], query));
  }
  if (p === "GET /backend/v3/api/audit/entries") {
    return ok(backendPage([{
      id: "audit-1",
      action: "product.publish",
      operator: "admin",
      target: "spu-phone-1",
      createdAt: "2026-11-19T00:00:00.000Z",
    }], query));
  }
  if (p === "GET /backend/v3/api/risk/signals") {
    return ok(backendPage([], query));
  }
  if (p === "GET /backend/v3/api/shops/current") {
    return ok({ ...shop, version: 1, shopNo: shop.id, logoUrl: artImage("Shop", 1) });
  }
  if (p === "GET /backend/v3/api/shops/current/channels") {
    return ok(backendPage([
      { id: "channel-pc", code: "pc", name: "PC 商城", status: "ENABLED", version: 1 },
      { id: "channel-h5", code: "h5", name: "H5 商城", status: "ENABLED", version: 1 },
    ], query));
  }
  if (p === "GET /backend/v3/api/shops/current/dashboard") {
    const salesAmount = orders.reduce((sum, order) => sum + (order.paid ? order.totalAmountCny : 0), 0);
    const lowStock = adminSkuRows().filter((sku) => sku.stock <= 10).length;
    return ok({
      orderCount: orders.length,
      paidOrderCount: orders.filter((order) => order.paid).length,
      productCount: spus.length,
      salesAmountCny: salesAmount,
      todaySales: salesAmount,
      pendingShipment: orders.filter((order) => order.paid && !order.receiptConfirmed).length,
      pendingAfterSales: afterSalesRequests.filter((entry) => entry.status === "PENDING").length,
      productAlerts: lowStock,
      lowStockCount: lowStock,
    });
  }
  if (p === "GET /backend/v3/api/shops/current/products") {
    return ok(backendPage(spus.map(adminProductRow), query));
  }
  if (method === "POST" && path === "/backend/v3/api/shops/current/products") {
    const id = nextId("spu-shop");
    const created = {
      id,
      spuNo: id,
      title: body.title ?? body.name ?? "新商品草稿",
      name: body.title ?? body.name ?? "新商品草稿",
      categoryId: body.categoryId ?? categories[0].id,
      status: "DRAFT",
      version: 1,
      priceCny: 0,
      shopId: shop.id,
      shopName: shop.name,
      skus: [],
      createdAt: new Date().toISOString(),
    };
    spus.push(created);
    return ok(adminProductRow(created));
  }
  const shopPublishMatch = path.match(/^\/backend\/v3\/api\/shops\/current\/products\/([^/]+)\/(publish|unpublish)$/u);
  if (shopPublishMatch) {
    const spu = spus.find((entry) => entry.id === decodeURIComponent(shopPublishMatch[1]));
    if (!spu) {
      return { code: 40401, message: "商品不存在" };
    }
    return ok({ ...adminProductRow(spu), status: shopPublishMatch[2] === "publish" ? "PUBLISHED" : "DRAFT" });
  }
  const fulfillmentMatch = path.match(/^\/backend\/v3\/api\/shops\/current\/orders\/([^/]+)\/fulfillments$/u);
  if (method === "POST" && fulfillmentMatch) {
    const orderId = decodeURIComponent(fulfillmentMatch[1]);
    shippedOrderIds.add(orderId);
    return ok({ id: nextId("fulfill"), orderId, status: "SHIPPED" });
  }
  const adjustmentMatch = path.match(/^\/backend\/v3\/api\/shops\/current\/inventory\/stocks\/([^/]+)\/adjustments$/u);
  if (method === "POST" && adjustmentMatch) {
    return ok({ id: nextId("adj"), stockId: decodeURIComponent(adjustmentMatch[1]), status: "APPLIED" });
  }
  if (p === "GET /backend/v3/api/shops/current/orders") {
    const merchantOrders = orders.length > 0
      ? orders
      : [{
        id: "order-demo-1",
        paid: true,
        cancelled: false,
        totalAmountCny: 3999,
        subject: "SDKWork Phone X1 旗舰手机 12GB+256GB",
        createdAt: "2026-11-19T00:00:00.000Z",
      }];
    return ok(backendPage(merchantOrders.map((order) => ({
      id: order.id,
      orderNo: order.id,
      status: order.cancelled
        ? "CANCELLED"
        : shippedOrderIds.has(order.id)
          ? "SHIPPED"
          : order.paid
            ? "PAID"
            : "PENDING_PAYMENT",
      subject: order.subject,
      totalAmount: order.totalAmountCny,
      buyerName: "开发买家",
      createdAt: order.createdAt,
    })), query));
  }
  if (p === "GET /backend/v3/api/shops/current/inventory/stocks") {
    return ok(backendPage(adminSkuRows().map((sku) => ({
      id: `stock-${sku.id}`,
      skuId: sku.id,
      skuNo: sku.skuNo,
      productId: sku.productId,
      productTitle: sku.productTitle,
      warehouseId: "wh-1",
      availableStock: sku.stock,
      lockedStock: 0,
      version: 1,
    })), query));
  }
  if (p === "GET /backend/v3/api/shops/current/settlements") {
    return ok(backendPage([{
      id: "settle-1",
      settlementNo: "ST-20261119-1",
      amount: "1280.50",
      status: "SETTLED",
      createdAt: "2026-11-19T00:00:00.000Z",
    }], query));
  }
  if (p === "GET /backend/v3/api/shops/current/settlement_profile") {
    return ok({ bankName: "招商银行", bankAccount: "6225****8888", accountName: shop.name, status: "VERIFIED" });
  }
  if (p === "GET /backend/v3/api/shops/current/onboarding") {
    return ok({ status: "APPROVED", shopId: shop.id });
  }

  return { code: 40401, message: `backend route not mocked: ${p}` };
}

async function handle(method, url, body) {
  const path = url.replace(/\?.*$/u, "");
  const query = new URL(url, "http://mock").searchParams;
  const p = `${method} ${path}`;

  if (path.startsWith("/backend/v3/api/")) {
    return handleBackend(method, path, query, body);
  }

  // The merchant workbench talks to the shop app-api (`/app/v3/api/shops/current/*`),
  // not the backend-api. Reuse the same in-memory fixtures so the console is
  // exercisable in the dev double.
  if (path.startsWith("/app/v3/api/shops/current")) {
    return handleBackend(method, path.replace("/app/v3/api", "/backend/v3/api"), query, body);
  }

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
    rows = sortProductRows(rows, query.get("sort"));
    return ok(
      pageOf(
        rows,
        Number(query.get("page") ?? 1),
        Number(query.get("page_size") ?? 20),
      ),
    );
  }
  // ── catalog products (the generated `catalog.products` surface used by
  // the storefront search; same dev-double dataset as spus) ──
  if (p === "GET /app/v3/api/catalog/products") {
    let rows = spus.map(({ skus, ...rest }) => ({ ...rest, skus }));
    const productCategoryId = query.get("category_id");
    if (productCategoryId) {
      const productChildIds = categories.filter((cat) => cat.parentId === productCategoryId).map((cat) => cat.id);
      rows = rows.filter((spu) => spu.categoryId === productCategoryId || productChildIds.includes(spu.categoryId));
    }
    const productShopId = query.get("shop_id");
    if (productShopId) rows = rows.filter((spu) => spu.shopId === productShopId);
    const productQ = query.get("q");
    if (productQ) rows = rows.filter((spu) => spu.title.includes(productQ));
    rows = sortProductRows(rows, query.get("sort"));
    return ok(
      pageOf(
        rows,
        Number(query.get("page") ?? 1),
        Number(query.get("page_size") ?? 20),
      ),
    );
  }
  const productMatch = path.match(/^\/app\/v3\/api\/catalog\/products\/([^/]+)$/u);
  if (method === "GET" && productMatch) {
    const product = spus.find((entry) => entry.id === productMatch[1]);
    if (!product) return { code: 40401, message: "product not found" };
    return ok({ ...product, shopName: shop.name });
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
    if (existing) {
      existing.quantity += body.quantity ?? 1;
      existing.lineTotalCny = existing.priceCny * existing.quantity;
    } else {
      cart.items.push({ id: nextId("cart"), skuId: body.skuId, spuId: body.spuId ?? spu?.id, quantity: body.quantity ?? 1, priceCny: sku.priceCny, lineTotalCny: sku.priceCny * (body.quantity ?? 1), sku: { id: body.skuId, name: sku.title }, spu: { id: spu?.id, title: spu?.title, imageUrl: spu?.imageUrl ?? "" } });
    }
    // "立即购买" scopes checkout by the *created line* id, so the dev double
    // must answer the line rather than the cart id.
    const line = existing ?? cart.items.at(-1);
    return ok({ id: line.id, cartItemId: line.id, item: line });
  }
  const cartItemMatch = path.match(/^\/app\/v3\/api\/cart\/items\/([^/]+)$/u);
  if (cartItemMatch && (method === "PUT" || method === "PATCH")) {
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
    const amounts = computeCheckoutAmounts(selection, body);
    return ok({
      id: nextId("cs"),
      originalAmountCny: amounts.subtotal,
      discountAmountCny: amounts.discount,
      payableAmountCny: amounts.payable,
    });
  }
  const quoteMatch = path.match(/^\/app\/v3\/api\/checkout\/sessions\/([^/]+)\/quotes$/u);
  if (quoteMatch && method === "POST") return ok({ id: nextId("quote") });
  const checkoutOrderMatch = path.match(/^\/app\/v3\/api\/checkout\/sessions\/([^/]+)\/orders$/u);
  if (checkoutOrderMatch && method === "POST") {
    const selection = selectCartItems(body.cartItemIds);
    const amounts = computeCheckoutAmounts(selection, body);
    const order = { id: nextId("order"), paid: false, cancelled: false, receiptConfirmed: false, totalAmountCny: amounts.payable, subtotalAmountCny: amounts.subtotal, discountAmountCny: amounts.discount, subject: selection[0]?.spu?.title ?? "SDKWork 订单", createdAt: new Date().toISOString(), items: selection.map((item) => ({ ...item })), quantity: selection.reduce((sum, item) => sum + item.quantity, 0) };
    orders.push(order);
    if (body.needInvoice && body.invoiceForm) {
      invoices.push({
        id: nextId("inv"),
        orderId: order.id,
        title: body.invoiceForm.title ?? "个人",
        titleType: body.invoiceForm.titleType ?? "personal",
        taxNumber: body.invoiceForm.taxNumber ?? null,
        email: body.invoiceForm.email ?? null,
        amountCny: order.totalAmountCny,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      });
    }
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
    if (!order) return { code: 40401, message: "order not found" };
    return ok({ status: orderStatus(order), statusName: orderStatus(order) });
  }
  const paymentSuccessMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/payment_success$/u);
  if (paymentSuccessMatch && method === "GET") {
    const order = orders.find((entry) => entry.id === paymentSuccessMatch[1]);
    if (!order) return { code: 40401, message: "order not found" };
    return ok({ paid: Boolean(order?.paid), status: orderStatus(order) });
  }
  const paymentsMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/payments$/u);
  if (paymentsMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === paymentsMatch[1]);
    if (!order) return { code: 40401, message: "order not found" };
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
    if (!order) return { code: 40401, message: "order not found" };
    order.receiptConfirmed = true;
    pushNotification({ sourceEventType: "order.received", title: "确认收货提醒", body: `订单 ${order.id} 已确认收货，欢迎评价晒单。` });
    return ok({});
  }
  const cancelMatch = path.match(/^\/app\/v3\/api\/orders\/([^/]+)\/cancellations$/u);
  if (cancelMatch && method === "POST") {
    const order = orders.find((entry) => entry.id === cancelMatch[1]);
    if (!order) return { code: 40401, message: "order not found" };
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
  if (p === "GET /app/v3/api/promotions/offers") {
    // Campaign rows double as the coupon catalog in the dev double: publish the
    // coupon aliases the coupon console reads alongside the activity fields.
    const rows = offers.map((offer, index) => ({
      ...offer,
      canReceive: true,
      couponId: offer.code ?? offer.id,
      name: offer.title,
      status: "available",
      type: "discount",
      typeName: "满减券",
      amount: index % 2 === 0 ? 50 : 20,
      minConsume: index % 2 === 0 ? 300 : 99,
      expireAt: "2026-12-31",
    }));
    return ok({ items: rows, content: rows, pageInfo: { page: 1, total: rows.length } });
  }
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
    const rows = userCoupons.filter((coupon) => coupon.status === "AVAILABLE");
    return ok({ items: rows, content: rows, pageInfo: { page: 1, total: rows.length } });
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
    return ok({ items: invoices, content: invoices, pageInfo: { page: 1, total: invoices.length } });
  }
  if (p === "POST /app/v3/api/invoices") {
    const invoice = {
      id: nextId("inv"),
      title: body.title,
      titleType: body.titleType,
      taxNumber: body.taxNumber ?? body.taxNo ?? null,
      taxNo: body.taxNumber ?? body.taxNo ?? null,
      email: body.email ?? null,
      remark: body.remark ?? null,
      amountCny: body.totalAmount ?? body.amountCny ?? null,
      totalAmount: body.totalAmount ?? body.amountCny ?? null,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
    invoices.push(invoice);
    return ok(invoice);
  }
  const invoiceActionMatch = path.match(/^\/app\/v3\/api\/invoices\/([^/]+)\/(submissions|cancellations)$/u);
  if (method === "POST" && invoiceActionMatch) {
    const invoice = invoices.find((entry) => entry.id === decodeURIComponent(invoiceActionMatch[1]));
    if (!invoice) {
      return { code: 40401, message: "发票不存在" };
    }
    invoice.status = invoiceActionMatch[2] === "submissions" ? "PENDING" : "CANCELLED";
    return ok(invoice);
  }
  const invoiceItemsMatch = path.match(/^\/app\/v3\/api\/invoices\/([^/]+)\/items$/u);
  if (method === "GET" && invoiceItemsMatch) {
    const invoice = invoices.find((entry) => entry.id === decodeURIComponent(invoiceItemsMatch[1]));
    // The invoice detail port treats this payload as a bare array.
    return ok(invoice ? [{
      itemId: "invoice-item-1",
      productName: "商品费用",
      quantity: 1,
      totalAmount: invoice.amountCny ?? 0,
      taxRate: 0.06,
    }] : []);
  }
  const invoiceMatch = path.match(/^\/app\/v3\/api\/invoices\/([^/]+)(?:\/(submit|cancel|download))?$/u);
  if (invoiceMatch && invoiceMatch[1] !== "mine" && invoiceMatch[1] !== "statistics") {
    const invoice = invoices.find((entry) => entry.id === decodeURIComponent(invoiceMatch[1]));
    if (!invoice) {
      return { code: 40401, message: "发票不存在" };
    }
    if (method === "POST" && invoiceMatch[2] === "submit") {
      invoice.status = "PENDING";
      return ok(invoice);
    }
    if (method === "POST" && invoiceMatch[2] === "cancel") {
      invoice.status = "CANCELLED";
      return ok(invoice);
    }
    if (method === "PATCH" || method === "PUT") {
      Object.assign(invoice, {
        title: body.title ?? invoice.title,
        titleType: body.titleType ?? invoice.titleType,
        taxNumber: body.taxNumber ?? body.taxNo ?? invoice.taxNumber,
        taxNo: body.taxNumber ?? body.taxNo ?? invoice.taxNo,
        email: body.email ?? invoice.email,
        amountCny: body.totalAmount ?? body.amountCny ?? invoice.amountCny,
        totalAmount: body.totalAmount ?? body.amountCny ?? invoice.totalAmount,
      });
      return ok(invoice);
    }
    if (method === "GET") {
      return ok({ ...invoice, items: [] });
    }
  }

  // ── wallet (account service paths) ──
  if (p === "GET /app/v3/api/wallet/accounts/cash") return ok({ balanceCny: 1280.5, availableBalance: 1280.5 });
  if (p === "GET /app/v3/api/wallet/accounts/points") return ok({ balance: 8600, availablePoints: 8600, totalPoints: 8600 });
  if (p === "POST /app/v3/api/recharges/orders") {
    const orderId = nextId("recharge-order");
    const amount = body.packageId === "recharge-300" ? 300 : 100;
    const points = body.packageId === "recharge-300" ? 30000 : 10000;
    orders.push({
      id: orderId,
      paid: false,
      cancelled: false,
      receiptConfirmed: false,
      totalAmountCny: amount,
      subject: "钱包充值",
      items: [],
      quantity: 1,
      createdAt: new Date().toISOString(),
    });
    return ok({
      id: orderId,
      orderId,
      amountCny: amount,
      points,
      status: "PENDING",
      cashierUrl: `/payment/cashier?orderId=${orderId}`,
    });
  }
  if (p === "GET /app/v3/api/wallet/ledger_entries/points") {
    return ok({
      content: [
        { id: "point-ledger-1", historyId: "point-ledger-1", summary: "订单奖励", pointsDelta: 120, points: 120, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: "COMPLETED" },
        { id: "point-ledger-2", historyId: "point-ledger-2", summary: "充值赠送", pointsDelta: 500, points: 500, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: "COMPLETED" },
      ],
      items: [
        { id: "point-ledger-1", historyId: "point-ledger-1", summary: "订单奖励", pointsDelta: 120, points: 120, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: "COMPLETED" },
        { id: "point-ledger-2", historyId: "point-ledger-2", summary: "充值赠送", pointsDelta: 500, points: 500, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: "COMPLETED" },
      ],
      pageInfo: { page: 1, total: 2 },
    });
  }
  if (p === "POST /app/v3/api/withdrawals/requests") {
    return ok({ id: nextId("withdraw"), amount: body.amount ?? 100, status: "PENDING" });
  }
  if (p === "POST /app/v3/api/wallet/withdrawals") {
    return ok({ id: nextId("withdraw"), amount: body.amount ?? 100, status: "PENDING" });
  }
  if (p === "GET /app/v3/api/wallet/withdrawals/settings") {
    return ok({
      minAmountCny: 1,
      maxAmountCny: 50000,
      destinations: [
        { code: "ALIPAY", name: "支付宝", enabled: true },
        { code: "BANK", name: "银行卡", enabled: true },
      ],
    });
  }
  if (p === "GET /app/v3/api/wallet/overview") {
    return ok({ cashAvailable: 1280.5, availableBalance: 1280.5, cashFrozen: 0, pointsAvailable: 8600, totalPoints: 8600, hasPayPassword: true });
  }
  if (p === "GET /app/v3/api/wallet/points/summary") return ok({ balance: 8600 });
  if (p === "GET /app/v3/api/wallet/ledger_entries/cash") {
    return ok({ content: [{ id: "ledger-1", summary: "充值", amountCny: 1000, occurredAt: new Date().toISOString() }, { id: "ledger-2", summary: "订单支付", amountCny: -89, occurredAt: new Date().toISOString() }], pageInfo: { page: 1, total: 2 } });
  }
  if (p === "GET /app/v3/api/wallet/points/lots") {
    return ok({ content: [{ id: "lot-1", points: 6000, expiresAt: "2026-12-31" }, { id: "lot-2", points: 2600 }], pageInfo: { page: 1, total: 2 } });
  }
  // ── account / membership (buyer asset console) ──
  if (p === "GET /app/v3/api/partner_join") {
    return ok({
      levels: [{
        levelNo: 1,
        name: "金牌分销伙伴",
        joinFee: "0.00",
        customerRevenueRatio: "8.00",
        joinFeeCommissionRatio: "20.00",
        status: "ACTIVE",
        benefits: [{ code: "commission", name: "客户消费佣金", value: "8%", sort: 1 }],
      }],
      rules: {
        currency: "CNY",
        profitMarginRatio: "15.00",
        minWithdrawalAmount: "100.00",
        joinFeePolicy: "免入驻费",
      },
    });
  }
  if (p === "GET /app/v3/api/partner_join/applications/mine") {
    const application = {
      id: "partner-application-1",
      uuid: "partner-application-1",
      applicantType: "INDIVIDUAL",
      subjectName: "开发买家",
      contactName: "开发买家",
      contactPhone: "13800000000",
      contactEmail: "buyer@example.com",
      targetLevelNo: 1,
      inviteCode: "SDK8F2K",
      inviterPartnerId: null,
      businessIntro: "私域社群推广",
      status: "APPROVED",
      reviewComment: "审核通过",
      reviewedAt: "2026-01-02T00:00:00.000Z",
      approvedPartnerId: "partner-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    return ok({ items: [application], pageInfo: { page: 1, total: 1 } });
  }
  if (p === "GET /app/v3/api/partner_center") {
    // The partner port reads a flat centre record.
    return ok({
      partnerId: "partner-1",
      partnerNo: "P-1001",
      name: "开发买家",
      levelNo: 1,
      levelName: "金牌分销伙伴",
      status: "ACTIVE",
      inviteCode: "SDK8F2K",
      joinedAt: "2026-01-02T00:00:00.000Z",
      parentPartnerName: "",
      directTeamSize: 2,
      teamSize: 5,
      customerCount: 18,
      currency: "CNY",
      availableBalance: "1280.50",
      frozenBalance: "0.00",
      totalCommission: "3560.00",
      withdrawnAmount: "2279.50",
      minWithdrawalAmount: "100.00",
    });
  }
  if (p === "GET /app/v3/api/partner_center/team") {
    return ok({
      items: [{
        partnerId: "partner-2",
        name: "推广伙伴 A",
        levelNo: 1,
        levelName: "金牌分销伙伴",
        status: "ACTIVE",
        joinedAt: "2026-02-01T00:00:00.000Z",
        depth: 1,
        directTeamSize: 0,
        customerCount: 6,
        totalCommission: "320.00",
        availableBalance: "120.00",
      }],
      pageInfo: { page: 1, total: 1 },
    });
  }
  if (p === "GET /app/v3/api/partner_center/commissions") {
    return ok({
      items: [{
        id: "commission-1",
        settlementId: "settle-1",
        eventId: "order-1012",
        sourceType: "order",
        sourceRef: "order-1012",
        baseAmount: "3999.00",
        ratio: "8.00",
        amount: "319.92",
        levelOffset: 1,
        status: "SETTLED",
        computedAt: "2026-11-19T00:00:00.000Z",
        createdAt: "2026-11-19T00:00:00.000Z",
      }],
      pageInfo: { page: 1, total: 1 },
    });
  }
  if (p === "GET /app/v3/api/partner_center/withdrawals") {
    return ok({
      items: [{
        id: "withdraw-1",
        amount: "500.00",
        status: "PAID",
        reviewRemark: "",
        paidAt: "2026-11-01T00:00:00.000Z",
        remark: "",
      }],
      pageInfo: { page: 1, total: 1 },
    });
  }
  if (p === "GET /app/v3/api/accounts/current/summary") {
    return ok({
      cashAvailable: 1280.5,
      cashFrozen: 0,
      pointsAvailable: 8600,
      pointsFrozen: 0,
      tokenAvailable: 0,
      hasPayPassword: true,
      displayName: "开发买家",
      nickname: "开发买家",
      email: "buyer@example.com",
      phone: "138****0000",
      membershipLevel: "黄金会员",
      level: 2,
      avatarUrl: "",
    });
  }
  if (p === "GET /app/v3/api/wallet/ledger_entries/points") {
    return ok({
      items: [
        { historyId: "point-1", points: 200, pointsBefore: 8400, pointsAfter: 8600, transactionTypeName: "购物奖励", remarks: "订单 order-1012 积分", createdAt: new Date().toISOString() },
        { historyId: "point-2", points: -100, pointsBefore: 8500, pointsAfter: 8400, transactionTypeName: "积分抵扣", remarks: "结算抵扣", createdAt: new Date(Date.now() - 86400000).toISOString() },
      ],
      pageInfo: { page: 1, total: 2 },
    });
  }
  if (p === "GET /app/v3/api/memberships/current") {
    return ok({ planName: "黄金会员", planRank: 3, levelName: "黄金会员", status: "active", expireTime: "2027-01-01T00:00:00Z", remainingDays: 42, pointBalance: 8600, points: 8600 });
  }
  if (p === "GET /app/v3/api/memberships/current/status") {
    return ok({ isMember: true, planName: "黄金会员", planRank: 3, status: "active" });
  }
  if (p === "GET /app/v3/api/memberships/plans") {
    return ok({ items: [
      { id: "1", code: "BRONZE", name: "青铜会员", rank: 1, levelValue: 1, requiredPoints: 0, status: "active" },
      { id: "2", code: "SILVER", name: "白银会员", rank: 2, levelValue: 2, requiredPoints: 2000, status: "active" },
      { id: "3", code: "GOLD", name: "黄金会员", rank: 3, levelValue: 3, requiredPoints: 5000, status: "active" },
    ], content: [], pageInfo: { page: 1, total: 3 } });
  }
  if (p === "GET /app/v3/api/memberships/benefits") {
    return ok({ items: [
      { id: "b1", name: "会员日 95 折", description: "每月 8 日会员日专享" },
      { id: "b2", name: "免邮券", description: "每月 4 张免邮券" },
    ], pageInfo: { page: 1, total: 2 } });
  }
  if (p === "POST /app/v3/api/memberships/purchases") {
    const orderId = nextId("membership-order");
    return ok({
      id: nextId("membership-purchase"),
      orderId,
      packageId: body.packageId,
      amountCny: 39,
      points: 500,
      status: "PAID",
      paidAt: new Date().toISOString(),
    });
  }
  if (p === "GET /app/v3/api/memberships/packages") {
    return ok({ items: [
      { id: "101", code: "GOLD-MONTHLY", name: "黄金月度套餐", levelName: "黄金会员", price: 39, originalPrice: 49, pointAmount: 500, durationDays: 30, status: "active", groupId: "monthly", levelId: "3", recommended: true },
      { id: "102", code: "GOLD-YEARLY", name: "黄金年度套餐", levelName: "黄金会员", price: 388, originalPrice: 468, pointAmount: 6000, durationDays: 365, status: "active", groupId: "yearly", levelId: "3" },
    ], content: [], pageInfo: { page: 1, total: 2 } });
  }
  if (p === "GET /app/v3/api/promotions/user_coupons/wallet") {
    const rows = [
      { userCouponId: "uc-1", couponId: "MALL-SECKILL-DIGITAL", couponName: "满 300 减 50", status: "available", available: true, type: "discount", typeName: "满减券", amount: 50, minConsume: 300, expireAt: "2026-12-31", expireTime: "2026-12-31" },
      { userCouponId: "uc-2", couponId: "MALL-NEW-LAUNCH", couponName: "新人 20 元券", status: "available", available: true, type: "discount", typeName: "满减券", amount: 20, minConsume: 99, expireAt: "2026-12-31", expireTime: "2026-12-31" },
    ];
    return ok({ items: rows, content: rows, pageInfo: { page: 1, total: rows.length } });
  }
  if (p === "GET /app/v3/api/invoices/statistics") {
    const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.amountCny ?? 0), 0);
    return ok({
      totalInvoices: invoices.length,
      pendingInvoices: invoices.length,
      completedInvoices: 0,
      totalAmount,
      totalCount: invoices.length,
      pendingCount: invoices.length,
      completedCount: 0,
    });
  }
  if (p === "GET /app/v3/api/recharges/settings") {
    return ok({ basePointsPerCny: 100, minRechargeAmountCny: 1, maxRechargeAmountCny: 5000 });
  }
  if (p === "GET /app/v3/api/recharges/packages") {
    return ok({ items: [
      { id: "recharge-100", points: 10000, pointAmount: 10000, priceAmount: 100, price: 100, currencyCode: "CNY", sortWeight: 10 },
      { id: "recharge-300", points: 30000, pointAmount: 30000, priceAmount: 300, price: 300, currencyCode: "CNY", sortWeight: 20 },
    ], pageInfo: { page: 1, total: 2 } });
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
