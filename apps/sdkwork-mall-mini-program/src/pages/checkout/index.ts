import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { type MpAddress, listAddresses } from "../../services/address-service";
import { type MpCheckoutQuote, createCheckoutQuote, listUserCoupons, submitOrder } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";

interface MpCouponOption {
  discountAmountCny: number | null;
  id: string;
  minSpendCny: number | null;
  title: string;
  validUntil: string;
}

/** 配送方式；运费由服务端按选择计入报价。 */
const DELIVERY_METHODS = [
  { code: "standard", description: "3-5 天送达 · 免费", label: "普通配送" },
  { code: "express", description: "次日送达 · ¥12.00", label: "极速达" },
  { code: "sf", description: "当日达 · ¥22.00", label: "顺丰速运" },
];

interface CheckoutData {
  addresses: MpAddress[];
  selectedAddressId: string;
  coupons: MpCouponOption[];
  selectedCouponId: string;
  deliveryMethods: Array<{ code: string; description: string; label: string }>;
  deliveryMethodCode: string;
  giftCardCode: string;
  giftCardApplied: string;
  giftCardError: string;
  useWallet: boolean;
  usePoints: boolean;
  buyerRemark: string;
  needInvoice: boolean;
  invoiceTitleType: "company" | "personal";
  invoiceTitle: string;
  invoiceTaxNumber: string;
  invoiceEmail: string;
  quote: MpCheckoutQuote | null;
  quoteError: string;
  payableText: string;
  originalAmountText: string;
  discountAmountText: string;
  itemCount: number;
  loading: boolean;
  busy: boolean;
  error: string;
  toast: string;
  _cartItemIds: string[];
  _toastTimer: number | null;
}

Page({
  data: {
    addresses: [],
    selectedAddressId: "",
    coupons: [],
    selectedCouponId: "",
    deliveryMethods: DELIVERY_METHODS,
    deliveryMethodCode: "standard",
    giftCardCode: "",
    giftCardApplied: "",
    giftCardError: "",
    useWallet: false,
    usePoints: false,
    buyerRemark: "",
    needInvoice: false,
    invoiceTitleType: "personal",
    invoiceTitle: "",
    invoiceTaxNumber: "",
    invoiceEmail: "",
    quote: null,
    quoteError: "",
    payableText: "--",
    originalAmountText: "",
    discountAmountText: "",
    itemCount: 0,
    loading: true,
    busy: false,
    error: "",
    toast: "",
    _cartItemIds: [],
    _toastTimer: null,
  } as CheckoutData,

  onLoad(options: Record<string, string | undefined>) {
    const cartItemIds = options.items ? options.items.split(",").filter(Boolean) : [];
    this.setData({ _cartItemIds: cartItemIds, itemCount: cartItemIds.length });
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: mpCapabilityUrl("account.mall.login") });
      return;
    }
    void this.bootstrap();
  },

  async bootstrap() {
    this.setData({ loading: true, error: "" });
    try {
      const [addresses, coupons] = await Promise.all([
        listAddresses().catch(() => []),
        listUserCoupons().catch(() => []),
      ]);
      // The quote is the authoritative payable amount. A failed quote must be
      // visible and must block submission instead of ordering an unknown total.
      let quote: MpCheckoutQuote | null = null;
      let quoteError = "";
      try {
        quote = await createCheckoutQuote({ cartItemIds: this.data._cartItemIds });
      } catch (cause) {
        quoteError = errorMessage(cause, "应付金额加载失败");
      }
      const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
      this.setData({
        addresses,
        coupons,
        quote,
        quoteError,
        payableText: quote && quote.payableAmountCny != null ? formatCny(quote.payableAmountCny) : "--",
        originalAmountText:
          quote && quote.originalAmountCny != null ? formatCny(quote.originalAmountCny) : "",
        discountAmountText:
          quote && quote.discountAmountCny != null && quote.discountAmountCny > 0
            ? formatCny(quote.discountAmountCny)
            : "",
        selectedAddressId: defaultAddress ? defaultAddress.id : "",
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "结算信息加载失败"),
      });
    }
  },

  selectAddress(event: MpTapEvent) {
    this.setData({ selectedAddressId: String(event.currentTarget.dataset.id ?? "") });
  },

  selectCoupon(event: MpTapEvent) {
    const couponId = String(event.currentTarget.dataset.id ?? "");
    this.setData({
      selectedCouponId: this.data.selectedCouponId === couponId ? "" : couponId,
    });
  },

  toggleWallet() {
    this.setData({ useWallet: !this.data.useWallet });
  },

  selectDeliveryMethod(event: MpTapEvent) {
    this.setData({
      deliveryMethodCode: String(event.currentTarget.dataset.code ?? "standard"),
    });
  },

  onGiftCardInput(event: MpInputEvent) {
    this.setData({ giftCardCode: event.detail.value });
  },

  applyGiftCard() {
    const code = this.data.giftCardCode.trim();
    if (!code) {
      this.setData({ giftCardError: "请输入礼品卡卡号" });
      return;
    }
    if (code.length < 8) {
      this.setData({ giftCardError: "礼品卡卡号格式不正确" });
      return;
    }
    this.setData({ giftCardApplied: code, giftCardCode: "", giftCardError: "" });
  },

  removeGiftCard() {
    this.setData({ giftCardApplied: "", giftCardCode: "", giftCardError: "" });
  },

  togglePoints() {
    this.setData({ usePoints: !this.data.usePoints });
  },

  onRemarkInput(event: MpInputEvent) {
    this.setData({ buyerRemark: event.detail.value });
  },

  toggleInvoice() {
    this.setData({ needInvoice: !this.data.needInvoice });
  },

  selectInvoiceTitleType(event: MpTapEvent) {
    this.setData({
      invoiceTitleType:
        String(event.currentTarget.dataset.type ?? "") === "company" ? "company" : "personal",
    });
  },

  onInvoiceTitleInput(event: MpInputEvent) {
    this.setData({ invoiceTitle: event.detail.value });
  },

  onInvoiceTaxNumberInput(event: MpInputEvent) {
    this.setData({ invoiceTaxNumber: event.detail.value });
  },

  onInvoiceEmailInput(event: MpInputEvent) {
    this.setData({ invoiceEmail: event.detail.value });
  },

  goAddress() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.addresses", { picker: "1" }) });
  },

  async submit() {
    if (!this.data.selectedAddressId) {
      this.showToast("请选择收货地址");
      return;
    }
    if (!this.data.quote) {
      this.showToast(this.data.quoteError || "应付金额未就绪，请重试");
      return;
    }
    if (this.data.needInvoice) {
      if (!this.data.invoiceTitle.trim()) {
        this.showToast(
          this.data.invoiceTitleType === "company"
            ? "请填写发票抬头（公司名称）"
            : "请填写发票抬头（个人姓名）",
        );
        return;
      }
      if (this.data.invoiceTitleType === "company") {
        if (!this.data.invoiceTaxNumber.trim()) {
          this.showToast("请填写企业税号");
          return;
        }
        if (!/^[A-Z0-9]{15,20}$/.test(this.data.invoiceTaxNumber.trim())) {
          this.showToast("税号格式不正确（15-20 位字母或数字）");
          return;
        }
      }
    }
    this.setData({ busy: true });
    try {
      const result = await submitOrder({
        addressId: this.data.selectedAddressId,
        cartItemIds: this.data._cartItemIds,
        couponId: this.data.selectedCouponId || undefined,
        deliveryMethod: this.data.deliveryMethodCode,
        giftCardCode: this.data.giftCardApplied || undefined,
        invoiceForm: this.data.needInvoice
          ? {
              email: this.data.invoiceEmail.trim() || undefined,
              taxNumber:
                this.data.invoiceTitleType === "company"
                  ? this.data.invoiceTaxNumber.trim()
                  : undefined,
              title: this.data.invoiceTitle.trim(),
              titleType: this.data.invoiceTitleType,
            }
          : undefined,
        needInvoice: this.data.needInvoice,
        useWallet: this.data.useWallet,
        usePoints: this.data.usePoints,
        buyerRemark: this.data.buyerRemark.trim() || undefined,
      });
      const next = () =>
        wx.redirectTo({ url: mpCapabilityUrl("storefront.mall.payment-cashier", { orderId: result.orderId }) });
      if (result.warnings.length > 0) {
        // The order exists and will be paid: tell the buyer which deduction did
        // not apply before sending them to the cashier.
        wx.showModal({
          title: "部分优惠未生效",
          content: result.warnings.join("\n"),
          showCancel: false,
          complete: next,
        });
      } else {
        next();
      }
    } catch (cause) {
      this.showToast(errorMessage(cause, "提交订单失败"));
      this.setData({ busy: false });
    }
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },

  retry() {
    void this.bootstrap();
  },
});
