import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkCatalogRemotePort } from "./catalog-remote-port";

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

export interface MallProductDetail {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
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
  skus: Array<{
    id: string;
    name: string;
    priceCny: number | null;
    stock?: number;
    /**
     * 规格图片（可选），用于 SKU 切换时联动主图。
     */
    imageUrl?: string;
  }>;
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

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const record = unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
  // Canonical media is a list of `{ url }` items; the dev double (and legacy
  // payloads) ship a plain `images` string array plus a cover `imageUrl`.
  const mediaList = Array.isArray(record.media) ? record.media : [];
  const legacyImages = Array.isArray(record.images) ? record.images : [];
  const images = [
    ...mediaList.map((item) =>
      typeof item === "object" && item !== null && "url" in item
        ? String((item as { url?: unknown }).url ?? "")
        : "",
    ),
    ...legacyImages
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean),
  ].filter(Boolean);
  if (images.length === 0 && typeof record.imageUrl === "string" && record.imageUrl) {
    images.push(record.imageUrl);
  }

  const skus = Array.isArray(record.skus)
    ? record.skus.map((sku: Record<string, unknown>) => ({
        id: String(sku.id ?? ""),
        name: String(sku.name ?? sku.title ?? "默认规格"),
        // Canonical wire is `salePrice`; the dev double ships `priceCny`.
        priceCny: typeof sku.salePrice === "number"
          ? sku.salePrice
          : typeof sku.priceCny === "number"
            ? sku.priceCny
            : null,
        stock: typeof sku.stock === "number" ? sku.stock : undefined,
        imageUrl: readString(sku.imageUrl ?? sku.image ?? sku.thumbnail),
      }))
    : [];

  const serviceCommitments = readCommitments(
    record.serviceCommitments ?? record.commitments ?? record.services ?? record.service_commitments,
  );
  const specifications = readSpecRows(
    record.specifications ?? record.specs ?? record.attributes ?? record.specification,
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

  return {
    id: String(record.id ?? productId),
    title: String(record.title ?? record.name ?? "商品"),
    subtitle: readString(record.subtitle),
    description: readString(record.description),
    priceCny:
      typeof record.salePrice === "number"
        ? record.salePrice
        : typeof record.priceCny === "number"
          ? record.priceCny
          : skus[0]?.priceCny ?? null,
    listPriceCny: readNumber(record.listPrice ?? record.marketPrice ?? record.originalPrice ?? record.list_price),
    videoUrl: readString(record.videoUrl ?? record.video),
    shopId: readString(record.shopId),
    shopName: readString(record.shopName),
    shopRating,
    images,
    skus,
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
}) {
  return getSdkworkCatalogRemotePort().createCartItem({
    spuId: input.productId,
    skuId: input.skuId,
    quantity: input.quantity,
  });
}

export async function retrieveMallCategory(categoryId: string): Promise<{ id: string; name: string } | null> {
  const response = await getSdkworkCatalogRemotePort().retrieveCategory({ categoryId });
  const record = unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
  if (!record?.id) {
    return null;
  }

  return {
    id: String(record.id ?? categoryId),
    name: String(record.name ?? record.title ?? "类目"),
  };
}
