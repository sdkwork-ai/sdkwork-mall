const cartService = require("../../services/cart-service");
const addressService = require("../../services/address-service");
const session = require("../../services/session");
const { formatCny } = require("../../utils/format");

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
  },

  onLoad(options) {
    this.cartItemIds = options.items ? options.items.split(",").filter(Boolean) : [];
    this.setData({ itemCount: this.cartItemIds.length });
  },

  onShow() {
    if (!session.isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    this.bootstrap();
  },

  async bootstrap() {
    this.setData({ loading: true, error: "" });
    try {
      const [addresses, coupons, quote] = await Promise.all([
        addressService.listAddresses().catch(() => []),
        cartService.listUserCoupons().catch(() => []),
        cartService.createCheckoutQuote({ cartItemIds: this.cartItemIds }).catch(() => null),
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
        error: cause && cause.message ? cause.message : "结算信息加载失败",
      });
    }
  },

  selectAddress(event) {
    this.setData({ selectedAddressId: event.currentTarget.dataset.id });
  },

  selectCoupon(event) {
    const couponId = event.currentTarget.dataset.id || "";
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

  onRemarkInput(event) {
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
      const result = await cartService.submitOrder({
        addressId: this.data.selectedAddressId,
        cartItemIds: this.cartItemIds,
        couponId: this.data.selectedCouponId || undefined,
        useWallet: this.data.useWallet,
        usePoints: this.data.usePoints,
        buyerRemark: this.data.buyerRemark.trim() || undefined,
      });
      wx.redirectTo({ url: `/pages/cashier/index?orderId=${result.orderId}` });
    } catch (cause) {
      this.showToast(cause && cause.message ? cause.message : "提交订单失败");
      this.setData({ busy: false });
    }
  },

  showToast(message) {
    this.setData({ toast: message });
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.setData({ toast: "" }), 2200);
  },
});
