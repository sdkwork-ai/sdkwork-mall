import { type MpTapEvent } from "../../types/common";

interface HelpSection {
  items: string[];
  title: string;
}

interface HelpQuickLink {
  label: string;
  path: string;
}

const QUICK_LINKS: HelpQuickLink[] = [
  { label: "订单查询", path: "/pages/orders/index" },
  { label: "售后服务", path: "/pages/aftersales/index" },
  { label: "发票开具", path: "/pages/invoices/index" },
  { label: "消息通知", path: "/pages/messages/index" },
  { label: "礼品卡", path: "/pages/gift-cards/index" },
  { label: "账户安全", path: "/pages/security/index" },
];

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "订单与物流",
    items: [
      "在买家中心「我的订单」查看订单状态与物流信息",
      "未发货前可联系客服尝试修改收货地址",
      "支付成功后可在「支付结果」页查看支付单号",
    ],
  },
  {
    title: "售后服务",
    items: [
      "已完成订单可在「我的评价」查看待评价商品",
      "在「售后中心」发起退款、退货或换货申请",
      "售后进度同步至「消息中心」",
    ],
  },
  {
    title: "发票与资产",
    items: [
      "「发票」页申请电子/纸质发票",
      "「优惠券」「积分」「我的钱包」统一管理优惠资产",
      "「礼品卡」页预留红包与礼品卡入口（待 SDK）",
      "会员权益在「会员中心」查看与续费",
    ],
  },
  {
    title: "账户安全",
    items: [
      "通过登录页重新认证以修改密码与绑定手机",
      "「账户与安全」查看当前登录账户信息",
      "异常登录请及时修改密码并联系平台客服",
    ],
  },
];

Page({
  data: {
    sections: HELP_SECTIONS,
    quickLinks: QUICK_LINKS,
  },

  goQuickLink(event: MpTapEvent) {
    const path = String(event.currentTarget.dataset.path ?? "");
    if (path) {
      wx.navigateTo({ url: path });
    }
  },

  goChats() {
    wx.navigateTo({ url: "/pages/chats/index" });
  },
});
