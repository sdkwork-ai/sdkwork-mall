const catalog = require("../../services/catalog-service");
const cartService = require("../../services/cart-service");
const session = require("../../services/session");
const { formatCny } = require("../../utils/format");

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
    loading: true,
    busy: false,
    error: "",
    skuPopupOpen: false,
    skuPopupMode: "cart",
    toast: "",
  },

  onLoad(options) {
    this.productId = options.id || "";
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, error: "" });
    try {
      const detail = await catalog.getProductDetail(this.productId);
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
      this.setData({
        detail,
        images: detail.images.length ? detail.images : [detail.imageUrl].filter(Boolean),
        skus,
        specs: detail.specs,
        selectedSkuId: selectedSku ? selectedSku.id : "",
        displayPrice: formatCny(selectedSku && selectedSku.priceCny != null ? selectedSku.priceCny : detail.priceCny),
        maxQuantity,
        soldOut: maxQuantity != null && maxQuantity <= 0,
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: cause && cause.message ? cause.message : "商品加载失败",
      });
    }
  },

  onImageChange(event) {
    this.setData({ activeImage: event.detail.current });
  },

  selectSku(event) {
    const skuId = event.currentTarget.dataset.id;
    const sku = this.data.skus.find((entry) => entry.id === skuId);
    if (!sku) {
      return;
    }
    const maxQuantity = sku.stock != null && sku.stock >= 0 ? sku.stock : this.data.maxQuantity;
    this.setData({
      selectedSkuId: skuId,
      maxQuantity,
      soldOut: maxQuantity != null && maxQuantity <= 0,
      displayPrice: formatCny(sku.priceCny != null ? sku.priceCny : this.data.detail.priceCny),
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

  openSkuPopup(event) {
    this.setData({ skuPopupOpen: true, skuPopupMode: event.currentTarget.dataset.mode || "cart" });
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

  async addToCart(goCart) {
    if (!this.data.detail) {
      return;
    }
    const sku = this.data.skus.find((entry) => entry.id === this.data.selectedSkuId);
    if (!sku) {
      this.showToast("请选择规格");
      return;
    }
    if (!session.isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    if (this.data.maxQuantity != null && this.data.quantity > this.data.maxQuantity) {
      this.showToast(`库存不足，最多可购 ${this.data.maxQuantity} 件`);
      return;
    }
    this.setData({ busy: true });
    try {
      await cartService.addToCart({
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
      this.showToast(cause && cause.message ? cause.message : "加入购物车失败");
    } finally {
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
