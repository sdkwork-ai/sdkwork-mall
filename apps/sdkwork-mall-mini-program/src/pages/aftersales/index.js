const { formatCny } = require("../../utils/format");
const ordersService = require("../../services/order-service");
const aftersales = require("../../services/aftersales-service");

Page({
  data: {
    presetOrderId: "",
    orderId: "",
    orderLoaded: false,
    orderItems: [],
    orderSummary: "",
    types: aftersales.AFTER_SALES_TYPES,
    typeIndex: 0,
    reasons: aftersales.AFTER_SALES_REASON_PRESETS,
    reasonIndex: 0,
    description: "",
    amount: "",
    requests: [],
    loading: true,
    loadingOrder: false,
    busy: false,
    error: "",
  },

  onLoad(options) {
    const presetOrderId = options && options.orderId ? options.orderId : "";
    this.setData({ presetOrderId, orderId: presetOrderId });
    if (presetOrderId) {
      this.loadOrder();
    }
    this.reloadRequests();
  },

  onOrderIdInput(event) {
    this.setData({ orderId: event.detail.value });
  },

  onDescriptionInput(event) {
    this.setData({ description: event.detail.value });
  },

  onAmountInput(event) {
    this.setData({ amount: event.detail.value });
  },

  onTypeChange(event) {
    this.setData({ typeIndex: Number(event.detail.value) || 0 });
  },

  onReasonChange(event) {
    this.setData({ reasonIndex: Number(event.detail.value) || 0 });
  },

  async loadOrder() {
    const orderId = this.data.orderId.trim();
    if (!orderId) {
      this.setData({ error: "请填写订单号" });
      return;
    }
    this.setData({ loadingOrder: true, error: "" });
    try {
      const detail = await ordersService.getOrderDetail(orderId);
      const reference = detail.paidAmountCny ?? detail.totalAmountCny;
      this.setData({
        orderLoaded: true,
        loadingOrder: false,
        orderSummary: `${detail.items.length} 项商品${reference != null ? ` · 实付 ${formatCny(reference)}` : ""}`,
        amount: this.data.amount || (reference != null ? reference.toFixed(2) : ""),
        orderItems: detail.items.map((item) => ({
          orderItemId: item.id,
          requestedQuantity: item.quantity,
          refundAmountCny: item.priceCny != null ? Number((item.priceCny * item.quantity).toFixed(2)) : null,
        })),
      });
    } catch (cause) {
      this.setData({
        loadingOrder: false,
        orderLoaded: false,
        orderItems: [],
        orderSummary: "",
        error: cause && cause.message ? cause.message : "订单加载失败",
      });
    }
  },

  clearOrder() {
    this.setData({
      orderId: "",
      presetOrderId: "",
      orderLoaded: false,
      orderItems: [],
      orderSummary: "",
      amount: "",
    });
  },

  async reloadRequests() {
    try {
      const requests = await aftersales.listRequests();
      this.setData({ requests, loading: false });
    } catch (cause) {
      this.setData({
        loading: false,
        error: cause && cause.message ? cause.message : "售后列表加载失败",
      });
    }
  },

  async submit() {
    if (!this.data.orderLoaded || !this.data.orderItems || this.data.orderItems.length === 0) {
      this.setData({ error: "请先读取订单" });
      return;
    }
    const amount = Number(this.data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.setData({ error: "请填写有效的售后金额" });
      return;
    }
    const type = this.data.types[this.data.typeIndex];
    this.setData({ busy: true, error: "" });
    try {
      await aftersales.createRequest({
        orderId: this.data.orderId.trim(),
        afterSalesType: type.value,
        reasonCode: this.data.reasons[this.data.reasonIndex].code,
        description: this.data.description,
        requestedAmountCny: amount,
        items: this.data.orderItems,
      });
      this.setData({ description: "", orderItems: [], orderLoaded: false, orderSummary: "", amount: "", orderId: "", presetOrderId: "" });
      wx.showToast({ title: "售后申请已提交", icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: cause && cause.message ? cause.message : "售后申请失败" });
    } finally {
      this.setData({ busy: false });
    }
  },

  async cancelRequest(event) {
    const requestId = event.currentTarget.dataset.id;
    if (!requestId) {
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await aftersales.cancelRequest(requestId);
      wx.showToast({ title: "已撤销", icon: "success" });
      await this.reloadRequests();
    } catch (cause) {
      this.setData({ error: cause && cause.message ? cause.message : "撤销失败" });
    } finally {
      this.setData({ busy: false });
    }
  },
});
