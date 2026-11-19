/**
 * Marketing surfaces: shops and promotional activities.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (shops / promotion rows). Shop listing,
 * shop detail, shop products and activity offers belong to the mall commerce
 * block (`runtime.commerceClient.shops`, `.catalog`, `.promotions`); this module
 * projects them and owns no wire path.
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";
import { asNumber, asRecordList, asString, type MpRecord } from "../types/common";
import { readCommercePayload } from "./commerce-payload";
import { readPageInfo } from "./page-info";

export interface MpShopSummary {
  id: string;
  name: string;
  logoUrl: string;
  rating: number | null;
}

export interface MpShopProduct {
  id: string;
  title: string;
  imageUrl: string;
  priceCny: number | null;
  sales: number | null;
}

export interface MpShopDetail extends MpShopSummary {
  products: MpShopProduct[];
  /** True when the shop has more products than the first page. */
  productsHasMore: boolean;
}

export interface MpActivity {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  description: string;
  highlight: string;
  discountText: string;
  startAt: string;
  endAt: string;
  phase: "active" | "ended" | "upcoming";
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  "big-promo": "大促专题",
  "brand-day": "品牌日",
  "category-venue": "类目会场",
  "flash-sale": "秒杀",
  "limited-rush": "限时抢购",
  "member-day": "会员日",
  "new-launch": "新品首发",
  "quantity-tier": "满量会场",
};

function commerce() {
  return getMallMpRuntime().commerceClient;
}

function readShopSummary(item: MpRecord): MpShopSummary {
  return {
    id: asString(item, ["id", "shopId"]),
    name: asString(item, ["name", "title", "shopName"], "店铺"),
    logoUrl: asString(item, ["logoUrl", "logo", "icon"]),
    rating: asNumber(item, ["rating", "score"]),
  };
}

function readActivity(item: MpRecord): MpActivity {
  const now = Date.now();
  const type = asString(item, ["activityType", "activity_type", "type"], "general");
  const startAt = asString(item, ["startAt", "start_at", "startTime"]);
  const endAt = asString(item, ["endAt", "end_at", "endTime"]);
  const startMs = startAt ? Date.parse(startAt) : Number.NaN;
  const endMs = endAt ? Date.parse(endAt) : Number.NaN;
  const phase: MpActivity["phase"] = Number.isFinite(startMs) && now < startMs
    ? "upcoming"
    : Number.isFinite(endMs) && now >= endMs
      ? "ended"
      : "active";
  return {
    id: asString(item, ["id", "offerId", "activityId"]),
    title: asString(item, ["title", "name"], "活动"),
    type,
    typeLabel: ACTIVITY_TYPE_LABELS[type] ?? "活动",
    description: asString(item, ["description", "summary"]),
    highlight: asString(item, ["highlight", "slogan"]),
    discountText: asString(item, ["discountText", "discount_text", "discount"]),
    startAt,
    endAt,
    phase,
  };
}

/**
 * Featured shops for the home floor.
 *
 * Mirrors the H5 home snapshot (`commerce.shops.list`): an active-shop page of
 * four, fail-soft because the floor is an enrichment.
 */
export async function listShops(limit = 4): Promise<MpShopSummary[]> {
  const payload = await readCommercePayload(
    commerce().shops.list({ page: 1, pageSize: limit, operationStatus: "active" }) as unknown as Promise<Record<string, unknown>>,
  ).catch(() => ({}) as MpRecord);
  return asRecordList(payload.items)
    .map(readShopSummary)
    .filter((shop) => shop.id)
    .slice(0, limit);
}

function mapShopProduct(row: MpRecord): MpShopProduct {
  return {
    id: asString(row, ["id", "spuId"]),
    title: asString(row, ["title", "name"], "商品"),
    imageUrl: asString(row, ["imageUrl", "mainImage", "image"]),
    priceCny: asNumber(row, ["priceCny", "price", "salePrice"]),
    sales: asNumber(row, ["sales", "salesCount"]),
  };
}

/** One product page of a shop, for the shop page's load-more. */
export async function listShopProducts(
  shopId: string,
  page = 1,
  pageSize = 20,
): Promise<{ hasMore: boolean; items: MpShopProduct[] }> {
  const payload = await readCommercePayload(
    commerce().catalog.products.list({ page, pageSize, shopId }) as unknown as Promise<Record<string, unknown>>,
  );
  const rows = asRecordList(payload.items);
  return {
    hasMore: readPageInfo(payload, rows.length, page).hasMore,
    items: rows.map(mapShopProduct).filter((product) => product.id),
  };
}

export async function retrieveShop(shopId: string): Promise<MpShopDetail | null> {
  // A failed shop read stays a failure: turning it into `null` would report an
  // outage as "店铺不存在或已关闭" and drop the retry the page offers.
  const shop = await readCommercePayload(commerce().shops.retrieve(shopId) as unknown as Promise<Record<string, unknown>>);
  // The product shelf is enrichment: the shop header is still useful without it.
  const productsPayload = await readCommercePayload(
    commerce().catalog.products.list({ page: 1, pageSize: 20, shopId }) as unknown as Promise<Record<string, unknown>>,
  ).catch(() => ({}) as MpRecord);
  if (!asString(shop, ["id", "shopId"])) {
    return null;
  }
  const productRows = asRecordList(productsPayload.items);
  return {
    ...readShopSummary(shop),
    products: productRows.map(mapShopProduct).filter((product) => product.id),
    productsHasMore: readPageInfo(productsPayload, productRows.length, 1).hasMore,
  };
}

/** One activity-hall page, so the venue list can page instead of truncating. */
export async function listActivityPage(
  page = 1,
  pageSize = 20,
): Promise<{ hasMore: boolean; items: MpActivity[] }> {
  const payload = await readCommercePayload(
    commerce().promotions.offers.list({ status: "active", page, pageSize }) as unknown as Promise<Record<string, unknown>>,
  );
  const rows = asRecordList(payload.items);
  return {
    hasMore: readPageInfo(payload, rows.length, page).hasMore,
    items: rows.map(readActivity).filter((activity) => activity.id),
  };
}

export async function listActivities(): Promise<MpActivity[]> {
  return (await listActivityPage()).items;
}

export async function retrieveActivity(eventId: string): Promise<MpActivity | null> {
  // A failed read must stay distinguishable from "no such activity": the page
  // shows a retry for the first and a terminal empty state for the second.
  const record = await readCommercePayload(
    commerce().promotions.offers.retrieve(eventId) as unknown as Promise<Record<string, unknown>>,
  );
  if (!asString(record, ["id", "offerId", "activityId"])) {
    return null;
  }
  return readActivity(record);
}
