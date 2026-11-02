import { t } from "../../i18n";
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
interface HomeBannerSource {
  capability: string;
  id: string;
  query?: Record<string, string>;
  subtitleKey: string;
  titleKey: string;
}

interface HomeBanner {
  capability: string;
  id: string;
  query?: Record<string, string>;
  subtitle: string;
  title: string;
}

interface HomeQuickSource {
  capability: string;
  id: string;
  labelKey: string;
  query?: Record<string, string>;
}

interface HomeQuickEntry {
  capability: string;
  id: string;
  label: string;
  query?: Record<string, string>;
}

type HotProduct = MpProductCard & { priceText: string; salesLabel: string };

interface HomeData {
  banners: HomeBanner[];
  quickEntries: HomeQuickEntry[];
  categories: MpCategory[];
  hotProducts: HotProduct[];
  seckillOffer: MpOffer | null;
  seckillCountdown: string;
  searchPlaceholder: string;
  loadingText: string;
  categoriesTitle: string;
  seckillTitle: string;
  seckillOngoing: string;
  hotTitle: string;
  loading: boolean;
  error: string;
  _seckillTimer: number | null;
}

const BANNERS: HomeBannerSource[] = [
  { id: "b-quality", titleKey: "home.banners.quality.title", subtitleKey: "home.banners.quality.subtitle", capability: "storefront.mall.categories" },
  { id: "b-activity", titleKey: "home.banners.activity.title", subtitleKey: "home.banners.activity.subtitle", capability: "storefront.mall.activity-list" },
  { id: "b-new", titleKey: "home.banners.newArrival.title", subtitleKey: "home.banners.newArrival.subtitle", capability: "storefront.mall.search", query: { q: "new" } },
  { id: "b-coupon", titleKey: "home.banners.coupon.title", subtitleKey: "home.banners.coupon.subtitle", capability: "buyer.mall.coupons" },
  { id: "b-member", titleKey: "home.banners.member.title", subtitleKey: "home.banners.member.subtitle", capability: "buyer.mall.dashboard" },
];

const QUICK_ENTRIES: HomeQuickSource[] = [
  { id: "category", labelKey: "home.quick.categories", capability: "storefront.mall.categories" },
  { id: "activity", labelKey: "home.quick.activity", capability: "storefront.mall.activity-list" },
  { id: "new", labelKey: "home.quick.newArrival", capability: "storefront.mall.search", query: { q: "new" } },
  { id: "hot", labelKey: "home.quick.hot", capability: "storefront.mall.search", query: { sort: "sales" } },
  { id: "coupon", labelKey: "home.quick.coupon", capability: "buyer.mall.coupons" },
  { id: "orders", labelKey: "home.quick.orders", capability: "buyer.mall.orders" },
];

function resolveBanners(): HomeBanner[] {
  return BANNERS.map((banner) => ({
    capability: banner.capability,
    id: banner.id,
    query: banner.query,
    subtitle: t(banner.subtitleKey),
    title: t(banner.titleKey),
  }));
}

function resolveQuickEntries(): HomeQuickEntry[] {
  return QUICK_ENTRIES.map((entry) => ({
    capability: entry.capability,
    id: entry.id,
    label: t(entry.labelKey),
    query: entry.query,
  }));
}

Page({
  data: {
    banners: resolveBanners(),
    quickEntries: resolveQuickEntries(),
    categories: [],
    hotProducts: [],
    seckillOffer: null,
    seckillCountdown: "",
    searchPlaceholder: t("home.searchPlaceholder"),
    loadingText: t("home.loading"),
    categoriesTitle: t("home.categories"),
    seckillTitle: t("home.seckill.title"),
    seckillOngoing: t("home.seckill.ongoing"),
    hotTitle: t("home.hot"),
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
      const titleTokens = t("home.seckill.titleMatch")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      const flashOffer =
        offersResult.find((offer) =>
          titleTokens.some((token) => offer.title.indexOf(token) >= 0),
        ) ||
        offersResult[0] ||
        null;
      this.setData({
        categories: categoryResult.slice(0, 9),
        hotProducts: hotResult.items.slice(0, 6).map((product) => ({
          ...product,
          priceText: formatCny(product.priceCny),
          salesLabel:
            product.sales != null
              ? t("home.sold", { count: product.sales })
              : "",
        })),
        seckillOffer: flashOffer,
        loading: false,
      });
      this.startSeckillCountdown();
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("home.error")),
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
