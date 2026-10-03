/**
 * Marketing surfaces: shops and promotional activities.
 *
 * Wire contract: `GET /shops/{shopId}` (shop detail), `GET /catalog/spus`
 * filtered by `shop_id` (shop products), `GET /promotions/offers` with
 * `status=active` (activity list) and `GET /promotions/offers/{offerId}`
 * (activity detail).
 */
import { request } from "./transport";
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

export async function retrieveShop(shopId: string): Promise<MpShopDetail | null> {
  const [shop, productsPayload] = await Promise.all([
    request({ path: `/shops/${shopId}` }).catch(() => ({}) as MpRecord),
    request({
      path: "/catalog/spus",
      query: { page: 1, page_size: 20, shop_id: shopId },
    }).catch(() => ({}) as MpRecord),
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
  const payload = await request({
    path: "/promotions/offers",
    query: { status: "active", page: 1, page_size: 20 },
  });
  return asRecordList(payload.items)
    .map(readActivity)
    .filter((activity) => activity.id);
}

export async function retrieveActivity(eventId: string): Promise<MpActivity | null> {
  const record = await request({ path: `/promotions/offers/${eventId}` }).catch(() => ({}) as MpRecord);
  if (!asString(record, ["id", "offerId", "activityId"])) {
    return null;
  }
  return readActivity(record);
}
