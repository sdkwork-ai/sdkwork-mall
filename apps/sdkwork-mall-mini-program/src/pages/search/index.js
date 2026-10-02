const catalog = require("../../services/catalog-service");
const { formatCny } = require("../../utils/format");

const SORTS = [
  { code: "", label: "综合" },
  { code: "sales", label: "销量" },
  { code: "price_asc", label: "价格↑" },
  { code: "price_desc", label: "价格↓" },
];

const HOT_KEYWORDS = ["手机", "笔记本", "大米", "人体工学椅", "新品", "旗舰"];
const HISTORY_KEY = "sdkwork-mall-mp-search-history";

Page({
  data: {
    keyword: "",
    sorts: SORTS,
    activeSort: "",
    hotKeywords: HOT_KEYWORDS,
    history: [],
    categories: [],
    activeCategoryId: "",
    products: [],
    page: 1,
    total: 0,
    loading: true,
    loadingMore: false,
    error: "",
  },

  onLoad(options) {
    const history = this.readHistory();
    this.setData({
      history,
      keyword: options.q || "",
      activeSort: options.sort || "",
      activeCategoryId: options.categoryId || "",
    });
    this.loadCategories();
    this.loadProducts(1);
  },

  readHistory() {
    try {
      const raw = wx.getStorageSync(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, 10) : [];
    } catch (cause) {
      return [];
    }
  },

  recordHistory(keyword) {
    if (!keyword) {
      return;
    }
    const history = [keyword].concat(this.readHistory().filter((entry) => entry !== keyword)).slice(0, 10);
    try {
      wx.setStorageSync(HISTORY_KEY, JSON.stringify(history));
    } catch (cause) {
      // storage unavailable
    }
    this.setData({ history });
  },

  clearHistory() {
    try {
      wx.removeStorageSync(HISTORY_KEY);
    } catch (cause) {
      // ignore
    }
    this.setData({ history: [] });
  },

  async loadCategories() {
    try {
      const categories = await catalog.listCategories();
      this.setData({
        categories: categories.filter((category) => !category.parentId).slice(0, 12),
      });
    } catch (cause) {
      // 分类栏为可选增强
    }
  },

  async loadProducts(nextPage) {
    const { keyword, activeSort, activeCategoryId } = this.data;
    this.setData(nextPage === 1 ? { loading: true, error: "" } : { loadingMore: true });
    try {
      const result = await catalog.listProducts({
        categoryId: activeCategoryId || undefined,
        keyword: activeCategoryId ? undefined : keyword || undefined,
        page: nextPage,
        pageSize: 20,
        sort: activeSort || undefined,
      });
      const products = result.items.map((product) => ({
        ...product,
        priceText: formatCny(product.priceCny),
      }));
      this.setData({
        products: nextPage === 1 ? products : this.data.products.concat(products),
        total: result.total,
        page: nextPage,
        loading: false,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        loadingMore: false,
        error: cause && cause.message ? cause.message : "商品加载失败",
      });
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  onSearchConfirm() {
    const keyword = this.data.keyword.trim();
    this.recordHistory(keyword);
    this.setData({ activeCategoryId: "" });
    this.loadProducts(1);
  },

  tapKeyword(event) {
    const keyword = event.currentTarget.dataset.keyword;
    this.setData({ keyword, activeCategoryId: "" });
    this.recordHistory(keyword);
    this.loadProducts(1);
  },

  selectCategory(event) {
    const categoryId = event.currentTarget.dataset.id;
    this.setData({
      activeCategoryId: this.data.activeCategoryId === categoryId ? "" : categoryId,
    });
    this.loadProducts(1);
  },

  selectSort(event) {
    this.setData({ activeSort: event.currentTarget.dataset.code });
    this.loadProducts(1);
  },

  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/index?id=${event.currentTarget.dataset.id}` });
  },

  loadMore() {
    if (this.data.loadingMore || this.data.products.length >= this.data.total) {
      return;
    }
    this.loadProducts(this.data.page + 1);
  },
});
