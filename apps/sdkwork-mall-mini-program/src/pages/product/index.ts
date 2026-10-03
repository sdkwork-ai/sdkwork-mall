import { errorMessage, type MpSwiperChangeEvent, type MpTapEvent } from "../../types/common";
import { type MpProductDetail, type MpSku, getProductDetail } from "../../services/catalog-service";
import { addToCart } from "../../services/cart-service";
import { isFavorite, recordFootprint, toggleFavorite } from "../../services/favorites-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";

type ProductSku = MpSku & { priceText: string };

interface ProductData {
  detail: MpProductDetail | null;
  images: string[];
  activeImage: number;
  skus: ProductSku[];
  specs: Array<{ name: string; value: string }>;
  selectedSkuId: string;
  quantity: number;
  maxQuantity: number | null;
  soldOut: boolean;
  displayPrice: string;
  favorite: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  skuPopupOpen: boolean;
  skuPopupMode: string;
  toast: string;
  _productId: string;
  _toastTimer: number | null;
}

Page({
  data: {
    detail: null,
    images: [],
    activeImage: 0,
    skus: [],
    specs: [],
    selectedSkuId: "",
    quantity: 1,
    maxQuantity: null,
    soldOut: false,
    displayPrice: "",
    favorite: false,
    loading: true,
    busy: false,
    error: "",
    skuPopupOpen: false,
    skuPopupMode: "cart",
    toast: "",
    _productId: "",
    _toastTimer: null,
  } as ProductData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _productId: options.id || "" });
    void this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, error: "" });
    try {
      const detail = await getProductDetail(this.data._productId);
      if (!detail) {
        this.setData({ loading: false, error: "商品不存在或已下架" });
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
        displayPrice: formatCny(selectedSku && selectedSku.priceCny != null ? selectedSku.priceCny : detail.priceCny),
        maxQuantity,
        soldOut: maxQuantity != null && maxQuantity <= 0,
        favorite: isFavorite(detail.id),
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "商品加载失败"),
      });
    }
  },

  onImageChange(event: MpSwiperChangeEvent) {
    this.setData({ activeImage: event.detail.current });
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
      wx.navigateTo({ url: `/pages/shop/index?id=${shopId}` });
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
      maxQuantity,
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
    this.setData({ skuPopupOpen: true, skuPopupMode: String(event.currentTarget.dataset.mode ?? "") || "cart" });
  },

  closeSkuPopup() {
    this.setData({ skuPopupOpen: false });
  },

  async confirmSkuPopup() {
    const mode = this.data.skuPopupMode;
    this.setData({ skuPopupOpen: false });
    if (mode === "buy") {
      await this.addToCart(true);
    } else {
      await this.addToCart(false);
    }
  },

  async addToCart(goCart: boolean) {
    if (!this.data.detail) {
      return;
    }
    const sku = this.data.skus.find((entry) => entry.id === this.data.selectedSkuId);
    if (!sku) {
      this.showToast("请选择规格");
      return;
    }
    if (!isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    if (this.data.maxQuantity != null && this.data.quantity > this.data.maxQuantity) {
      this.showToast(`库存不足，最多可购 ${this.data.maxQuantity} 件`);
      return;
    }
    this.setData({ busy: true });
    try {
      await addToCart({
        spuId: this.data.detail.id,
        skuId: sku.id,
        quantity: this.data.quantity,
      });
      if (goCart) {
        wx.navigateTo({ url: "/pages/cart/index", fail() { wx.switchTab({ url: "/pages/cart/index" }); } });
      } else {
        this.showToast("已加入购物车");
      }
    } catch (cause) {
      this.showToast(errorMessage(cause, "加入购物车失败"));
    } finally {
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
