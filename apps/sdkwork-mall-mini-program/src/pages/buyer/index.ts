import { type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getOrderStatistics } from "../../services/order-service";
import { isLoggedIn, clearSession } from "../../services/session";

const ORDER_ENTRIES: Array<{ status: string; label: string; count: string | number }> = [
  { status: "all", label: "全部订单", count: "" },
  { status: "PENDING_PAYMENT", label: "待付款", count: "" },
  { status: "PENDING_SHIPMENT", label: "待发货", count: "" },
  { status: "PENDING_RECEIPT", label: "待收货", count: "" },
  { status: "COMPLETED", label: "已完成", count: "" },
];

/**
 * 买家中心入口一律按能力路由 id 声明，页面路径由
 * `routes/capabilities.ts` 统一解析：改页面路径只需改注册表，
 * 且与 PC / H5 / Flutter 共用同一套 route id。
 */
const ASSET_LINKS: Array<{ label: string; capability: string }> = [
  { label: "钱包", capability: "buyer.mall.wallet" },
  { label: "我的积分", capability: "buyer.mall.points" },
  { label: "会员中心", capability: "buyer.mall.membership" },
];

const QUICK_LINKS: Array<{ label: string; capability: string }> = [
  { label: "我的收藏", capability: "buyer.mall.favorites" },
  { label: "浏览足迹", capability: "buyer.mall.footprint" },
  { label: "地址管理", capability: "buyer.mall.addresses" },
  { label: "领券中心", capability: "buyer.mall.coupons" },
  { label: "售后中心", capability: "buyer.mall.after-sales" },
  { label: "发票", capability: "buyer.mall.invoices" },
  { label: "消息中心", capability: "buyer.mall.messages" },
  { label: "客服会话", capability: "buyer.mall.im.chats" },
];

/** 账户区入口（含设置）同样走能力路由。 */
const ACCOUNT_LINKS: Array<{ label: string; capability: string }> = [
  { label: "个人资料", capability: "buyer.mall.profile" },
  { label: "我的评价", capability: "buyer.mall.reviews" },
  { label: "礼品卡与红包", capability: "buyer.mall.gift-cards" },
  { label: "账户与安全", capability: "buyer.mall.security" },
  { label: "设置", capability: "buyer.mall.settings" },
  { label: "帮助中心", capability: "storefront.mall.help" },
];

const OTHER_LINKS: Array<{ label: string; capability: string }> = [
  { label: "活动会场", capability: "storefront.mall.activity-list" },
];

interface BuyerData {
  loggedIn: boolean;
  orderEntries: Array<{ status: string; label: string; count: string | number }>;
  assetLinks: Array<{ label: string; capability: string }>;
  quickLinks: Array<{ label: string; capability: string }>;
  accountLinks: Array<{ label: string; capability: string }>;
  otherLinks: Array<{ label: string; capability: string }>;
}

Page({
  data: {
    loggedIn: false,
    orderEntries: ORDER_ENTRIES,
    assetLinks: ASSET_LINKS,
    quickLinks: QUICK_LINKS,
    accountLinks: ACCOUNT_LINKS,
    otherLinks: OTHER_LINKS,
  } as BuyerData,

  onShow() {
    const loggedIn = isLoggedIn();
    this.setData({ loggedIn });
    if (loggedIn) {
      this.loadStatistics();
    }
  },

  async loadStatistics() {
    try {
      const statistics = await getOrderStatistics();
      const countFor = (status: string): string | number => {
        if (!statistics) {
          return "";
        }
        if (status === "all") {
          return statistics.totalOrders;
        }
        if (status === "PENDING_PAYMENT") {
          return statistics.pendingPayment;
        }
        if (status === "PENDING_SHIPMENT") {
          return statistics.pendingShipment;
        }
        if (status === "PENDING_RECEIPT") {
          return statistics.pendingReceipt;
        }
        if (status === "COMPLETED") {
          return statistics.completed;
        }
        return "";
      };
      this.setData({
        orderEntries: ORDER_ENTRIES.map((entry) => ({
          ...entry,
          count: countFor(entry.status),
        })),
      });
    } catch (cause) {
      // 统计为增强信息，失败时保持空态。
    }
  },

  goOrderEntry(event: MpTapEvent) {
    const status = String(event.currentTarget.dataset.status ?? "");
    wx.navigateTo({
      url: mpCapabilityUrl(
        "buyer.mall.orders",
        status && status !== "all" ? { status } : undefined,
      ),
    });
  },

  goCapability(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (!capability) {
      return;
    }
    wx.navigateTo({ url: mpCapabilityUrl(capability) });
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号？",
      success: (result) => {
        if (result.confirm) {
          clearSession();
          this.setData({ loggedIn: false, orderEntries: ORDER_ENTRIES });
        }
      },
    });
  },
});
