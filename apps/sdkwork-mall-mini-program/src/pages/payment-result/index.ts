import { t } from "../../i18n";
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
  orderNoText: string;
  paymentNoText: string;
  loadingText: string;
  ordersText: string;
  refreshText: string;
  retryPayText: string;
  continueShoppingText: string;
  _pollAttempts: number;
  _pollTimer: number | null;
}

function pendingCopy(): { title: string; description: string } {
  return {
    title: t("paymentResult.status.pending.title"),
    description: t("paymentResult.status.pending.description"),
  };
}

function successCopy(): { title: string; description: string } {
  return {
    title: t("paymentResult.status.success.title"),
    description: t("paymentResult.status.success.description"),
  };
}

Page({
  data: {
    orderId: "",
    paymentId: "",
    status: "pending",
    title: pendingCopy().title,
    description: pendingCopy().description,
    tone: "warning",
    loading: true,
    paymentMethod: "",
    pollExhausted: false,
    orderNoText: "",
    paymentNoText: "",
    loadingText: t("paymentResult.loading"),
    ordersText: t("paymentResult.actions.orders"),
    refreshText: t("paymentResult.actions.refresh"),
    retryPayText: t("paymentResult.actions.retryPay"),
    continueShoppingText: t("paymentResult.actions.continueShopping"),
    _pollAttempts: 0,
    _pollTimer: null,
  } as PaymentResultData,

  onLoad(options: Record<string, string | undefined>) {
    const orderId = options.orderId || "";
    const paymentId = options.paymentId || "";
    this.setData({
      orderId,
      paymentId,
      status: options.status || "pending",
      orderNoText: orderId ? t("paymentResult.orderNo", { id: orderId }) : "",
      paymentNoText: paymentId ? t("paymentResult.paymentNo", { id: paymentId }) : "",
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
      this.setData({ ...successCopy(), tone: "success" });
    } else if (status === "failed") {
      this.setData({
        title: t("paymentResult.status.failed.title"),
        description: t("paymentResult.status.failed.description"),
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
          ...successCopy(),
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
          description: t("paymentResult.pollTimeout"),
        });
        return;
      }
      this.setData({ loading: false, _pollAttempts: attempts });
      this.setData({ _pollTimer: setTimeout(tick, PAYMENT_POLL_INTERVAL_MS) });
    };
    void tick();
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
      ...pendingCopy(),
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
      url: mpCapabilityUrl("storefront.mall.payment-cashier", {
        orderId: this.data.orderId,
        paymentMethod: this.data.paymentMethod || "",
      }),
    });
  },
});
