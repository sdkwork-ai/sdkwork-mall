import { errorMessage, type MpTapEvent } from "../../types/common";
import {
  isMpTabCapability,
  mpCapabilityUrl,
} from "../../routes/capabilities";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { type MpOffer, listOffers } from "../../services/promotion-service";
import { formatCny } from "../../utils/format";

/**
 * 首页入口按能力路由声明，路径由 routes/capabilities.ts 解析；
 * `query` 为可选的跳转参数，与 PC/H5 的查询参数同名。
 */
interface HomeBanner {
  capability: string;
  id: string;
  query?: Record<string, string>;
  subtitle: string;
  title: string;
}

interface HomeQuickEntry {
  capability: string;
  id: string;
  label: string;
  query?: Record<string, string>;
}

type HotProduct = MpProductCard & { priceText: string };

interface HomeData {
  banners: HomeBanner[];
  quickEntries: HomeQuickEntry[];
  categories: MpCategory[];
  hotProducts: HotProduct[];
  seckillOffer: MpOffer | null;
  seckillCountdown: string;
  loading: boolean;
  error: string;
  _seckillTimer: number | null;
}

const BANNERS: HomeBanner[] = [
  { id: "b-quality", title: "品质生活，一站购齐", subtitle: "平台自营与品牌商家", capability: "storefront.mall.categories" },
  { id: "b-activity", title: "活动会场", subtitle: "大促/秒杀/品牌日", capability: "storefront.mall.activity-list" },
  { id: "b-new", title: "新品首发", subtitle: "每周上新", capability: "storefront.mall.search", query: { q: "new" } },
  { id: "b-coupon", title: "领券中心", subtitle: "领券下单更划算", capability: "buyer.mall.coupons" },
  { id: "b-member", title: "会员专区", subtitle: "专属价与积分回馈", capability: "buyer.mall.dashboard" },
];

const QUICK_ENTRIES: HomeQuickEntry[] = [
  { id: "category", label: "分类逛", capability: "storefront.mall.categories" },
  { id: "activity", label: "活动", capability: "storefront.mall.activity-list" },
  { id: "new", label: "新品", capability: "storefront.mall.search", query: { q: "new" } },
  { id: "hot", label: "热卖", capability: "storefront.mall.search", query: { sort: "sales" } },
  { id: "coupon", label: "领券", capability: "buyer.mall.coupons" },
  { id: "orders", label: "订单", capability: "buyer.mall.orders" },
];

Page({
  data: {
    banners: BANNERS,
    quickEntries: QUICK_ENTRIES,
    categories: [],
    hotProducts: [],
    seckillOffer: null,
    seckillCountdown: "",
    loading: true,
    error: "",
    _seckillTimer: null,
  } as HomeData,

  onLoad() {
    void this.loadHome();
  },

  onUnload() {
    if (this.data._seckillTimer != null) {
      clearInterval(this.data._seckillTimer);
    }
  },

  goQuickEntry(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (!capability) {
      return;
    }
    this.openCapability(capability, this.queryFor(capability));
  },

  goProduct(event: MpTapEvent) {
    this.openCapability("storefront.mall.product-detail", {
      id: String(event.currentTarget.dataset.id ?? ""),
    });
  },

  goCategory(event: MpTapEvent) {
    this.openCapability("storefront.mall.search", {
      categoryId: String(event.currentTarget.dataset.id ?? ""),
    });
  },

  /** Banner / 快捷入口自带的查询参数（新品、热卖等入口携带）。 */
  queryFor(capability: string) {
    const banner = this.data.banners.find(
      (entry) => entry.capability === capability && entry.query,
    );
    if (banner?.query) {
      return banner.query;
    }
    const quick = this.data.quickEntries.find(
      (entry) => entry.capability === capability && entry.query,
    );
    return quick?.query;
  },

  openCapability(capability: string, query?: Record<string, string>) {
    const url = mpCapabilityUrl(capability, query);
    if (isMpTabCapability(capability)) {
      wx.switchTab({ url });
      return;
    }
    wx.navigateTo({ url });
  },

  async loadHome() {
    this.setData({ loading: true, error: "" });
    try {
      const [categoryResult, hotResult, offersResult] = await Promise.all([
        listCategories().catch(() => []),
        listProducts({ page: 1, pageSize: 10, sort: "sales" }).catch(() => ({ items: [], total: 0 })),
        listOffers().catch(() => []),
      ]);
      const flashOffer =
        offersResult.find((offer) => offer.title.indexOf("秒杀") >= 0 || offer.title.indexOf("闪购") >= 0) ||
        offersResult[0] ||
        null;
      this.setData({
        categories: categoryResult.slice(0, 9),
        hotProducts: hotResult.items.slice(0, 6).map((product) => ({
          ...product,
          priceText: formatCny(product.priceCny),
        })),
        seckillOffer: flashOffer,
        loading: false,
      });
      this.startSeckillCountdown();
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "首页加载失败"),
      });
    }
  },

  startSeckillCountdown() {
    if (this.data._seckillTimer != null) {
      clearInterval(this.data._seckillTimer);
      this.setData({ _seckillTimer: null });
    }
    const offer = this.data.seckillOffer;
    if (!offer || !offer.endAt) {
      return;
    }
    const tick = () => {
      const end = new Date(offer.endAt).getTime();
      if (Number.isNaN(end)) {
        this.setData({ seckillCountdown: "" });
        return;
      }
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const pad = (part: number) => String(part).padStart(2, "0");
      this.setData({
        seckillCountdown: `${pad(Math.floor(remaining / 3600))}:${pad(Math.floor((remaining % 3600) / 60))}:${pad(remaining % 60)}`,
      });
    };
    tick();
    this.setData({ _seckillTimer: setInterval(tick, 1000) });
  },

  onPullDownRefresh() {
    this.loadHome().then(() => wx.stopPullDownRefresh());
  },
});
