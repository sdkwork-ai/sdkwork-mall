const promotions = require("../../services/promotion-service");
const cartService = require("../../services/cart-service");
const session = require("../../services/session");

Page({
  data: {
    claimable: [],
    myCoupons: [],
    code: "",
    loading: true,
    busy: false,
    message: "",
    toast: "",
  },

  onShow() {
    if (!session.isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      const [offers, coupons] = await Promise.all([
        promotions.listOffers().catch(() => []),
        cartService.listUserCoupons().catch(() => []),
      ]);
      this.setData({
        claimable: offers.filter((offer) => offer.claimable),
        myCoupons,
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        message: cause && cause.message ? cause.message : "优惠券加载失败",
      });
    }
  },

  onCodeInput(event) {
    this.setData({ code: event.detail.value });
  },

  async claim(event) {
    const offerId = event.currentTarget.dataset.id;
    this.setData({ busy: true });
    try {
      await promotions.claimCoupon(offerId);
      this.showToast("领取成功");
      await this.refresh();
    } catch (cause) {
      this.showToast(cause && cause.message ? cause.message : "领取失败");
    } finally {
      this.setData({ busy: false });
    }
  },

  async redeem() {
    const code = this.data.code.trim();
    if (!code) {
      return;
    }
    this.setData({ busy: true });
    try {
      await promotions.redeemCouponCode(code);
      this.showToast("兑换成功");
      this.setData({ code: "" });
      await this.refresh();
    } catch (cause) {
      this.showToast(cause && cause.message ? cause.message : "兑换失败");
    } finally {
      this.setData({ busy: false });
    }
  },

  showToast(message) {
    this.setData({ toast: message });
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.setData({ toast: "" }), 2200);
  },
});
