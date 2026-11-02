import { getPaymentSuccess } from "../../services/order-service";
import { mpCapabilityUrl } from "../../routes/capabilities";

/** Payment providers settle asynchronously; poll, but never forever. */
const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_MAX_ATTEMPTS = 20;

interface PaymentResultData {
  orderId: string;
  paymentId: string;
  status: string;
  title: string;
  description: string;
  tone: string;
  loading: boolean;
  paymentMethod: string;
  pollExhausted: boolean;
  _pollAttempts: number;
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
    pollExhausted: false,
    _pollAttempts: 0,
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
      const attempts = this.data._pollAttempts + 1;
      if (attempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
        // A permanently failing settlement must not poll forever on a phone.
        this.setData({
          loading: false,
          pollExhausted: true,
          _pollAttempts: attempts,
          description: "支付结果确认超时，请到订单列表查看最新状态。",
        });
        return;
      }
      this.setData({ loading: false, _pollAttempts: attempts });
      this.setData({ _pollTimer: setTimeout(tick, PAYMENT_POLL_INTERVAL_MS) });
    };
    tick();
  },

  restartPoll() {
    if (!this.data.orderId) {
      return;
    }
    this.setData({
      pollExhausted: false,
      _pollAttempts: 0,
      loading: true,
      status: "pending",
      title: "支付处理中",
      description: "支付正在处理，请稍后查看订单状态。",
      tone: "warning",
    });
    this.pollPaymentSuccess();
  },

  goOrders() {
    wx.redirectTo({ url: mpCapabilityUrl("buyer.mall.orders") });
  },

  goHome() {
    wx.switchTab({ url: mpCapabilityUrl("storefront.mall.home") });
  },

  retryPay() {
    if (!this.data.orderId) {
      return;
    }
    wx.redirectTo({
      url: mpCapabilityUrl("storefront.mall.payment-cashier", { orderId: this.data.orderId, paymentMethod: this.data.paymentMethod || "" }),
    });
  },
});
