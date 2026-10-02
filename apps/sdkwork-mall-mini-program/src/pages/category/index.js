const catalog = require("../../services/catalog-service");
const { formatCny } = require("../../utils/format");

Page({
  data: {
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
    this.initialCategoryId = options.categoryId || "";
    this.loadCategories();
  },

  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/index?id=${event.currentTarget.dataset.id}` });
  },

  goSearch() {
    wx.navigateTo({ url: "/pages/search/index" });
  },

  async loadCategories() {
    try {
      const categories = await catalog.listCategories();
      const roots = categories.filter((category) => !category.parentId);
      const activeCategoryId = this.initialCategoryId || (roots[0] ? roots[0].id : "");
      this.setData({ categories: roots, activeCategoryId, loading: true });
      await this.loadProducts(1);
    } catch (cause) {
      this.setData({
        loading: false,
        error: cause && cause.message ? cause.message : "分类加载失败",
      });
    }
  },

  async loadProducts(nextPage) {
    const { activeCategoryId } = this.data;
    try {
      const result = await catalog.listProducts({
        categoryId: activeCategoryId || undefined,
        page: nextPage,
        pageSize: 20,
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

  async selectCategory(event) {
    const categoryId = event.currentTarget.dataset.id;
    if (categoryId === this.data.activeCategoryId) {
      return;
    }
    this.setData({ activeCategoryId: categoryId, products: [], loading: true, error: "" });
    await this.loadProducts(1);
  },

  async loadMore() {
    if (this.data.loadingMore || this.data.products.length >= this.data.total) {
      return;
    }
    this.setData({ loadingMore: true });
    await this.loadProducts(this.data.page + 1);
  },

  onPullDownRefresh() {
    this.loadProducts(1).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMore();
  },
});
