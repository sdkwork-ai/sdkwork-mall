const ordersService = require("../../services/order-service");
const session = require("../../services/session");

const ORDER_ENTRIES = [
  { status: "all", label: "全部订单", count: "" },
  { status: "PENDING_PAYMENT", label: "待付款", count: "" },
  { status: "PENDING_SHIPMENT", label: "待发货", count: "" },
  { status: "PENDING_RECEIPT", label: "待收货", count: "" },
  { status: "COMPLETED", label: "已完成", count: "" },
];

const QUICK_LINKS = [
  { label: "地址管理", path: "/pages/address/index" },
  { label: "领券中心", path: "/pages/coupons/index" },
  { label: "我的订单", path: "/pages/orders/index" },
  { label: "去逛逛", path: "home" },
];

Page({
  data: {
    loggedIn: false,
    orderEntries: ORDER_ENTRIES,
    quickLinks: QUICK_LINKS,
  },

  onShow() {
    const loggedIn = session.isLoggedIn();
    this.setData({ loggedIn });
    if (loggedIn) {
      this.loadStatistics();
    }
  },

  async loadStatistics() {
    try {
      const statistics = await ordersService.getOrderStatistics();
      const countFor = (status) => {
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

  goOrderEntry(event) {
    const status = event.currentTarget.dataset.status;
    const query = status && status !== "all" ? `?status=${status}` : "";
    wx.navigateTo({ url: `/pages/orders/index${query}` });
  },

  goQuickLink(event) {
    const path = event.currentTarget.dataset.path;
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
          session.clearToken();
          this.setData({ loggedIn: false, orderEntries: ORDER_ENTRIES });
        }
      },
    });
  },
});
