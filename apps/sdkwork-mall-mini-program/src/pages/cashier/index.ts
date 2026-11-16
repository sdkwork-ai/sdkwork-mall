import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { listPaymentMethods, payOrder, type MpWechatPayParams } from "../../services/cart-service";
import { platform } from "@sdkwork/mall-mp-core";

interface CashierData {
  orderId: string;
  methods: Array<{ code: string; id: string; label: string }>;
  selectedCode: string;
  loading: boolean;
  paying: boolean;
  error: string;
  _preselectedCode: string;
  loadingText: string;
  retryText: string;
  titleText: string;
  orderNoText: string;
  methodsTitle: string;
  methodsEmpty: string;
  payText: string;
  payingText: string;
  laterText: string;
}

Page({
  data: {
    orderId: "",
    methods: [],
    selectedCode: "",
    loading: true,
    paying: false,
    error: "",
    _preselectedCode: "",
    loadingText: t("cashier.loading"),
    retryText: t("cashier.retry"),
    titleText: t("cashier.title"),
    orderNoText: "",
    methodsTitle: t("cashier.methodsTitle"),
    methodsEmpty: t("cashier.methodsEmpty"),
    payText: t("cashier.pay"),
    payingText: t("cashier.paying"),
    laterText: t("cashier.later"),
  } as CashierData,

  onLoad(options: Record<string, string | undefined>) {
    const orderId = options.orderId || "";
    this.setData({
      orderId,
      _preselectedCode: options.paymentMethod || "",
      orderNoText: t("cashier.orderNo", { id: orderId }),
    });
    void this.loadMethods();
  },

  async loadMethods() {
    if (!this.data.orderId) {
      this.setData({ loading: false, error: t("cashier.errors.missingOrder") });
      return;
    }
    try {
      const methods = await listPaymentMethods();
      this.setData({
        methods,
        selectedCode: this.data._preselectedCode || (methods[0] ? methods[0].code : ""),
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("cashier.errors.methodsLoadFailed")),
      });
    }
  },

  selectMethod(event: MpTapEvent) {
    this.setData({ selectedCode: String(event.currentTarget.dataset.code ?? "") });
  },

  async pay() {
    if (this.data.paying) {
      return;
    }
    const { orderId, selectedCode } = this.data;
    if (!selectedCode) {
      this.setData({ error: t("cashier.errors.methodRequired") });
      return;
    }
    this.setData({ paying: true, error: "" });
    try {
      const payment = await payOrder(orderId, selectedCode);
      // The result page is told what actually happened: a completed native
      // WeChat Pay handoff is a success, every deferred channel is pending.
      let status = "pending";
      if (payment.wechatPay) {
        // Real WeChat Pay handoff: the native cashier completes the charge.
        await this.requestWechatPayment(payment.wechatPay);
        status = "success";
      } else if (payment.paymentUrl) {
        // Outside channels (e.g. H5/QR) cannot be opened inside the mini
        // program: copy the link so the buyer can finish in a browser.
        void platform.copy(payment.paymentUrl);
        await platform.alert({
          title: t("cashier.browserHintTitle"),
          content: t("cashier.browserHint"),
        });
      }
      platform.redirectTo(mpCapabilityUrl("storefront.mall.payment-result", {
        orderId,
        paymentId: payment.paymentId,
        paymentMethod: selectedCode,
        status,
      }));
    } catch (cause) {
      this.setData({
        paying: false,
        error: errorMessage(cause, t("cashier.errors.payFailed")),
      });
    }
  },

  /**
   * Hands the prepay parameters to the platform cashier through the host bridge.
   *
   * A dismissed cashier surfaces as `cancelled` on the host error, which is a
   * different message than a failed charge.
   */
  async requestWechatPayment(params: MpWechatPayParams): Promise<void> {
    try {
      await platform.requestPayment({
        nonceStr: params.nonceStr,
        package: params.package,
        paySign: params.paySign,
        signType: params.signType,
        timeStamp: params.timeStamp,
      });
    } catch (cause) {
      const cancelled = (cause as { code?: string } | null)?.code === "cancelled";
      throw new Error(cancelled ? t("cashier.errors.cancelled") : t("cashier.errors.payFailed"));
    }
  },

  cancel() {
    platform.redirectTo(mpCapabilityUrl("buyer.mall.orders", { status: "PENDING_PAYMENT" }));
  },

  retry() {
    void this.loadMethods();
  },
});
