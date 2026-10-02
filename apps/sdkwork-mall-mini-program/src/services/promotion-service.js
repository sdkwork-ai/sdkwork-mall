const { request } = require("./transport");

async function listOffers() {
  const payload = await request({
    path: "/promotions/offers",
    query: { page: 1, page_size: 10, status: "active" },
  });
  return (payload.items ?? []).map((item) => ({
    id: String(item.id ?? item.offerId ?? ""),
    title: String(item.title ?? item.name ?? "活动"),
    discountText: typeof item.discountText === "string" ? item.discountText : "",
    highlight: typeof item.highlight === "string" ? item.highlight : "",
    endAt: String(item.endAt ?? item.endTime ?? ""),
    claimable: item.claimable === true || item.claim_enabled === true || Boolean(item.couponStockId),
  }));
}

async function claimCoupon(offerId) {
  return request({ path: "/promotions/user_coupon_claims", method: "POST", body: { offerId } });
}

async function redeemCouponCode(code) {
  return request({ path: "/promotions/codes/redemptions", method: "POST", body: { code } });
}

module.exports = { listOffers, claimCoupon, redeemCouponCode };
