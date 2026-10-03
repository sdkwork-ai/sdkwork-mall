import { errorMessage, type MpTapEvent } from "../../types/common";
import { retrieveShop, type MpShopDetail } from "../../services/marketing-service";
import { formatCny } from "../../utils/format";

interface ShopProductRow {
  id: string;
  title: string;
  imageUrl: string;
  priceText: string;
  salesText: string;
}

interface ShopView {
  id: string;
  name: string;
  logoUrl: string;
  ratingText: string;
  products: ShopProductRow[];
}

interface ShopData {
  loading: boolean;
  shop: ShopView | null;
  _shopId: string;
}

function toView(shop: MpShopDetail): ShopView {
  return {
    id: shop.id,
    name: shop.name,
    logoUrl: shop.logoUrl,
    ratingText: shop.rating != null ? shop.rating.toFixed(1) : "",
    products: shop.products
      .filter((product) => product.id)
      .map((product) => ({
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        priceText: formatCny(product.priceCny),
        salesText: product.sales != null ? String(product.sales) : "",
      })),
  };
}

Page({
  data: {
    loading: true,
    shop: null,
    _shopId: "",
  } as ShopData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _shopId: options.id || "" });
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const shop = await retrieveShop(this.data._shopId);
      this.setData({ shop: shop ? toView(shop) : null, loading: false });
    } catch (cause) {
      this.setData({ shop: null, loading: false });
      wx.showToast({ title: errorMessage(cause, "店铺加载失败"), icon: "none" });
    }
  },

  goProduct(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: `/pages/product/index?id=${id}` });
    }
  },
});
