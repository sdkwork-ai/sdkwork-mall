import { type MpTapEvent } from "../../types/common";
import { getOrderStatistics } from "../../services/order-service";
import { isLoggedIn, clearSession } from "../../services/session";

const ORDER_ENTRIES: Array<{ status: string; label: string; count: string | number }> = [
  { status: "all", label: "全部订单", count: "" },
  { status: "PENDING_PAYMENT", label: "待付款", count: "" },
  { status: "PENDING_SHIPMENT", label: "待发货", count: "" },
  { status: "PENDING_RECEIPT", label: "待收货", count: "" },
  { status: "COMPLETED", label: "已完成", count: "" },
];

const QUICK_LINKS: Array<{ label: string; path: string }> = [
  { label: "我的收藏", path: "/pages/favorites/index" },
  { label: "浏览足迹", path: "/pages/footprint/index" },
  { label: "地址管理", path: "/pages/address/index" },
  { label: "领券中心", path: "/pages/coupons/index" },
  { label: "我的订单", path: "/pages/orders/index" },
  { label: "售后中心", path: "/pages/aftersales/index" },
  { label: "钱包", path: "/pages/wallet/index" },
  { label: "我的积分", path: "/pages/points/index" },
  { label: "会员中心", path: "/pages/membership/index" },
  { label: "发票", path: "/pages/invoices/index" },
  { label: "设置", path: "/pages/settings/index" },
  { label: "去逛逛", path: "home" },
];

interface BuyerData {
  loggedIn: boolean;
  orderEntries: Array<{ status: string; label: string; count: string | number }>;
  quickLinks: Array<{ label: string; path: string }>;
}

Page({
  data: {
    loggedIn: false,
    orderEntries: ORDER_ENTRIES,
    quickLinks: QUICK_LINKS,
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
    const query = status && status !== "all" ? `?status=${status}` : "";
    wx.navigateTo({ url: `/pages/orders/index${query}` });
  },

  goQuickLink(event: MpTapEvent) {
    const path = String(event.currentTarget.dataset.path ?? "");
    if (path === "home") {
      wx.switchTab({ url: "/pages/home/index" });
      return;
    }
    wx.navigateTo({ url: path });
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
