import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { listPaymentMethods, payOrder, type MpWechatPayParams } from "../../services/cart-service";

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
    const { orderId, selectedCode } = this.data;
    if (!selectedCode) {
      this.setData({ error: t("cashier.errors.methodRequired") });
      return;
    }
    this.setData({ paying: true, error: "" });
    try {
      const payment = await payOrder(orderId, selectedCode);
      if (payment.wechatPay) {
        // Real WeChat Pay handoff: the native cashier completes the charge.
        await this.requestWechatPayment(payment.wechatPay);
      } else if (payment.paymentUrl) {
        // Outside channels (e.g. H5/QR) cannot be opened inside the mini
        // program: copy the link so the buyer can finish in a browser.
        wx.setClipboardData({ data: payment.paymentUrl });
        wx.showModal({
          title: t("cashier.browserHintTitle"),
          content: t("cashier.browserHint"),
          showCancel: false,
        });
      }
      wx.redirectTo({
        url: mpCapabilityUrl("storefront.mall.payment-result", {
          orderId,
          paymentId: payment.paymentId,
          paymentMethod: selectedCode,
          status: "pending",
        }),
      });
    } catch (cause) {
      this.setData({
        paying: false,
        error: errorMessage(cause, t("cashier.errors.payFailed")),
      });
    }
  },

  requestWechatPayment(params: MpWechatPayParams): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wx.requestPayment({
        nonceStr: params.nonceStr,
        package: params.package,
        paySign: params.paySign,
        signType: params.signType,
        timeStamp: params.timeStamp,
        success: () => resolve(),
        fail: (result) => {
          const cancelled = String(result.errMsg ?? "").includes("cancel");
          reject(
            new Error(
              cancelled ? t("cashier.errors.cancelled") : t("cashier.errors.payFailed"),
            ),
          );
        },
      });
    });
  },

  cancel() {
    wx.redirectTo({ url: mpCapabilityUrl("buyer.mall.orders", { status: "PENDING_PAYMENT" }) });
  },

  retry() {
    void this.loadMethods();
  },
});
