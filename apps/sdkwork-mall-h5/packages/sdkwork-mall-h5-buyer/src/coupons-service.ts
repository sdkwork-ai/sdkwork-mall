import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5UserCoupon {
  id: string;
  status: string;
  title: string;
  validUntil?: string;
}

export interface MallH5ClaimableCoupon {
  id: string;
  title: string;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export async function listMallH5UserCoupons(): Promise<MallH5UserCoupon[]> {
  const response = await getSdkworkCommerceService().promotions.userCoupons.list({
    page: 1,
    page_size: 50,
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => ({
    id: readString(item, ["id", "userCouponId"]),
    status: readString(item, ["status", "statusName"]) || "available",
    title: readString(item, ["title", "name", "couponName"]) || "优惠券",
    validUntil: readString(item, ["validUntil", "expireTime", "expiredAt"]) || undefined,
  }));
}

export async function listMallH5ClaimableCoupons(): Promise<MallH5ClaimableCoupon[]> {
  const response = await getSdkworkCommerceService().promotions.offers.list({
    page: 1,
    page_size: 20,
    status: "active",
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? [])
    .filter((item) => item.claimable === true || item.claim_enabled === true || item.couponStockId)
    .map((item) => ({
      id: readString(item, ["id", "offerId"]),
      title: readString(item, ["title", "name"]) || "可领取优惠",
    }));
}

export async function claimMallH5Coupon(offerId: string): Promise<void> {
  await getSdkworkCommerceService().promotions.userCoupons.claims.create({ offerId });
}

export async function redeemMallH5CouponCode(code: string): Promise<void> {
  await getSdkworkCommerceService().promotions.codes.redemptions.create({ code });
}
