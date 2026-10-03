import { getPaymentSuccess } from "../../services/order-service";

interface PaymentResultData {
  orderId: string;
  paymentId: string;
  status: string;
  title: string;
  description: string;
  tone: string;
  loading: boolean;
  paymentMethod: string;
  _pollTimer: number | null;
}

Page({
  data: {
    orderId: "",
    paymentId: "",
    status: "pending",
    title: "支付处理中",
    description: "支付正在处理，请稍后查看订单状态。",
    tone: "warning",
    loading: true,
    paymentMethod: "",
    _pollTimer: null,
  } as PaymentResultData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({
      orderId: options.orderId || "",
      paymentId: options.paymentId || "",
      status: options.status || "pending",
    });
    this.render();
    this.pollPaymentSuccess();
  },

  onUnload() {
    if (this.data._pollTimer) {
      clearTimeout(this.data._pollTimer);
    }
  },

  render() {
    const { status } = this.data;
    if (status === "success") {
      this.setData({
        title: "支付成功",
        description: "商家将尽快为您发货。",
        tone: "success",
      });
    } else if (status === "failed") {
      this.setData({
        title: "支付失败",
        description: "支付未成功，可重新支付或联系客服。",
        tone: "danger",
      });
    }
  },

  pollPaymentSuccess() {
    if (!this.data.orderId) {
      this.setData({ loading: false });
      return;
    }
    const tick = async (): Promise<void> => {
      const info = await getPaymentSuccess(this.data.orderId);
      if (info && (info.paid === true || info.status === "PAID" || info.status === "COMPLETED")) {
        this.setData({
          status: "success",
          title: "支付成功",
          description: "商家将尽快为您发货。",
          tone: "success",
          loading: false,
        });
        return;
      }
      this.setData({ loading: false });
      this.setData({ _pollTimer: setTimeout(tick, 3000) });
    };
    tick();
  },

  goOrders() {
    wx.redirectTo({ url: "/pages/orders/index" });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  retryPay() {
    if (!this.data.orderId) {
      return;
    }
    wx.redirectTo({
      url: `/pages/cashier/index?orderId=${this.data.orderId}&paymentMethod=${this.data.paymentMethod || ""}`,
    });
  },
});
