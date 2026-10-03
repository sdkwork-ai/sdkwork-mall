import { errorMessage, type MpTapEvent } from "../../types/common";
import { listPaymentMethods, payOrder } from "../../services/cart-service";

interface CashierData {
  orderId: string;
  methods: Array<{ code: string; id: string; label: string }>;
  selectedCode: string;
  loading: boolean;
  paying: boolean;
  error: string;
  _preselectedCode: string;
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
  } as CashierData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ orderId: options.orderId || "", _preselectedCode: options.paymentMethod || "" });
    void this.loadMethods();
  },

  async loadMethods() {
    if (!this.data.orderId) {
      this.setData({ loading: false, error: "缺少订单参数" });
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
        error: errorMessage(cause, "支付方式加载失败"),
      });
    }
  },

  selectMethod(event: MpTapEvent) {
    this.setData({ selectedCode: String(event.currentTarget.dataset.code ?? "") });
  },

  async pay() {
    const { orderId, selectedCode } = this.data;
    if (!selectedCode) {
      this.setData({ error: "请选择支付方式" });
      return;
    }
    this.setData({ paying: true, error: "" });
    try {
      const paymentId = await payOrder(orderId, selectedCode);
      // 真实渠道接入后此处调用 wx.requestPayment 拉起收银台；
      // 当前模拟渠道直接进入支付结果页轮询。
      wx.redirectTo({
        url: `/pages/payment-result/index?orderId=${orderId}&paymentId=${paymentId}&paymentMethod=${selectedCode}&status=pending`,
      });
    } catch (cause) {
      this.setData({
        paying: false,
        error: errorMessage(cause, "发起支付失败，请稍后再试"),
      });
    }
  },

  cancel() {
    wx.redirectTo({ url: `/pages/orders/index?status=PENDING_PAYMENT` });
  },
});
