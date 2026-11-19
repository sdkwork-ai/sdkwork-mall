import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { isMpTabCapability, mpCapabilityUrl } from "../../routes/capabilities";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { type MpFootprintItem, readFootprint } from "../../services/favorites-service";
import { type MpShopSummary, listShops } from "../../services/marketing-service";
import { type MpOffer, listOffers } from "../../services/promotion-service";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

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
  /** Poster gradient, mirroring the H5 hero tones. */
  tone: HomeBannerTone;
}

type HomeBannerTone = "brand" | "ember" | "teal" | "violet";

/** A tab return refreshes the shelves after this long, keeping them fresh without refetching on every visit. */
const HOME_REFRESH_INTERVAL_MS = 60_000;

interface HomeBanner {
  capability: string;
  id: string;
  query?: Record<string, string>;
  subtitle: string;
  title: string;
  tone: HomeBannerTone;
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

/** Featured-shop card; the rating line is catalogue copy, not template text. */
type HomeShop = MpShopSummary & { ratingText: string };

/** Footer shortcuts; the H5 home exposes the same service grid. */
interface HomeServiceEntry {
  capability: string;
  id: string;
  label: string;
}

const SERVICE_ENTRIES: Array<{ capability: string; id: string; labelKey: string }> = [
  { id: "help", labelKey: "home.services.help", capability: "storefront.mall.help" },
  { id: "orders", labelKey: "home.services.orders", capability: "buyer.mall.orders" },
  { id: "coupons", labelKey: "home.services.coupons", capability: "buyer.mall.coupons" },
  { id: "settings", labelKey: "home.services.settings", capability: "buyer.mall.settings" },
];

interface HomeData {
  banners: HomeBanner[];
  quickEntries: HomeQuickEntry[];
  categories: MpCategory[];
  hotProducts: HotProduct[];
  newProducts: HotProduct[];
  shops: HomeShop[];
  footprint: MpFootprintItem[];
  services: HomeServiceEntry[];
  seckillOffer: MpOffer | null;
  seckillCountdown: string;
  searchPlaceholder: string;
  ctaText: string;
  loadingText: string;
  categoriesTitle: string;
  seckillTitle: string;
  seckillOngoing: string;
  hotTitle: string;
  newTitle: string;
  shopsTitle: string;
  footprintTitle: string;
  retryText: string;
  shareTitle: string;
  loading: boolean;
  error: string;
  /** True when at least one shelf has something to show (empty state otherwise). */
  hasContent: boolean;
  /** Set when one primary shelf failed while the rest of the home rendered. */
  shelfNotice: string;
  emptyTitle: string;
  emptyHint: string;
  _seckillTimer: number | null;
  bannerIndex: number;
  /** Epoch millis of the last completed load, used to refresh a stale tab. */
  _loadedAt: number;
  _bannerTimer: number | null;
  _bannerTouchX: number | null;
  _bannerTouchY: number | null;
}

const BANNERS: HomeBannerSource[] = [
  // Same four slides in the same order and tones as the H5 hero carousel
  // (HomePage.tsx `HOME_BANNERS`); the destinations map to mini-program
  // capability routes instead of H5 paths.
  { id: "b-quality", titleKey: "home.banners.quality.title", subtitleKey: "home.banners.quality.subtitle", capability: "storefront.mall.categories", tone: "brand" },
  { id: "b-new", titleKey: "home.banners.newArrival.title", subtitleKey: "home.banners.newArrival.subtitle", capability: "storefront.mall.search", query: { q: "new" }, tone: "teal" },
  { id: "b-coupon", titleKey: "home.banners.coupon.title", subtitleKey: "home.banners.coupon.subtitle", capability: "buyer.mall.coupons", tone: "ember" },
  { id: "b-member", titleKey: "home.banners.member.title", subtitleKey: "home.banners.member.subtitle", capability: "buyer.mall.dashboard", tone: "violet" },
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
    tone: banner.tone,
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
    newProducts: [],
    shops: [],
    footprint: [],
    services: SERVICE_ENTRIES.map((entry) => ({
      capability: entry.capability,
      id: entry.id,
      label: t(entry.labelKey),
    })),
    seckillOffer: null,
    seckillCountdown: "",
    searchPlaceholder: t("home.searchPlaceholder"),
    ctaText: t("home.banners.cta"),
    loadingText: t("home.loading"),
    categoriesTitle: t("home.categories"),
    seckillTitle: t("home.seckill.title"),
    seckillOngoing: t("home.seckill.ongoing"),
    hotTitle: t("home.hot"),
    newTitle: t("home.newArrivals"),
    shopsTitle: t("home.sections.shops"),
    footprintTitle: t("home.sections.footprint"),
    retryText: t("home.retry"),
    shareTitle: t("home.shareTitle"),
    loading: true,
    error: "",
    hasContent: false,
    shelfNotice: "",
    emptyTitle: t("home.empty.title"),
    emptyHint: t("home.empty.hint"),
    _seckillTimer: null,
  bannerIndex: 0,
  _loadedAt: 0,
  _bannerTimer: null,
  _bannerTouchX: null,
  _bannerTouchY: null,
  } as HomeData,

  onLoad() {
    void this.loadHome();
  },

  onShow() {
    // The tab page keeps its timer across `onHide`, so resume the countdown
    // that `onHide` stopped instead of leaving the seckill clock frozen.
    if (this.data.seckillOffer && this.data._seckillTimer == null) {
      this.startSeckillCountdown();
    }
    // Browsing footprint is device-local and changes on every product visit;
    // re-read it on tab return instead of carrying a stale chip row.
    this.setData({ footprint: readFootprint().slice(0, 6) });
    this.startBannerAutoplay();
    // A tab page never re-runs `onLoad`; refresh a stale shelf in place so
    // prices/stock do not stay frozen from the first visit. The refresh is
    // silent: the current snapshot stays visible while it happens.
    if (!this.data.loading && Date.now() - this.data._loadedAt > HOME_REFRESH_INTERVAL_MS) {
      void this.loadHome({ silent: this.data.hasContent });
    }
  },

  onHide() {
    this.stopSeckillCountdown();
    this.stopBannerAutoplay();
  },

  onUnload() {
    this.stopSeckillCountdown();
    this.stopBannerAutoplay();
  },

  onShareAppMessage() {
    return buildMpShareCard({
      routeId: "storefront.mall.home",
      title: this.data.shareTitle,
    });
  },

  onShareTimeline() {
    return buildMpTimelineCard({
      routeId: "storefront.mall.home",
      title: this.data.shareTitle,
    });
  },

  /** Custom hero carousel: no native `swiper`, so no platform style can round it. */
  startBannerAutoplay() {
    this.stopBannerAutoplay();
    if (this.data.banners.length <= 1) {
      return;
    }
    this.data._bannerTimer = setInterval(() => {
      const count = this.data.banners.length;
      this.setData({ bannerIndex: (this.data.bannerIndex + 1) % count });
    }, 4200);
  },

  stopBannerAutoplay() {
    if (this.data._bannerTimer != null) {
      clearInterval(this.data._bannerTimer);
      this.data._bannerTimer = null;
    }
  },

  resetBannerAutoplay() {
    this.stopBannerAutoplay();
    this.startBannerAutoplay();
  },

  onBannerDotTap(event: MpTapEvent) {
    const index = Number(event.currentTarget.dataset.index ?? 0);
    if (Number.isFinite(index) && index >= 0 && index < this.data.banners.length) {
      this.setData({ bannerIndex: index });
      this.resetBannerAutoplay();
    }
  },

  onBannerTouchStart(event: { touches?: Array<{ clientX?: number; clientY?: number }> }) {
    const touch = event.touches?.[0];
    this.data._bannerTouchX = touch?.clientX ?? null;
    this.data._bannerTouchY = touch?.clientY ?? null;
    this.stopBannerAutoplay();
  },

  onBannerTouchEnd(event: { changedTouches?: Array<{ clientX?: number; clientY?: number }> }) {
    const startX = this.data._bannerTouchX;
    const startY = this.data._bannerTouchY;
    this.data._bannerTouchX = null;
    this.data._bannerTouchY = null;
    const touch = event.changedTouches?.[0];
    const endX = touch?.clientX ?? null;
    const endY = touch?.clientY ?? null;
    if (startX != null && endX != null) {
      const deltaX = endX - startX;
      const deltaY = startY != null && endY != null ? Math.abs(endY - startY) : 0;
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > deltaY) {
        const count = this.data.banners.length;
        const next = deltaX < 0 ? (this.data.bannerIndex + 1) % count : (this.data.bannerIndex - 1 + count) % count;
        this.setData({ bannerIndex: next });
      }
    }
    this.startBannerAutoplay();
  },


  goBanner(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const banner = this.data.banners.find((entry) => entry.id === id);
    if (banner) {
      this.openCapability(banner.capability, banner.query);
    }
  },

  goSeckill() {
    const offer = this.data.seckillOffer;
    if (offer && offer.id) {
      this.openCapability("storefront.mall.activity-detail", { id: offer.id });
    }
  },

  goSearch() {
    this.openCapability("storefront.mall.search");
  },

  goQuickEntry(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (!capability) {
      return;
    }
    // Match the entry by id: matching by capability returned the *banner* query,
    // which sent the search bar and the 热卖 entry to `?q=new`.
    const entryId = String(event.currentTarget.dataset.id ?? "");
    const entry = this.data.quickEntries.find((quick) => quick.id === entryId);
    this.openCapability(capability, entry?.query);
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

  goShop(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      this.openCapability("storefront.mall.shop", { id });
    }
  },

  goService(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (capability) {
      this.openCapability(capability);
    }
  },

  openCapability(capability: string, query?: Record<string, string>) {
    const url = mpCapabilityUrl(capability, query);
    if (isMpTabCapability(capability)) {
      platform.switchTab(url);
      return;
    }
    platform.navigateTo(url);
  },

  /**
   * Loads the storefront shelves.
   *
   * `silent` is the tab-return refresh: the visible snapshot stays on screen
   * while it happens, and a failed refresh keeps the last good shelves instead
   * of replacing a working page with an error banner.
   */
  async loadHome(options: { silent?: boolean } = {}) {
    const silent = options.silent === true;
    if (!silent) {
      this.setData({ loading: true, error: "" });
    }
    try {
      // Categories and the hot list are the storefront itself. Each is loaded
      // independently so one degraded dependency (a product read can be 503 while
      // categories are healthy) hides only its own shelf instead of replacing the
      // whole page with an error. Everything else (new arrivals, featured shops,
      // offers) is an enrichment floor and degrades to "section hidden".
      const [categoryOutcome, hotOutcome, newResult, shopsResult, offersResult] = await Promise.all([
        listCategories()
          .then((value) => ({ ok: true as const, value }))
          .catch((cause: unknown) => ({ ok: false as const, cause })),
        listProducts({ page: 1, pageSize: 10, sort: "sales" })
          .then((value) => ({ ok: true as const, value }))
          .catch((cause: unknown) => ({ ok: false as const, cause })),
        listProducts({ page: 1, pageSize: 10, sort: "newest" }).catch(() => null),
        listShops(4).catch(() => [] as MpShopSummary[]),
        listOffers().catch(() => [] as MpOffer[]),
      ]);
      // Both primary shelves down: that is a failed page, not a partial one.
      if (!categoryOutcome.ok && !hotOutcome.ok) {
        throw categoryOutcome.cause;
      }
      const categoryResult = categoryOutcome.ok ? categoryOutcome.value : [];
      const hotResult = hotOutcome.ok
        ? hotOutcome.value
        : { hasMore: false, items: [] as MpProductCard[], total: 0 };
      const partialShelfIssue = !categoryOutcome.ok || !hotOutcome.ok;
      const toHotProduct = (product: MpProductCard): HotProduct => ({
        ...product,
        priceText: formatCny(product.priceCny),
        salesLabel:
          product.sales != null
            ? t("home.sold", { count: product.sales })
            : "",
      });
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
      const categories = categoryResult.slice(0, 8);
      const hotProducts = hotResult.items.slice(0, 6).map(toHotProduct);
      const newProducts = newResult ? newResult.items.slice(0, 6).map(toHotProduct) : [];
      const footprint = readFootprint().slice(0, 6);
      const shops = shopsResult.map((shop) => ({
        ...shop,
        ratingText:
          shop.rating != null ? t("home.shopRating", { rating: shop.rating }) : "",
      }));
      this.setData({
        categories,
        hotProducts,
        newProducts,
        shops,
        footprint,
        seckillOffer: flashOffer,
        loading: false,
        error: "",
        shelfNotice: partialShelfIssue ? t("home.partialFailure") : "",
        // A storefront that resolved successfully but carries no rows must say
        // so instead of rendering an empty page under the hero.
        hasContent:
          categories.length > 0 ||
          hotProducts.length > 0 ||
          newProducts.length > 0 ||
          shops.length > 0 ||
          footprint.length > 0 ||
          flashOffer != null,
      });
      this.data._loadedAt = Date.now();
      this.startSeckillCountdown();
    } catch (cause) {
      if (silent && this.data.hasContent) {
        this.setData({ loading: false });
        return;
      }
      this.setData({
        loading: false,
        error: errorMessage(cause, t("home.error")),
      });
    }
  },

  stopSeckillCountdown() {
    if (this.data._seckillTimer != null) {
      clearInterval(this.data._seckillTimer);
      this.setData({ _seckillTimer: null });
    }
  },

  startSeckillCountdown() {
    this.stopSeckillCountdown();
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
      const next = `${pad(Math.floor(remaining / 3600))}:${pad(Math.floor((remaining % 3600) / 60))}:${pad(remaining % 60)}`;
      // Only repaint when the displayed second actually changed.
      if (next !== this.data.seckillCountdown) {
        this.setData({ seckillCountdown: next });
      }
    };
    tick();
    this.setData({ _seckillTimer: setInterval(tick, 1000) });
  },

  retry() {
    void this.loadHome();
  },

  onPullDownRefresh() {
    this.loadHome().then(() => platform.stopPullDownRefresh());
  },
});
