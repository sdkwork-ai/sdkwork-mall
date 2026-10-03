import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
import {
  listOffers,
  claimCoupon,
  redeemCouponCode,
  type MpOffer,
} from "../../services/promotion-service";
import { listUserCoupons } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";

type MpUserCoupon = Awaited<ReturnType<typeof listUserCoupons>>[number];

interface CouponsData {
  claimable: MpOffer[];
  myCoupons: MpUserCoupon[];
  code: string;
  loading: boolean;
  busy: boolean;
  message: string;
  toast: string;
  _toastTimer: number | null;
}

Page({
  data: {
    claimable: [],
    myCoupons: [],
    code: "",
    loading: true,
    busy: false,
    message: "",
    toast: "",
    _toastTimer: null,
  } as CouponsData,

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      const [offers, coupons] = await Promise.all([
        listOffers().catch(() => []),
        listUserCoupons().catch(() => []),
      ]);
      this.setData({
        claimable: offers.filter((offer) => offer.claimable),
        myCoupons: coupons,
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        message: errorMessage(cause, "优惠券加载失败"),
      });
    }
  },

  onCodeInput(event: MpInputEvent) {
    this.setData({ code: event.detail.value });
  },

  async claim(event: MpTapEvent) {
    const offerId = String(event.currentTarget.dataset.id ?? "");
    this.setData({ busy: true });
    try {
      await claimCoupon(offerId);
      this.showToast("领取成功");
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "领取失败"));
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
      await redeemCouponCode(code);
      this.showToast("兑换成功");
      this.setData({ code: "" });
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "兑换失败"));
    } finally {
      this.setData({ busy: false });
    }
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
