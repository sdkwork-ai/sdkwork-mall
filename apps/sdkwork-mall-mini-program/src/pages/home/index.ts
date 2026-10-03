import { errorMessage, type MpTapEvent } from "../../types/common";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { type MpOffer, listOffers } from "../../services/promotion-service";
import { formatCny } from "../../utils/format";

interface HomeBanner {
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

interface HomeQuickEntry {
  id: string;
  label: string;
  link: string;
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
  { id: "b-quality", title: "品质生活，一站购齐", subtitle: "平台自营与品牌商家", link: "/pages/category/index" },
  { id: "b-new", title: "新品首发", subtitle: "每周上新", link: "/pages/search/index?q=new" },
  { id: "b-coupon", title: "领券中心", subtitle: "领券下单更划算", link: "/pages/coupons/index" },
  { id: "b-member", title: "会员专区", subtitle: "专属价与积分回馈", link: "/pages/buyer/index" },
];

const QUICK_ENTRIES: HomeQuickEntry[] = [
  { id: "category", label: "分类逛", link: "/pages/category/index" },
  { id: "new", label: "新品", link: "/pages/search/index?q=new" },
  { id: "hot", label: "热卖", link: "/pages/search/index?sort=sales" },
  { id: "coupon", label: "领券", link: "/pages/coupons/index" },
  { id: "orders", label: "订单", link: "/pages/orders/index" },
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
    const link = String(event.currentTarget.dataset.link ?? "");
    if (!link) {
      return;
    }
    if (link.indexOf("/pages/") === 0) {
      wx.navigateTo({
        url: link,
        fail() {
          // tab pages cannot be navigated to with navigateTo
          wx.switchTab({ url: link });
        },
      });
    }
  },

  goProduct(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/product/index?id=${String(event.currentTarget.dataset.id ?? "")}` });
  },

  goCategory(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/search/index?categoryId=${String(event.currentTarget.dataset.id ?? "")}` });
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
