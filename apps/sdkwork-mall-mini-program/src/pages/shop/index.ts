import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { listShopProducts, retrieveShop, type MpShopDetail, type MpShopProduct } from "../../services/marketing-service";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

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
  productsHasMore: boolean;
}

interface ShopData {
  loading: boolean;
  loadingMore: boolean;
  error: string;
  shop: ShopView | null;
  _shopId: string;
  _productPage: number;
}

function toProductRow(product: MpShopProduct): ShopProductRow {
  return {
    id: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    priceText: formatCny(product.priceCny),
    salesText: product.sales != null ? String(product.sales) : "",
  };
}

function toView(shop: MpShopDetail): ShopView {
  return {
    id: shop.id,
    name: shop.name,
    logoUrl: shop.logoUrl,
    ratingText: shop.rating != null ? shop.rating.toFixed(1) : "",
    products: shop.products.filter((product) => product.id).map(toProductRow),
    productsHasMore: shop.productsHasMore,
  };
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    shop: null,
    _shopId: "",
    _productPage: 0,
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
      this.setData({
        shop: shop ? toView(shop) : null,
        loading: false,
        _productPage: shop ? 1 : 0,
      });
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

  /** 上拉加载：店铺商品超过首屏时必须可继续浏览，而不是静默截断。 */
  async loadMore() {
    const shop = this.data.shop;
    if (!shop || !shop.productsHasMore || this.data.loadingMore) {
      return;
    }
    const nextPage = this.data._productPage + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await listShopProducts(this.data._shopId, nextPage);
      const current = this.data.shop;
      if (!current) {
        this.setData({ loadingMore: false });
        return;
      }
      const seen = new Set(current.products.map((product) => product.id));
      const appended = result.items
        .filter((product) => product.id && !seen.has(product.id))
        .map(toProductRow);
      this.setData({
        shop: {
          ...current,
          products: current.products.concat(appended),
          productsHasMore: result.hasMore,
        },
        _productPage: nextPage,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({ loadingMore: false });
      platform.toast(errorMessage(cause, "商品加载失败"), "none");
    }
  },

  onReachBottom() {
    void this.loadMore();
  },

  goProduct(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id }));
    }
  },

  retry() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
