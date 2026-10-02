const ordersService = require("../../services/order-service");
const { formatCny, formatTime, statusLabel } = require("../../utils/format");

Page({
  data: {
    detail: null,
    loading: true,
    error: "",
  },

  onLoad(options) {
    this.orderId = options.id || "";
  },

  onShow() {
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, error: "" });
    try {
      const detail = await ordersService.getOrderDetail(this.orderId);
      this.setData({
        detail: {
          ...detail,
          statusText: statusLabel(detail.status),
          totalText: formatCny(detail.totalAmountCny),
          paidText: detail.paidAmountCny != null ? formatCny(detail.paidAmountCny) : "未支付",
          timeText: formatTime(detail.createdAt),
          items: detail.items.map((item) => ({
            ...item,
            priceText: formatCny(item.priceCny),
          })),
        },
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: cause && cause.message ? cause.message : "订单加载失败",
      });
    }
  },

  goProduct(event) {
    const spuId = event.currentTarget.dataset.spu;
    if (spuId) {
      wx.navigateTo({ url: `/pages/product/index?id=${spuId}` });
    }
  },

  async pay() {
    try {
      const paymentId = await ordersService.payOrder(this.orderId, this.data.detail.paymentMethod || "WECHAT");
      wx.redirectTo({
        url: `/pages/payment-result/index?orderId=${this.orderId}&paymentId=${paymentId}&status=pending`,
      });
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "发起支付失败", icon: "none" });
    }
  },

  async cancel() {
    try {
      await ordersService.cancelOrder(this.orderId);
      wx.showToast({ title: "已取消", icon: "success" });
      this.loadDetail();
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "取消失败", icon: "none" });
    }
  },

  async confirmReceipt() {
    try {
      await ordersService.confirmReceipt(this.orderId);
      wx.showToast({ title: "已确认收货", icon: "success" });
      this.loadDetail();
    } catch (cause) {
      wx.showToast({ title: cause && cause.message ? cause.message : "确认收货失败", icon: "none" });
    }
  },

  goOrders() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: "/pages/orders/index" });
      },
    });
  },
});
