import { errorMessage, type MpSwiperChangeEvent, type MpTapEvent } from "../../types/common";
import { t } from "../../i18n";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { listAddresses } from "../../services/address-service";
import {
  type MpProductDetail,
  type MpSku,
  getProductDetail,
  listProducts,
} from "../../services/catalog-service";
import { addToCart } from "../../services/cart-service";
import { isFavorite, recordFootprint, toggleFavorite } from "../../services/favorites-service";
import { claimCoupon, type MpOffer, listOffers } from "../../services/promotion-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

type ProductSku = MpSku & { priceText: string };

interface ProductOffer {
  claimable: boolean;
  discountText: string;
  id: string;
  title: string;
}

interface RecommendationCard {
  id: string;
  imageUrl: string;
  priceText: string;
  title: string;
}

interface ProductData {
  detail: MpProductDetail | null;
  images: string[];
  activeImage: number;
  skus: ProductSku[];
  specs: Array<{ name: string; value: string }>;
  selectedSkuId: string;
  selectedSkuTitle: string;
  quantity: number;
  maxQuantity: number | null;
  stockUrgent: boolean;
  soldOut: boolean;
  displayPrice: string;
  favorite: boolean;
  offers: ProductOffer[];
  claimingOfferId: string;
  recommendations: RecommendationCard[];
  loading: boolean;
  busy: boolean;
  error: string;
  notFound: boolean;
  skuPopupOpen: boolean;
  skuPopupMode: string;
  toast: string;
  priceFallback: string;
  favoriteText: string;
  favoritedText: string;
  soldOutText: string;
  buyNowText: string;
  addToCartText: string;
  defaultSkuText: string;
  retryText: string;
  deliveryText: string;
  deliveryLabel: string;
  _productId: string;
  _toastTimer: number | null;
}

/** Mirrors the H5 floor: below this the PDP shows an urgency hint. */
const STOCK_URGENT_THRESHOLD = 20;

function toOfferRows(offers: MpOffer[]): ProductOffer[] {
  return offers.map((offer) => ({
    claimable: offer.claimable,
    discountText: offer.discountText,
    id: offer.id,
    title: offer.title,
  }));
}

Page({
  data: {
    detail: null,
    images: [],
    activeImage: 0,
    skus: [],
    specs: [],
    selectedSkuId: "",
    selectedSkuTitle: "",
    quantity: 1,
    maxQuantity: null,
    stockUrgent: false,
    soldOut: false,
    displayPrice: "",
    favorite: false,
    offers: [],
    claimingOfferId: "",
    recommendations: [],
    loading: true,
    busy: false,
    error: "",
    notFound: false,
    skuPopupOpen: false,
    skuPopupMode: "cart",
    toast: "",
    priceFallback: t("productDetail.priceFallback"),
    favoriteText: t("productDetail.favorite"),
    favoritedText: t("productDetail.favorited"),
    soldOutText: t("productDetail.soldOut"),
    buyNowText: t("productDetail.buyNow"),
    addToCartText: t("productDetail.addToCart"),
    defaultSkuText: t("productDetail.defaultSku"),
    retryText: t("productDetail.retry"),
    deliveryText: t("productDetail.deliveryAdd"),
    deliveryLabel: t("productDetail.deliveryLabel"),
    _productId: "",
    _toastTimer: null,
  } as ProductData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _productId: options.id || "" });
    void this.loadDetail();
  },

  /** 好友/群聊分享：携带商品标题、主图与还原路径。 */
  onShareAppMessage() {
    const detail = this.data.detail;
    return buildMpShareCard({
      imageUrl: this.data.images[0],
      query: { id: this.data._productId },
      routeId: "storefront.mall.product-detail",
      title: detail ? detail.title : undefined,
    });
  },

  /** 朋友圈分享：静态落地页形态（不携带个性化参数）。 */
  onShareTimeline() {
    const detail = this.data.detail;
    return buildMpTimelineCard({
      imageUrl: this.data.images[0],
      query: { id: this.data._productId },
      routeId: "storefront.mall.product-detail",
      title: detail ? `${detail.title} - SDKWork 商城` : undefined,
    });
  },

  async loadDetail() {
    this.setData({ loading: true, error: "", notFound: false });
    try {
      const detail = await getProductDetail(this.data._productId);
      if (!detail) {
        // A successful lookup that returns nothing is "off shelf", not a
        // failure: retrying cannot change it, so offer the way home instead.
        this.setData({ loading: false, notFound: true });
        return;
      }
      const skus = detail.skus.map((sku) => ({
        ...sku,
        priceText: formatCny(sku.priceCny),
      }));
      const selectedSku = skus[0] || null;
      const maxQuantity = selectedSku && selectedSku.stock != null && selectedSku.stock >= 0
        ? selectedSku.stock
        : skus.reduce((sum, sku) => sum + (sku.stock ?? 0), 0) || null;
      recordFootprint({
        id: detail.id,
        imageUrl: detail.imageUrl,
        title: detail.title,
      });
      this.setData({
        detail,
        images: detail.images.length ? detail.images : [detail.imageUrl].filter(Boolean),
        skus,
        specs: detail.specs,
        selectedSkuId: selectedSku ? selectedSku.id : "",
        selectedSkuTitle: selectedSku ? selectedSku.title : "",
        displayPrice: formatCny(selectedSku && selectedSku.priceCny != null ? selectedSku.priceCny : detail.priceCny),
        maxQuantity,
        stockUrgent: maxQuantity != null && maxQuantity > 0 && maxQuantity < STOCK_URGENT_THRESHOLD,
        soldOut: maxQuantity != null && maxQuantity <= 0,
        favorite: isFavorite(detail.id),
        loading: false,
      });
      void this.loadEnrichments(detail);
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "商品加载失败"),
      });
    }
  },

  /**
   * Coupons and "看了又看" are enrichments: the product is already usable when
   * they fail, so both degrade silently instead of turning the page into an
   * error (same rule as the H5 product detail).
   */
  async loadEnrichments(detail: MpProductDetail) {
    const [offersResult, recommendedResult, deliveryText] = await Promise.all([
      listOffers().catch(() => [] as MpOffer[]),
      listProducts({ page: 1, pageSize: 8, sort: "sales" }).catch(() => null),
      this.resolveDeliveryText(),
    ]);
    const recommendations = recommendedResult
      ? recommendedResult.items
          .filter((product) => product.id && product.id !== detail.id)
          .slice(0, 4)
          .map((product) => ({
            id: product.id,
            imageUrl: product.imageUrl,
            priceText: formatCny(product.priceCny),
            title: product.title,
          }))
      : [];
    this.setData({
      offers: toOfferRows(offersResult.filter((offer) => offer.claimable)),
      recommendations,
      deliveryText,
    });
  },

  /**
   * Delivery row, mirroring the H5 product detail.
   *
   * The default address is shown truncated; signed-out buyers see the "add
   * address" hint that leads to the address book. Fail-soft: a lookup failure
   * leaves the hint instead of failing the page.
   */
  async resolveDeliveryText(): Promise<string> {
    if (!isLoggedIn()) {
      return t("productDetail.deliveryAdd");
    }
    try {
      const addresses = await listAddresses();
      const address = addresses.find((entry) => entry.isDefault) ?? addresses[0];
      if (!address) {
        return t("productDetail.deliveryAdd");
      }
      const line = address.addressLine;
      return line.length > 24 ? `${line.slice(0, 24)}…` : line;
    } catch {
      return t("productDetail.deliveryAdd");
    }
  },

  goAddress() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.addresses"));
  },

  onImageChange(event: MpSwiperChangeEvent) {
    this.setData({ activeImage: event.detail.current });
  },

  /** Full-screen gallery: the platform viewer handles pinch, swipe and save. */
  previewImage(event: MpTapEvent) {
    const current = String(event.currentTarget.dataset.url ?? "");
    if (!current || this.data.images.length === 0) {
      return;
    }
    platform.previewImages({ current, urls: this.data.images });
  },

  toggleFavorite() {
    const detail = this.data.detail;
    if (!detail) {
      return;
    }
    const favorited = toggleFavorite({
      id: detail.id,
      imageUrl: detail.imageUrl,
      priceCny: detail.priceCny,
      title: detail.title,
    });
    this.setData({ favorite: favorited });
    this.showToast(favorited ? "已加入收藏" : "已取消收藏");
  },

  goShop(event: MpTapEvent) {
    const shopId = String(event.currentTarget.dataset.id ?? "");
    if (shopId) {
      platform.navigateTo(mpCapabilityUrl("storefront.mall.shop", { id: shopId }));
    }
  },

  goRecommendation(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) {
      return;
    }
    platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id }));
  },

  async claimOffer(event: MpTapEvent) {
    const offerId = String(event.currentTarget.dataset.id ?? "");
    if (!offerId || this.data.claimingOfferId) {
      return;
    }
    if (!isLoggedIn()) {
      platform.navigateTo(mpCapabilityUrl("account.mall.login"));
      return;
    }
    this.setData({ claimingOfferId: offerId });
    try {
      await claimCoupon(offerId);
      // The claimed offer leaves the row exactly like the H5 sheet does.
      this.setData({ offers: this.data.offers.filter((offer) => offer.id !== offerId) });
      this.showToast(t("productDetail.toasts.couponClaimed"));
    } catch (cause) {
      this.showToast(errorMessage(cause, t("productDetail.toasts.couponClaimFailed")));
    } finally {
      this.setData({ claimingOfferId: "" });
    }
  },

  selectSku(event: MpTapEvent) {
    const skuId = String(event.currentTarget.dataset.id ?? "");
    const sku = this.data.skus.find((entry) => entry.id === skuId);
    if (!sku) {
      return;
    }
    const maxQuantity = sku.stock != null && sku.stock >= 0 ? sku.stock : this.data.maxQuantity;
    this.setData({
      selectedSkuId: skuId,
      selectedSkuTitle: sku.title,
      maxQuantity,
      stockUrgent: maxQuantity != null && maxQuantity > 0 && maxQuantity < STOCK_URGENT_THRESHOLD,
      soldOut: maxQuantity != null && maxQuantity <= 0,
      displayPrice: formatCny(sku.priceCny ?? this.data.detail?.priceCny ?? null),
      quantity: 1,
    });
  },

  decreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  increaseQuantity() {
    const { quantity, maxQuantity } = this.data;
    if (maxQuantity != null && quantity >= maxQuantity) {
      this.showToast("已达当前规格库存上限");
      return;
    }
    this.setData({ quantity: quantity + 1 });
  },

  openSkuPopup(event: MpTapEvent) {
    if (this.data.busy || this.data.soldOut) {
      return;
    }
    this.setData({ skuPopupOpen: true, skuPopupMode: String(event.currentTarget.dataset.mode ?? "") || "cart" });
  },

  closeSkuPopup() {
    this.setData({ skuPopupOpen: false });
  },

  /** Stops the mask tap from closing the sheet when the sheet itself is tapped. */
  noop() {
    // Intentionally empty: `catchtap` consumes the bubble.
  },

  async confirmSkuPopup() {
    if (this.data.busy) {
      return;
    }
    const mode = this.data.skuPopupMode;
    await this.addToCart(mode === "buy");
    if (!this.data.busy) {
      this.setData({ skuPopupOpen: false });
    }
  },

  async addToCart(goCheckout: boolean) {
    if (!this.data.detail) {
      return;
    }
    const sku = this.data.skus.find((entry) => entry.id === this.data.selectedSkuId);
    if (!sku) {
      this.showToast("请选择规格");
      return;
    }
    if (!isLoggedIn()) {
      platform.navigateTo(mpCapabilityUrl("account.mall.login"));
      return;
    }
    if (this.data.maxQuantity != null && this.data.quantity > this.data.maxQuantity) {
      this.showToast(`库存不足，最多可购 ${this.data.maxQuantity} 件`);
      return;
    }
    this.setData({ busy: true });
    try {
      const record = await addToCart({
        spuId: this.data.detail.id,
        skuId: sku.id,
        quantity: this.data.quantity,
      });
      if (goCheckout) {
        // 立即购买 settles only the line just created. Without the line id the
        // buyer is sent to the cart to choose, never to a whole-cart checkout.
        const item = (record.item ?? record.cartItem ?? record) as Record<string, unknown>;
        const cartItemId = String(item.id ?? item.cartItemId ?? record.id ?? "");
        const target = cartItemId
          ? mpCapabilityUrl("storefront.mall.checkout", { items: cartItemId })
          : mpCapabilityUrl("storefront.mall.cart");
        platform.navigateTo(target, { fallbackUrl: mpCapabilityUrl("storefront.mall.cart") });
      } else {
        this.showToast("已加入购物车");
      }
    } catch (cause) {
      this.showToast(errorMessage(cause, "加入购物车失败"));
    } finally {
      this.setData({ busy: false });
    }
  },

  goCart() {
    platform.switchTab(mpCapabilityUrl("storefront.mall.cart"));
  },

  goChat() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.im.chats"));
  },

  retry() {
    void this.loadDetail();
  },

  goHome() {
    platform.switchTab(mpCapabilityUrl("storefront.mall.home"));
  },

  onPullDownRefresh() {
    void this.loadDetail().finally(() => platform.stopPullDownRefresh());
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
