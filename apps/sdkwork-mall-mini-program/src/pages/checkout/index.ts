import { t } from "../../i18n";
import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { type MpAddress, listAddresses } from "../../services/address-service";
import { type MpCheckoutQuote, createCheckoutQuote, getCart, listUserCoupons, submitOrder } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";
import { createMpIdempotencyParams, platform } from "@sdkwork/mall-mp-core";
import { syncCartTabBadge } from "../../services/tab-bar-service";

interface MpCouponOption {
  discountAmountCny: number | null;
  id: string;
  minSpendCny: number | null;
  thresholdText: string;
  title: string;
  validUntil: string;
}

/** 配送方式；运费由服务端按选择计入报价。 */
const DELIVERY_METHODS = [
  {
    code: "standard",
    descriptionKey: "checkout.delivery.standard.description",
    labelKey: "checkout.delivery.standard.label",
  },
  {
    code: "express",
    descriptionKey: "checkout.delivery.express.description",
    labelKey: "checkout.delivery.express.label",
  },
  {
    code: "sf",
    descriptionKey: "checkout.delivery.sf.description",
    labelKey: "checkout.delivery.sf.label",
  },
];

function resolveDeliveryMethods(): Array<{ code: string; description: string; label: string }> {
  return DELIVERY_METHODS.map((method) => ({
    code: method.code,
    description: t(method.descriptionKey),
    label: t(method.labelKey),
  }));
}

interface CheckoutData {
  addresses: MpAddress[];
  /** The lines being bought, projected for display (WXML cannot call formatters). */
  goods: Array<{
    id: string;
    title: string;
    skuName: string;
    imageUrl: string;
    quantity: number;
    priceText: string;
  }>;
  selectedAddressId: string;
  coupons: MpCouponOption[];
  selectedCouponId: string;
  deliveryMethods: Array<{ code: string; description: string; label: string }>;
  deliveryMethodCode: string;
  giftCardCode: string;
  giftCardApplied: string;
  giftCardAppliedText: string;
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
  loadingText: string;
  retryText: string;
  selectedCountText: string;
  addressTitle: string;
  addressManage: string;
  addressEmpty: string;
  defaultLabel: string;
  deliveryTitle: string;
  couponTitle: string;
  couponNone: string;
  couponEmpty: string;
  deductTitle: string;
  walletLabel: string;
  pointsLabel: string;
  giftCardTitle: string;
  giftCardRemove: string;
  giftCardPlaceholder: string;
  giftCardApply: string;
  remarkTitle: string;
  remarkPlaceholder: string;
  invoiceNeed: string;
  invoicePersonal: string;
  invoiceCompany: string;
  invoiceTitleLabel: string;
  invoiceTitlePlaceholder: string;
  invoiceTaxLabel: string;
  invoiceTaxPlaceholder: string;
  invoiceEmailLabel: string;
  invoiceEmailPlaceholder: string;
  summaryGoods: string;
  summaryDiscount: string;
  summaryPayable: string;
  goodsTitle: string;
  submitText: string;
  submittingText: string;
  _cartItemIds: string[];
  /** One key per checkout attempt; reused when the buyer retries after a timeout. */
  _submitKey: string;
  _toastTimer: number | null;
}

Page({
  data: {
    addresses: [],
    goods: [],
    selectedAddressId: "",
    coupons: [],
    selectedCouponId: "",
    deliveryMethods: resolveDeliveryMethods(),
    deliveryMethodCode: "standard",
    giftCardCode: "",
    giftCardApplied: "",
    giftCardAppliedText: "",
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
    loadingText: t("checkout.loading"),
    retryText: t("checkout.retry"),
    selectedCountText: "",
    addressTitle: t("checkout.address.title"),
    addressManage: t("checkout.address.manage"),
    addressEmpty: t("checkout.address.empty"),
    defaultLabel: t("checkout.address.default"),
    deliveryTitle: t("checkout.delivery.title"),
    couponTitle: t("checkout.coupon.title"),
    couponNone: t("checkout.coupon.none"),
    couponEmpty: t("checkout.coupon.empty"),
    deductTitle: t("checkout.deduct.title"),
    walletLabel: t("checkout.deduct.wallet"),
    pointsLabel: t("checkout.deduct.points"),
    giftCardTitle: t("checkout.giftCard.title"),
    giftCardRemove: t("checkout.giftCard.remove"),
    giftCardPlaceholder: t("checkout.giftCard.placeholder"),
    giftCardApply: t("checkout.giftCard.apply"),
    remarkTitle: t("checkout.remark.title"),
    remarkPlaceholder: t("checkout.remark.placeholder"),
    invoiceNeed: t("checkout.invoice.need"),
    invoicePersonal: t("checkout.invoice.personal"),
    invoiceCompany: t("checkout.invoice.company"),
    invoiceTitleLabel: t("checkout.invoice.titleLabel"),
    invoiceTitlePlaceholder: t("checkout.invoice.titlePlaceholder"),
    invoiceTaxLabel: t("checkout.invoice.taxLabel"),
    invoiceTaxPlaceholder: t("checkout.invoice.taxPlaceholder"),
    invoiceEmailLabel: t("checkout.invoice.emailLabel"),
    invoiceEmailPlaceholder: t("checkout.invoice.emailPlaceholder"),
    summaryGoods: t("checkout.summary.goods"),
    summaryDiscount: t("checkout.summary.discount"),
    summaryPayable: t("checkout.summary.payable"),
    goodsTitle: t("checkout.goods.title"),
    submitText: t("checkout.submit"),
    submittingText: t("checkout.submitting"),
    _cartItemIds: [],
    // Minted per checkout visit in onLoad: one key per attempt, reused on retry.
    _submitKey: "",
    _toastTimer: null,
  } as CheckoutData,

  onLoad(options: Record<string, string | undefined>) {
    const cartItemIds = options.items ? options.items.split(",").filter(Boolean) : [];
    this.setData({
      _cartItemIds: cartItemIds,
      _submitKey: createMpIdempotencyParams().idempotencyKey,
      itemCount: cartItemIds.length,
      selectedCountText:
        cartItemIds.length > 0
          ? t("checkout.selectedCount", { count: cartItemIds.length })
          : "",
    });
  },

  onShow() {
    if (!isLoggedIn()) {
      platform.navigateTo(mpCapabilityUrl("account.mall.login"));
      return;
    }
    void this.bootstrap();
  },

  async bootstrap() {
    this.setData({ loading: true, error: "" });
    try {
      const [addresses, coupons, cart] = await Promise.all([
        listAddresses(),
        listUserCoupons().catch(() => []),
        getCart(),
      ]);
      const selectedIds = this.data._cartItemIds;
      const goods = cart.items
        .filter((item) => selectedIds.length === 0 || selectedIds.indexOf(item.id) >= 0)
        .map((item) => ({
          id: item.id,
          title: item.title,
          skuName: item.skuName,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          priceText: item.priceCny != null ? formatCny(item.priceCny) : t("checkout.goods.priceUnknown"),
        }));
      // The quote is the authoritative payable amount. A failed quote must be
      // visible and must block submission instead of ordering an unknown total.
      let quote: MpCheckoutQuote | null = null;
      let quoteError = "";
      try {
        quote = await createCheckoutQuote({ cartItemIds: this.data._cartItemIds });
      } catch (cause) {
        quoteError = errorMessage(cause, t("checkout.errors.quoteLoad"));
      }
      const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
      // A checkout visit can pick an address and come back through onShow; keep
      // that selection instead of resetting to the default on every refresh.
      const current = addresses.find((address) => address.id === this.data.selectedAddressId);
      const selected = current || defaultAddress;
      this.setData({
        addresses,
        goods,
        coupons: coupons.map((coupon) => ({
          ...coupon,
          thresholdText:
            coupon.minSpendCny != null && coupon.minSpendCny > 0
              ? t("checkout.coupon.threshold", { amount: coupon.minSpendCny })
              : "",
        })),
        quote,
        quoteError,
        payableText: quote && quote.payableAmountCny != null ? formatCny(quote.payableAmountCny) : "--",
        originalAmountText:
          quote && quote.originalAmountCny != null ? formatCny(quote.originalAmountCny) : "",
        discountAmountText:
          quote && quote.discountAmountCny != null && quote.discountAmountCny > 0
            ? formatCny(quote.discountAmountCny)
            : "",
        selectedAddressId: selected ? selected.id : "",
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("checkout.errors.load")),
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
      this.setData({ giftCardError: t("checkout.giftCard.required") });
      return;
    }
    if (code.length < 8) {
      this.setData({ giftCardError: t("checkout.giftCard.invalid") });
      return;
    }
    this.setData({
      giftCardApplied: code,
      giftCardAppliedText: t("checkout.giftCard.applied", { code }),
      giftCardCode: "",
      giftCardError: "",
    });
  },

  removeGiftCard() {
    this.setData({
      giftCardApplied: "",
      giftCardAppliedText: "",
      giftCardCode: "",
      giftCardError: "",
    });
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
    // The address page emits the picked row over the opener EventChannel
    // (`pages/address/index.ts`), so checkout receives the choice instead of
    // silently keeping the default address.
    platform.navigateTo(mpCapabilityUrl("buyer.mall.addresses", { picker: "1" }), {
      events: {
        addressPicked: (payload: unknown) => {
          const picked = payload as { id?: unknown } | null;
          const addressId = picked && picked.id != null ? String(picked.id) : "";
          if (addressId) {
            this.setData({ selectedAddressId: addressId });
          }
        },
      },
    });
  },

  async submit() {
    // One order per tap: the button is disabled while busy, and the handler
    // guards as well so a fast double tap cannot create two orders.
    if (this.data.busy) {
      return;
    }
    if (!this.data.selectedAddressId) {
      this.showToast(t("checkout.errors.addressRequired"));
      return;
    }
    if (!this.data.quote) {
      this.showToast(this.data.quoteError || t("checkout.errors.quoteNotReady"));
      return;
    }
    // A selected line can disappear between bootstrap and submit (another device
    // or another session); ordering an empty basket must not be possible.
    if (this.data._cartItemIds.length > 0 && this.data.goods.length === 0) {
      this.showToast(t("checkout.errors.goodsUnavailable"));
      return;
    }
    if (this.data.needInvoice) {
      if (!this.data.invoiceTitle.trim()) {
        this.showToast(
          this.data.invoiceTitleType === "company"
            ? t("checkout.invoice.titleRequiredCompany")
            : t("checkout.invoice.titleRequiredPersonal"),
        );
        return;
      }
      if (this.data.invoiceTitleType === "company") {
        if (!this.data.invoiceTaxNumber.trim()) {
          this.showToast(t("checkout.invoice.taxRequired"));
          return;
        }
        if (!/^[A-Z0-9]{15,20}$/.test(this.data.invoiceTaxNumber.trim())) {
          this.showToast(t("checkout.invoice.taxInvalid"));
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
        idempotencyKey: this.data._submitKey,
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
      }, this.data.quote);
      // The cart lines are consumed by the order: clear the tab badge before the
      // cashier takes over (H5 parity: the shell reads the same total quantity).
      void syncCartTabBadge();
      if (!result.orderId) {
        // The create resolved (ack-shaped response) but carried no id: the order
        // exists, so never re-enable submit and risk a second one.
        this.showToast(t("checkout.errors.orderSubmitted"));
        platform.redirectTo(mpCapabilityUrl("buyer.mall.orders"));
        return;
      }
      const next = () =>
        platform.redirectTo(mpCapabilityUrl("storefront.mall.payment-cashier", { orderId: result.orderId }));
      if (result.warnings.length > 0) {
        // The order exists and will be paid: tell the buyer which deduction did
        // not apply before sending them to the cashier.
        await platform.alert({
          title: t("checkout.errors.warningsTitle"),
          content: result.warnings.join("\n"),
        });
      }
      next();
    } catch (cause) {
      this.showToast(errorMessage(cause, t("checkout.errors.submitFailed")));
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
