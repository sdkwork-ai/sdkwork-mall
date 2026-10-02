const ordersService = require("../../services/order-service");
const session = require("../../services/session");
const { formatCny, formatTime, statusLabel } = require("../../utils/format");

const TABS = [
  { code: "all", label: "全部" },
  { code: "PENDING_PAYMENT", label: "待付款" },
  { code: "PENDING_SHIPMENT", label: "待发货" },
  { code: "PENDING_RECEIPT", label: "待收货" },
  { code: "COMPLETED", label: "已完成" },
];

Page({
  data: {
    tabs: TABS,
    activeTab: "all",
    orders: [],
    page: 1,
    total: 0,
    loading: true,
    loadingMore: false,
    error: "",
  },

  onLoad(options) {
    const status = options.status && options.status !== "all" ? options.status : "all";
    this.setData({ activeTab: status });
  },

  onShow() {
    if (!session.isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    this.loadOrders(1);
  },

  async loadOrders(nextPage) {
    const { activeTab } = this.data;
    this.setData(nextPage === 1 ? { loading: true, error: "" } : { loadingMore: true });
    try {
      const result = await ordersService.listOrders({
        page: nextPage,
        pageSize: 20,
        status: activeTab,
      });
      const orders = result.orders.map((order) => ({
        ...order,
        statusText: statusLabel(order.status),
        totalText: formatCny(order.totalAmountCny),
        timeText: formatTime(order.createdAt),
      }));
      this.setData({
        orders: nextPage === 1 ? orders : this.data.orders.concat(orders),
        total: result.total,
        page: nextPage,
        loading: false,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        loadingMore: false,
        error: cause && cause.message ? cause.message : "订单加载失败",
      });
    }
  },

  selectTab(event) {
    const code = event.currentTarget.dataset.code;
    if (code === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: code, orders: [] });
    this.loadOrders(1);
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  async payOrder(event) {
    const orderId = event.currentTarget.dataset.id;
    try {
      const paymentId = await ordersService.payOrder(orderId, "WECHAT");
      wx.redirectTo({
        url: `/pages/payment-result/index?orderId=${orderId}&paymentId=${paymentId}&status=pending`,
      });
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "发起支付失败", icon: "none" });
    }
  },

  async cancelOrder(event) {
    const orderId = event.currentTarget.dataset.id;
    try {
      await ordersService.cancelOrder(orderId);
      wx.showToast({ title: "已取消", icon: "success" });
      this.loadOrders(1);
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "取消失败", icon: "none" });
    }
  },

  async confirmReceipt(event) {
    const orderId = event.currentTarget.dataset.id;
    try {
      await ordersService.confirmReceipt(orderId);
      wx.showToast({ title: "已确认收货", icon: "success" });
      this.loadOrders(1);
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "确认收货失败", icon: "none" });
    }
  },

  loadMore() {
    if (this.data.loadingMore || this.data.orders.length >= this.data.total) {
      return;
    }
    this.loadOrders(this.data.page + 1);
  },
});
