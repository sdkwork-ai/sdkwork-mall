import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkCatalogRemotePort } from "./catalog-remote-port";

/**
 * Raised when a transactional action (add to cart, buy now) is attempted
 * without a signed-in buyer.
 *
 * Browsing the catalog never requires a session, so the storefront only meets
 * this error on the paths that genuinely belong to a buyer's account. Callers
 * use it to send the shopper to the login screen with a return path instead of
 * surfacing a raw `401` to them.
 */
export class MallLoginRequiredError extends Error {
  /**
   * Diagnostic only: the catalog package has no message catalogue, so callers
   * must not render this string. They redirect to the login screen instead.
   */
  constructor(message = "login required before a cart mutation") {
    super(message);
    this.name = "MallLoginRequiredError";
  }
}

export function isMallLoginRequiredError(value: unknown): value is MallLoginRequiredError {
  return value instanceof MallLoginRequiredError;
}

/** Detects the framework's authentication/authorization rejections. */
function isAuthenticationFailure(cause: unknown): boolean {
  if (!cause || typeof cause !== "object") {
    return false;
  }
  const record = cause as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  if (
    record.name === "AuthenticationError" ||
    record.name === "TokenExpiredError" ||
    record.name === "TokenInvalidError" ||
    record.name === "ForbiddenError"
  ) {
    return true;
  }
  if (record.status === 401 || record.status === 403) {
    return true;
  }
  if (record.code === 40101 || record.code === 40301) {
    return true;
  }
  const message = typeof record.message === "string" ? record.message : "";
  return message.includes("missing-access-token") || message.includes("missing-auth-token");
}

/**
 * 规格参数行：品牌、型号、产地、材质等键值对。
 */
export interface MallProductSpecRow {
  label: string;
  value: string;
}

/**
 * 包装清单条目。
 */
export interface MallProductPackageItem {
  name: string;
  quantity?: number;
}

/**
 * 常见问题条目。
 */
export interface MallProductFaqItem {
  question: string;
  answer: string;
}

/**
 * 服务承诺条目：如"7天无理由退货"、"假一赔十"、"闪电发货"。
 */
export interface MallProductServiceCommitment {
  title: string;
  description?: string;
}

/**
 * 店铺评分摘要：综合评分、描述相符、物流服务、服务态度。
 */
export interface MallShopRatingSummary {
  overall: number | null;
  descriptionMatch: number | null;
  logistics: number | null;
  service: number | null;
}

/**
 * One sales-axis position of a SKU.
 *
 * `axisKey` is the stable grouping key for the spec picker: the canonical
 * catalog SKU carries the attribute id (`attributeId`) and its business key
 * (`attributeNo`), while dev doubles only carry display values. Grouping on the
 * id keeps two attributes that happen to share a display value apart.
 */
export interface MallProductSkuAttribute {
  axisKey: string;
  attributeId: string;
  attributeNo: string;
  valueId: string;
  valueCode: string;
  valueLabel: string;
}

export interface MallProductSku {
  id: string;
  name: string;
  priceCny: number | null;
  /**
   * 划线价（SKU 级原价）。
   */
  listPriceCny?: number | null;
  stock?: number;
  /**
   * 规格图片（可选），用于 SKU 切换时联动主图。
   */
  imageUrl?: string;
  /**
   * 该 SKU 在类目销售属性上的取值。为空时页面退化为按 SKU 名称平铺选择。
   */
  attributes: MallProductSkuAttribute[];
}

export interface MallProductDetail {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  /**
   * Owning category id, when the projection publishes it. Used for the PDP
   * breadcrumb (首页 > 类目 > 店铺 > 商品).
   */
  categoryId?: string;
  priceCny: number | null;
  /**
   * 划线价（原价 / market price），用于展示促销折扣。
   */
  listPriceCny?: number | null;
  images: string[];
  /**
   * 主图视频地址（预留字段，SDK 提供时填充）。
   */
  videoUrl?: string;
  shopId?: string;
  shopName?: string;
  /**
   * 店铺评分摘要。
   */
  shopRating?: MallShopRatingSummary | null;
  skus: MallProductSku[];
  /**
   * Sales-axis labels keyed by `MallProductSkuAttribute.axisKey`. The product
   * payload carries the attribute names while the SKU payload only carries ids,
   * so the detail read model joins them here.
   */
  attributeLabels: Record<string, string>;
  /**
   * 服务承诺列表。
   */
  serviceCommitments: MallProductServiceCommitment[];
  /**
   * 规格参数表。
   */
  specifications: MallProductSpecRow[];
  /**
   * 包装清单。
   */
  packageList: MallProductPackageItem[];
  /**
   * 售后说明（文本，可含多段）。
   */
  afterSalesNotes: string[];
  /**
   * 常见问题。
   */
  faq: MallProductFaqItem[];
  /**
   * 评价摘要。
   */
  reviewSummary?: {
    averageRating: number | null;
    totalReviews: number;
    goodRate: number | null;
    tags?: Array<{ label: string; count: number }>;
  } | null;
  /**
   * 促销标签（如"满减"、"跨店满减"、"限时直降"）。
   */
  promotionTags: string[];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  // Canonical money/stock fields are int64-encoded strings on the wire
  // (`salePriceMinor`, `minorUnitExponent`, `version`), so a string that parses
  // is a valid value rather than a malformed one.
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNumber(value: unknown): number | null {
  return readFiniteNumber(value);
}

/**
 * Reads the resource body out of a single-resource response.
 *
 * SDKWork v3 answers a retrieve with `{ code, data: { item }, traceId }`; the
 * transport's envelope unwrap already removed `code`/`data`, leaving
 * `{ item }`. Older doubles answer the record at the root. Both are accepted so
 * a field is never read off the wrapper (which is what made every PDP field
 * fall back to its placeholder).
 */
function readResourceRecord(payload: unknown): Record<string, unknown> {
  const record = readRecord(payload);
  if (!record) {
    return {};
  }
  const item = readRecord(record.item);
  if (item) {
    return item;
  }
  const data = readRecord(record.data);
  if (data && !("id" in record)) {
    return readRecord(data.item) ?? data;
  }
  return record;
}

/**
 * Reads a decimals amount that rides the wire as an integer minor unit.
 *
 * The exponent comes from `minorUnitExponent`; the schema bounds it to 0–8.
 * When the field is absent (dev doubles and legacy payloads report a decimal
 * amount already) the amount is not treated as minor units at all.
 */
function readMinorUnitAmount(value: unknown, exponentValue: unknown): number | null {
  const minor = readFiniteNumber(value);
  if (minor == null) {
    return null;
  }
  const exponent = readFiniteNumber(exponentValue);
  if (exponent == null || !Number.isInteger(exponent) || exponent < 0 || exponent > 8) {
    return null;
  }
  return minor / 10 ** exponent;
}

/** Reads a SKU/product price, preferring the canonical minor-unit fields. */
function readMoney(
  record: Record<string, unknown>,
  minorKey: string,
  decimalKeys: readonly string[],
): number | null {
  const minor = readMinorUnitAmount(record[minorKey], record.minorUnitExponent ?? record.priceScale);
  if (minor != null) {
    return minor;
  }
  for (const key of decimalKeys) {
    const value = readFiniteNumber(record[key]);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function readImageUrl(value: unknown): string {
  const record = readRecord(value);
  if (!record) {
    return "";
  }
  const snapshot = readRecord(record.resourceSnapshot ?? record.resource_snapshot);
  return (
    readString(record.url) ??
    readString(record.publicUrl) ??
    (snapshot ? readString(snapshot.url) ?? readString(snapshot.publicUrl) : undefined) ??
    ""
  );
}

/**
 * Reads the product-level attribute table.
 *
 * Canonical catalog products publish `attributes: [{ attributeId, attributeNo,
 * attributeName, displayValue, rawValue }]`; this is also the only payload that
 * carries the *name* of a sales axis, so it doubles as the label source for the
 * spec picker.
 */
function readProductAttributes(value: unknown): {
  rows: MallProductSpecRow[];
  labels: Record<string, string>;
} {
  const rows: MallProductSpecRow[] = [];
  const labels: Record<string, string> = {};
  if (!Array.isArray(value)) {
    return { rows, labels };
  }
  for (const item of value) {
    const record = readRecord(item);
    if (!record) {
      continue;
    }
    const attributeId = readString(record.attributeId ?? record.attribute_id) ?? "";
    const attributeNo = readString(record.attributeNo ?? record.attribute_no) ?? "";
    const label =
      readString(record.attributeName ?? record.attribute_name ?? record.label ?? record.name) ?? "";
    const rawValue = record.displayValue ?? record.display_value ?? record.rawValue ?? record.raw_value ?? record.value;
    const text =
      typeof rawValue === "string"
        ? rawValue
        : rawValue == null
          ? ""
          : String(rawValue);
    if (attributeId && label) {
      labels[`id:${attributeId}`] = label;
    }
    if (attributeNo && label) {
      labels[`no:${attributeNo}`] = label;
    }
    if (label && text) {
      rows.push({ label, value: text });
    }
  }
  return { rows, labels };
}

function readSkuAttributes(value: unknown): MallProductSkuAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const attributes: MallProductSkuAttribute[] = [];
  for (const item of value) {
    const record = readRecord(item);
    if (!record) {
      continue;
    }
    const attributeId = readString(record.attributeId ?? record.attribute_id) ?? "";
    const attributeNo = readString(record.attributeNo ?? record.attribute_no) ?? "";
    const valueId = readString(record.attributeValueId ?? record.attribute_value_id ?? record.valueId) ?? "";
    const valueCode = readString(record.valueCode ?? record.value_code) ?? "";
    const valueLabel =
      readString(record.displayValue ?? record.display_value ?? record.valueLabel ?? record.valueName ?? record.value) ??
      valueCode;
    if (!attributeId && !attributeNo && !valueId && !valueLabel) {
      continue;
    }
    attributes.push({
      axisKey: attributeId ? `id:${attributeId}` : `no:${attributeNo || valueId || valueLabel}`,
      attributeId,
      attributeNo,
      valueId,
      valueCode,
      valueLabel,
    });
  }
  return attributes;
}

function readSkus(value: unknown): MallProductSku[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const skus: MallProductSku[] = [];
  for (const item of value) {
    const record = readRecord(item);
    if (!record) {
      continue;
    }
    const id = readString(record.id ?? record.skuId ?? record.sku_id);
    if (!id) {
      continue;
    }
    const attributes = readSkuAttributes(record.attributes ?? record.attributeValues ?? record.attribute_values);
    const stock = readFiniteNumber(
      record.stock ?? record.stockQuantity ?? record.stock_quantity ?? record.availableStock ?? record.available_stock,
    );
    skus.push({
      id,
      name:
        readString(record.name ?? record.title) ??
        (attributes.length > 0
          ? attributes.map((attribute) => attribute.valueLabel).join(" ")
          : "默认规格"),
      priceCny: readMoney(record, "salePriceMinor", ["salePrice", "priceCny", "price"]),
      listPriceCny: readMoney(record, "listPriceMinor", ["listPrice", "marketPrice", "originalPrice"]),
      stock: stock ?? undefined,
      imageUrl: readString(record.imageUrl ?? record.image ?? record.thumbnail),
      attributes,
    });
  }
  return skus;
}

function readSpecRows(value: unknown): MallProductSpecRow[] {
  if (!Array.isArray(value)) return [];
  const rows: MallProductSpecRow[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const label = readString(record.label ?? record.name ?? record.key);
      const rawValue = record.value ?? record.content ?? record.description;
      const text = typeof rawValue === "string" ? rawValue : rawValue == null ? "" : String(rawValue);
      if (label && text) {
        rows.push({ label, value: text });
      }
    }
  }
  return rows;
}

function readPackageList(value: unknown): MallProductPackageItem[] {
  if (!Array.isArray(value)) return [];
  const items: MallProductPackageItem[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      items.push({ name: item });
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const name = readString(record.name ?? record.title);
      const quantity = readNumber(record.quantity ?? record.count) ?? undefined;
      if (name) {
        items.push({ name, quantity });
      }
    }
  }
  return items;
}

function readFaq(value: unknown): MallProductFaqItem[] {
  if (!Array.isArray(value)) return [];
  const items: MallProductFaqItem[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const question = readString(record.question ?? record.title);
      const answer = readString(record.answer ?? record.content ?? record.reply);
      if (question && answer) {
        items.push({ question, answer });
      }
    }
  }
  return items;
}

function readCommitments(value: unknown): MallProductServiceCommitment[] {
  if (!Array.isArray(value)) return [];
  const items: MallProductServiceCommitment[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      items.push({ title: item });
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const title = readString(record.title ?? record.name ?? record.label);
      const description = readString(record.description ?? record.content);
      if (title) {
        items.push({ title, description });
      }
    }
  }
  return items;
}

function readShopRating(value: unknown): MallShopRatingSummary | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const overall = readNumber(record.overall ?? record.score ?? record.rating);
  const descriptionMatch = readNumber(record.descriptionMatch ?? record.description_score ?? record.itemAsDescribed);
  const logistics = readNumber(record.logistics ?? record.logistics_score ?? record.shipping);
  const service = readNumber(record.service ?? record.service_score ?? record.attitude);
  if (overall == null && descriptionMatch == null && logistics == null && service == null) {
    return null;
  }
  return { overall, descriptionMatch, logistics, service };
}

function readReviewSummary(value: unknown): MallProductDetail["reviewSummary"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const averageRating = readNumber(record.averageRating ?? record.average ?? record.rating);
  const totalReviews = readNumber(record.totalReviews ?? record.total ?? record.count) ?? 0;
  const goodRate = readNumber(record.goodRate ?? record.positiveRate ?? record.good_rate);
  const tagsValue = record.tags ?? record.labels;
  const tags = Array.isArray(tagsValue)
    ? tagsValue
        .map((tag) => {
          if (!tag || typeof tag !== "object") return null;
          const t = tag as Record<string, unknown>;
          const label = readString(t.label ?? t.name ?? t.title);
          const count = readNumber(t.count ?? t.total) ?? 0;
          return label ? { label, count } : null;
        })
        .filter((tag): tag is { label: string; count: number } => tag !== null)
    : undefined;
  return {
    averageRating,
    totalReviews,
    goodRate,
    tags,
  };
}

export async function loadMallProductDetail(productId: string): Promise<MallProductDetail> {
  const response = await getSdkworkCatalogRemotePort().retrieveSpu({ spuId: productId });
  // v3 single-resource responses are `{ code, data: { item }, traceId }`; the
  // transport unwraps the envelope, so the product itself is `payload.item`.
  // Reading fields off the wrapper is what made every PDP field (title, price,
  // SKUs, description) fall back to its placeholder.
  const record = readResourceRecord(unwrapSdkworkPaymentResponse(response));

  // Canonical media is a list of attachment resources whose URL sits on the
  // row (or on its snapshot); the dev double and legacy payloads ship a plain
  // `images` string array plus a cover `imageUrl`.
  const mediaList = Array.isArray(record.media) ? record.media : [];
  const legacyImages = Array.isArray(record.images) ? record.images : [];
  const images = [
    ...mediaList.map(readImageUrl),
    ...legacyImages.flatMap((item) => {
      if (typeof item === "string") {
        return item ? [item] : [];
      }
      const url = readImageUrl(item);
      return url ? [url] : [];
    }),
  ].filter((image, index, list) => image.length > 0 && list.indexOf(image) === index);
  if (images.length === 0) {
    const cover = readString(record.imageUrl ?? record.image ?? record.mainImage);
    if (cover) {
      images.push(cover);
    }
  }

  const productAttributes = readProductAttributes(record.attributes);
  const skus = readSkus(record.skus ?? record.skuList ?? record.sku_list ?? record.variants);
  const explicitSpecs = readSpecRows(record.specifications ?? record.specs ?? record.specification);
  // A canonical product carries its attribute table, not a `specifications`
  // array, so the attribute rows are the spec table unless one is authored.
  const specifications = explicitSpecs.length > 0 ? explicitSpecs : productAttributes.rows;

  const serviceCommitments = readCommitments(
    record.serviceCommitments ?? record.commitments ?? record.services ?? record.service_commitments,
  );
  const packageList = readPackageList(record.packageList ?? record.package ?? record.packing_list);
  const afterSalesNotesValue = record.afterSalesNotes ?? record.after_sales ?? record.returnPolicy ?? record.return_policy;
  const afterSalesNotes = Array.isArray(afterSalesNotesValue)
    ? afterSalesNotesValue
        .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? readString((item as Record<string, unknown>).content) ?? "" : ""))
        .filter((item) => item.length > 0)
    : typeof afterSalesNotesValue === "string" && afterSalesNotesValue.length > 0
      ? [afterSalesNotesValue]
      : [];
  const faq = readFaq(record.faq ?? record.faqs ?? record.qa ?? record.questions);
  const shopRating = readShopRating(record.shopRating ?? record.shop_rating ?? record.shop);
  const reviewSummary = readReviewSummary(record.reviewSummary ?? record.reviews ?? record.rating_summary);
  const promotionTagsValue = record.promotionTags ?? record.promotion_tags ?? record.tags;
  const promotionTags = Array.isArray(promotionTagsValue)
    ? promotionTagsValue
        .map((tag) => {
          if (typeof tag === "string") return tag;
          if (tag && typeof tag === "object") {
            return readString((tag as Record<string, unknown>).label ?? (tag as Record<string, unknown>).name) ?? "";
          }
          return "";
        })
        .filter((tag) => tag.length > 0)
    : [];

  // Presentation fallback only: the selected SKU's own price always wins.
  // Positive prices are preferred so a free/gift variant (0) does not become
  // the "from" price of an otherwise paid product.
  const skuPrices = skus
    .map((sku) => sku.priceCny)
    .filter((price): price is number => price != null && price > 0);

  return {
    id: String(record.id ?? productId),
    title: readString(record.title) ?? readString(record.name) ?? "商品",
    subtitle: readString(record.subtitle),
    description: readString(record.description),
    categoryId: readString(record.categoryId ?? record.category_id),
    priceCny:
      readMoney(record, "salePriceMinor", ["salePrice", "priceCny", "price"]) ??
      (skuPrices.length > 0 ? Math.min(...skuPrices) : skus[0]?.priceCny ?? null),
    listPriceCny:
      readMoney(record, "listPriceMinor", [
        "listPrice",
        "marketPrice",
        "originalPrice",
        "list_price",
      ]) ??
      skus.find((sku) => sku.listPriceCny != null)?.listPriceCny ??
      null,
    videoUrl: readString(record.videoUrl ?? record.video),
    shopId: readString(record.shopId ?? record.shop_id),
    shopName: readString(record.shopName ?? record.shop_name),
    shopRating,
    images,
    skus,
    attributeLabels: productAttributes.labels,
    serviceCommitments,
    specifications,
    packageList,
    afterSalesNotes,
    faq,
    reviewSummary,
    promotionTags,
  };
}

export async function loadMallProductCoupons(): Promise<Array<{ id: string; title: string }>> {
  try {
    const response = await getSdkworkCatalogRemotePort().listPromotionOffers({
      page: 1,
      page_size: 5,
      status: "active",
    });
    const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
    return (
      payload.items?.map((item) => ({
        id: String(item.id ?? item.offerId ?? ""),
        title: String(item.title ?? item.name ?? "优惠券"),
      })) ?? []
    );
  } catch {
    return [];
  }
}

export async function addMallProductToCart(input: {
  productId: string;
  quantity: number;
  skuId: string;
}): Promise<string | undefined> {
  let response: unknown;
  try {
    response = await getSdkworkCatalogRemotePort().createCartItem({
      spuId: input.productId,
      skuId: input.skuId,
      quantity: input.quantity,
    });
  } catch (cause) {
    // The cart is a buyer-owned resource: an anonymous add must become a login
    // check, never a raw 401 rendered as "add to cart failed".
    if (isAuthenticationFailure(cause)) {
      throw new MallLoginRequiredError();
    }
    throw cause;
  }
  // "立即购买" needs the created line id to scope the checkout to that item.
  // The envelope may nest the line or return it at the root; read defensively.
  const payload = unwrapSdkworkPaymentResponse(response) as Record<string, unknown> | null;
  if (!payload) {
    return undefined;
  }
  const item = (payload.item ?? payload.cartItem ?? payload) as Record<string, unknown>;
  const id = item.id ?? item.cartItemId ?? payload.id;
  if (typeof id === "string" && id) {
    return id;
  }
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }
  return undefined;
}

export async function setMallProductCartQuantity(
  cartItemId: string,
  quantity: number,
): Promise<void> {
  // "立即购买" must charge the quantity chosen on the PDP. Adding the SKU
  // merges into an existing line (JD-style cart), so the line quantity is only
  // exact after this guarded update.
  await getSdkworkCatalogRemotePort().updateCartItem(cartItemId, { quantity });
}

export async function retrieveMallCategory(categoryId: string): Promise<{ id: string; name: string } | null> {
  const response = await getSdkworkCatalogRemotePort().retrieveCategory({ categoryId });
  // Same v3 resource envelope as the product: the category is `payload.item`.
  const record = readResourceRecord(unwrapSdkworkPaymentResponse(response));
  if (!record.id) {
    return null;
  }

  return {
    id: String(record.id ?? categoryId),
    name: String(record.name ?? record.title ?? "类目"),
  };
}
