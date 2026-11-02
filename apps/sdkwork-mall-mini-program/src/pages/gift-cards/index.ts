import { mpCapabilityUrl } from "../../routes/capabilities";
const GIFT_CARD_NOTICE = [
  "礼品卡购买、赠送、兑换与红包领取需 commerce gift-cards API。",
  "当前版本仅预留入口；合约落地后在此接入余额、领取记录与兑换流程。",
];

Page({
  data: {
    notice: GIFT_CARD_NOTICE,
  },

  goWallet() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.wallet") });
  },
});
