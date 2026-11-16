/**
 * Promotional offers and coupon actions.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (promotion row). Offers, claims and code
 * redemptions belong to the mall commerce block
 * (`runtime.commerceClient.promotions`); this module projects them and owns no
 * wire path.
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";

export interface MpOffer {
  claimable: boolean;
  discountText: string;
  endAt: string;
  highlight: string;
  id: string;
  title: string;
}

function promotions() {
  return getMallMpRuntime().commerceClient.promotions;
}

async function readCommerceData(call: Promise<{ data: Record<string, unknown> }>): Promise<Record<string, unknown>> {
  const result = await call;
  return (result?.data ?? {}) as Record<string, unknown>;
}

function readRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(record.items)) {
    return record.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(record.content)) {
    return record.content as Array<Record<string, unknown>>;
  }
  return [];
}

export async function listOffers(): Promise<MpOffer[]> {
  const payload = await readCommerceData(
    promotions().offers.list({ page: 1, pageSize: 10, status: "active" }),
  );
  return readRows(payload).map((item) => ({
    id: String(item.id ?? item.offerId ?? ""),
    title: String(item.title ?? item.name ?? "活动"),
    discountText: typeof item.discountText === "string" ? item.discountText : "",
    highlight: typeof item.highlight === "string" ? item.highlight : "",
    endAt: String(item.endAt ?? item.endTime ?? ""),
    claimable: item.claimable === true || item.claim_enabled === true || Boolean(item.couponStockId),
  }));
}

export async function claimCoupon(offerId: string): Promise<Record<string, unknown>> {
  return readCommerceData(promotions().userCoupons.claims.create({ offerId }));
}

export async function redeemCouponCode(code: string): Promise<Record<string, unknown>> {
  return readCommerceData(promotions().codes.redemptions.create({ code }));
}
