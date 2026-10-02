const catalog = require("../../services/catalog-service");
const promotions = require("../../services/promotion-service");
const { formatCny } = require("../../utils/format");

const BANNERS = [
  { id: "b-quality", title: "品质生活，一站购齐", subtitle: "平台自营与品牌商家", link: "/pages/category/index" },
  { id: "b-new", title: "新品首发", subtitle: "每周上新", link: "/pages/search/index?q=new" },
  { id: "b-coupon", title: "领券中心", subtitle: "领券下单更划算", link: "/pages/coupons/index" },
  { id: "b-member", title: "会员专区", subtitle: "专属价与积分回馈", link: "/pages/buyer/index" },
];

const QUICK_ENTRIES = [
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
  },

  onLoad() {
    this.loadHome();
  },

  onUnload() {
    if (this.seckillTimer) {
      clearInterval(this.seckillTimer);
    }
  },

  goQuickEntry(event) {
    const link = event.currentTarget.dataset.link;
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

  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/index?id=${event.currentTarget.dataset.id}` });
  },

  goCategory(event) {
    wx.navigateTo({ url: `/pages/search/index?categoryId=${event.currentTarget.dataset.id}` });
  },

  async loadHome() {
    this.setData({ loading: true, error: "" });
    try {
      const [categoryResult, hotResult, offersResult] = await Promise.all([
        catalog.listCategories().catch(() => []),
        catalog.listProducts({ page: 1, pageSize: 10, sort: "sales" }).catch(() => ({ items: [], total: 0 })),
        promotions.listOffers().catch(() => []),
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
        error: cause && cause.message ? cause.message : "首页加载失败",
      });
    }
  },

  startSeckillCountdown() {
    if (this.seckillTimer) {
      clearInterval(this.seckillTimer);
      this.seckillTimer = null;
    }
    if (!this.data.seckillOffer || !this.data.seckillOffer.endAt) {
      return;
    }
    const tick = () => {
      const end = new Date(this.data.seckillOffer.endAt).getTime();
      if (Number.isNaN(end)) {
        this.setData({ seckillCountdown: "" });
        return;
      }
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const pad = (part) => String(part).padStart(2, "0");
      this.setData({
        seckillCountdown: `${pad(Math.floor(remaining / 3600))}:${pad(Math.floor((remaining % 3600) / 60))}:${pad(remaining % 60)}`,
      });
    };
    tick();
    this.seckillTimer = setInterval(tick, 1000);
  },

  onPullDownRefresh() {
    this.loadHome().then(() => wx.stopPullDownRefresh());
  },
});
