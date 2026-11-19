import { mpCapabilityUrl } from "../../routes/capabilities";
import { platform } from "@sdkwork/mall-mp-core";
const GIFT_CARD_NOTICE = [
  "礼品卡与红包功能即将上线。",
  "上线后可在这里查看礼品卡余额、领取记录并完成兑换。",
];

Page({
  data: {
    notice: GIFT_CARD_NOTICE,
  },

  goWallet() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.wallet"));
  },
});
