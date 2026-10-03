import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
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

interface CheckoutData {
  addresses: MpAddress[];
  selectedAddressId: string;
  coupons: MpCouponOption[];
  selectedCouponId: string;
  useWallet: boolean;
  usePoints: boolean;
  buyerRemark: string;
  quote: MpCheckoutQuote | null;
  payableText: string;
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
    useWallet: false,
    usePoints: false,
    buyerRemark: "",
    quote: null,
    payableText: "--",
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
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    void this.bootstrap();
  },

  async bootstrap() {
    this.setData({ loading: true, error: "" });
    try {
      const [addresses, coupons, quote] = await Promise.all([
        listAddresses().catch(() => []),
        listUserCoupons().catch(() => []),
        createCheckoutQuote({ cartItemIds: this.data._cartItemIds }).catch(() => null),
      ]);
      const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
      this.setData({
        addresses,
        coupons,
        quote,
        payableText: quote && quote.payableAmountCny != null ? formatCny(quote.payableAmountCny) : "--",
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

  togglePoints() {
    this.setData({ usePoints: !this.data.usePoints });
  },

  onRemarkInput(event: MpInputEvent) {
    this.setData({ buyerRemark: event.detail.value });
  },

  goAddress() {
    wx.navigateTo({ url: "/pages/address/index?picker=1" });
  },

  async submit() {
    if (!this.data.selectedAddressId) {
      this.showToast("请选择收货地址");
      return;
    }
    this.setData({ busy: true });
    try {
      const result = await submitOrder({
        addressId: this.data.selectedAddressId,
        cartItemIds: this.data._cartItemIds,
        couponId: this.data.selectedCouponId || undefined,
        useWallet: this.data.useWallet,
        usePoints: this.data.usePoints,
        buyerRemark: this.data.buyerRemark.trim() || undefined,
      });
      wx.redirectTo({ url: `/pages/cashier/index?orderId=${result.orderId}` });
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
});
