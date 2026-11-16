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

/**
 * Reads one payload out of the commerce block.
 *
 * `CommerceApiResult` wraps every payload in `{ code, message, requestId, data }`;
 * the commerce `shops` group returns its typed response directly, so both shapes
 * are accepted here.
 */
async function readCommerceData<T extends Record<string, unknown>>(call: Promise<T | { data: T }>): Promise<T> {
  const result = (await call) as T | { data: T };
  return (result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object"
    ? result.data
    : result) as T;
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
  const payload = await readCommerceData(
    commerce().shops.list({ page: 1, pageSize: limit, operationStatus: "active" }) as unknown as Promise<Record<string, unknown>>,
  ).catch(() => ({}) as MpRecord);
  return asRecordList(payload.items)
    .map(readShopSummary)
    .filter((shop) => shop.id)
    .slice(0, limit);
}

export async function retrieveShop(shopId: string): Promise<MpShopDetail | null> {
  const [shop, productsPayload] = await Promise.all([
    readCommerceData(commerce().shops.retrieve(shopId) as unknown as Promise<Record<string, unknown>>).catch(() => ({}) as MpRecord),
    readCommerceData(
      commerce().catalog.products.list({ page: 1, pageSize: 20, shopId }) as unknown as Promise<Record<string, unknown>>,
    ).catch(() => ({}) as MpRecord),
  ]);
  if (!asString(shop, ["id", "shopId"])) {
    return null;
  }
  return {
    ...readShopSummary(shop),
    products: asRecordList(productsPayload.items).map((row) => ({
      id: asString(row, ["id", "spuId"]),
      title: asString(row, ["title", "name"], "商品"),
      imageUrl: asString(row, ["imageUrl", "mainImage", "image"]),
      priceCny: asNumber(row, ["priceCny", "price", "salePrice"]),
      sales: asNumber(row, ["sales", "salesCount"]),
    })),
  };
}

export async function listActivities(): Promise<MpActivity[]> {
  const payload = await readCommerceData(
    commerce().promotions.offers.list({ status: "active", page: 1, pageSize: 20 }) as unknown as Promise<Record<string, unknown>>,
  );
  return asRecordList(payload.items)
    .map(readActivity)
    .filter((activity) => activity.id);
}

export async function retrieveActivity(eventId: string): Promise<MpActivity | null> {
  // A failed read must stay distinguishable from "no such activity": the page
  // shows a retry for the first and a terminal empty state for the second.
  const record = await readCommerceData(
    commerce().promotions.offers.retrieve(eventId) as unknown as Promise<Record<string, unknown>>,
  );
  if (!asString(record, ["id", "offerId", "activityId"])) {
    return null;
  }
  return readActivity(record);
}
