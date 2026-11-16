import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { retrieveShop, type MpShopDetail } from "../../services/marketing-service";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";

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
  error: string;
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
    error: "",
    shop: null,
    _shopId: "",
  } as ShopData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _shopId: options.id || "" });
    void this.load();
  },

  onShareAppMessage() {
    const shop = this.data.shop;
    return buildMpShareCard({
      imageUrl: shop?.logoUrl || undefined,
      query: { id: this.data._shopId },
      routeId: "storefront.mall.shop",
      title: shop?.name,
    });
  },

  onShareTimeline() {
    const shop = this.data.shop;
    return buildMpTimelineCard({
      imageUrl: shop?.logoUrl || undefined,
      query: { id: this.data._shopId },
      routeId: "storefront.mall.shop",
      title: shop?.name,
    });
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const shop = await retrieveShop(this.data._shopId);
      this.setData({ shop: shop ? toView(shop) : null, loading: false });
    } catch (cause) {
      // A failed read is not "this shop is closed": keep the distinction so the
      // buyer gets a retry instead of a dead end.
      this.setData({
        shop: null,
        loading: false,
        error: errorMessage(cause, "店铺加载失败"),
      });
    }
  },

  goProduct(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: mpCapabilityUrl("storefront.mall.product-detail", { id }) });
    }
  },

  retry() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },
});
