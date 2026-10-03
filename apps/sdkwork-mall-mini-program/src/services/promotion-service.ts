import { request } from "./transport";

export interface MpOffer {
  claimable: boolean;
  discountText: string;
  endAt: string;
  highlight: string;
  id: string;
  title: string;
}

export async function listOffers(): Promise<MpOffer[]> {
  const payload = await request({
    path: "/promotions/offers",
    query: { page: 1, page_size: 10, status: "active" },
  });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((item) => ({
    id: String(item.id ?? item.offerId ?? ""),
    title: String(item.title ?? item.name ?? "活动"),
    discountText: typeof item.discountText === "string" ? item.discountText : "",
    highlight: typeof item.highlight === "string" ? item.highlight : "",
    endAt: String(item.endAt ?? item.endTime ?? ""),
    claimable: item.claimable === true || item.claim_enabled === true || Boolean(item.couponStockId),
  }));
}

export async function claimCoupon(offerId: string): Promise<Record<string, unknown>> {
  return request({ path: "/promotions/user_coupon_claims", method: "POST", body: { offerId } });
}

export async function redeemCouponCode(code: string): Promise<Record<string, unknown>> {
  return request({ path: "/promotions/codes/redemptions", method: "POST", body: { code } });
}
