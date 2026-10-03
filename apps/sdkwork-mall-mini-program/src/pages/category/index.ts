import { errorMessage, type MpTapEvent } from "../../types/common";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { formatCny } from "../../utils/format";

type CategoryProduct = MpProductCard & { priceText: string };

interface CategoryData {
  categories: MpCategory[];
  activeCategoryId: string;
  products: CategoryProduct[];
  page: number;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  _initialCategoryId: string;
}

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
    _initialCategoryId: "",
  } as CategoryData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _initialCategoryId: options.categoryId || "" });
    void this.loadCategories();
  },

  goProduct(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/product/index?id=${String(event.currentTarget.dataset.id ?? "")}` });
  },

  goSearch() {
    wx.navigateTo({ url: "/pages/search/index" });
  },

  async loadCategories() {
    try {
      const categories = await listCategories();
      const roots = categories.filter((category) => !category.parentId);
      const activeCategoryId = this.data._initialCategoryId || (roots[0] ? roots[0].id : "");
      this.setData({ categories: roots, activeCategoryId, loading: true });
      await this.loadProducts(1);
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "分类加载失败"),
      });
    }
  },

  async loadProducts(nextPage: number) {
    const { activeCategoryId } = this.data;
    try {
      const result = await listProducts({
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
        error: errorMessage(cause, "商品加载失败"),
      });
    }
  },

  async selectCategory(event: MpTapEvent) {
    const categoryId = String(event.currentTarget.dataset.id ?? "");
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
    void this.loadMore();
  },
});
