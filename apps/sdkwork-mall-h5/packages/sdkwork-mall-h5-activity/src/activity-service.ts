import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5Activity {
  description?: string;
  discountText?: string;
  endAt?: string;
  highlight?: string;
  id: string;
  startAt?: string;
  title: string;
  type: string;
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

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function readActivity(item: Record<string, unknown>): MallH5Activity {
  const type = readString(item, ["activityType", "activity_type", "type"]) || "general";
  return {
    description: readString(item, ["description", "summary"]) || undefined,
    discountText: readString(item, ["discountText", "discount_text", "discount"]) || undefined,
    endAt: readString(item, ["endAt", "end_at", "endTime"]) || undefined,
    highlight: readString(item, ["highlight", "slogan"]) || undefined,
    id: readString(item, ["id", "offerId", "activityId"]),
    startAt: readString(item, ["startAt", "start_at", "startTime"]) || undefined,
    title: readString(item, ["title", "name"]) || "活动",
    type,
  };
}

export function getMallH5ActivityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? "活动";
}

export function getMallH5ActivityPhase(activity: MallH5Activity): "active" | "ended" | "upcoming" {
  const now = Date.now();
  const startAt = activity.startAt ? new Date(activity.startAt).getTime() : null;
  const endAt = activity.endAt ? new Date(activity.endAt).getTime() : null;
  if (startAt && now < startAt) {
    return "upcoming";
  }
  if (endAt && now >= endAt) {
    return "ended";
  }
  return "active";
}

export async function listMallH5Activities(): Promise<MallH5Activity[]> {
  const response = await getSdkworkCommerceService().promotions.offers.list({
    page: 1,
    page_size: 20,
    status: "active",
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map(readActivity);
}

export async function retrieveMallH5Activity(eventId: string): Promise<MallH5Activity | null> {
  const response = await getSdkworkCommerceService().promotions.offers.retrieve(eventId);
  const record = unwrapSdkworkCommerceResponse<Record<string, unknown>>(response);
  if (!record?.id) {
    return null;
  }
  return readActivity(record);
}
