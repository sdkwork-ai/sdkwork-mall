import { errorMessage, type MpTapEvent } from "../../types/common";
import { t } from "../../i18n";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

type CategoryProduct = MpProductCard & { priceText: string };

interface CategoryData {
  /** First-level taxonomy rendered in the left rail. */
  roots: MpCategory[];
  /** Second-level taxonomy of the selected root. */
  children: MpCategory[];
  activeRootId: string;
  /** Leaf selection inside the active root; empty means "all of the root". */
  activeChildId: string;
  products: CategoryProduct[];
  page: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  allLabel: string;
  _initialCategoryId: string;
  _allCategories: MpCategory[];
}

Page({
  data: {
    roots: [],
    children: [],
    activeRootId: "",
    activeChildId: "",
    products: [],
    page: 1,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: "",
    allLabel: t("category.all"),
    _initialCategoryId: "",
    _allCategories: [],
  } as CategoryData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _initialCategoryId: options.categoryId || "" });
    void this.loadCategories();
  },

  goProduct(event: MpTapEvent) {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id: String(event.currentTarget.dataset.id ?? "") }));
  },

  onShareAppMessage() {
    const active = this.data.roots.find((category) => category.id === this.data.activeRootId);
    return buildMpShareCard({
      query: { categoryId: this.data.activeChildId || this.data.activeRootId },
      routeId: "storefront.mall.categories",
      title: active ? t("share.titledWithMall", { title: active.name }) : undefined,
    });
  },

  onShareTimeline() {
    const active = this.data.roots.find((category) => category.id === this.data.activeRootId);
    return buildMpTimelineCard({
      query: { categoryId: this.data.activeChildId || this.data.activeRootId },
      routeId: "storefront.mall.categories",
      title: active ? t("share.titledWithMall", { title: active.name }) : undefined,
    });
  },

  goSearch() {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.search"));
  },

  async loadCategories() {
    try {
      const categories = await listCategories();
      const roots = categories.filter((category) => !category.parentId);
      // A deep link may target a second-level category: resolve it to its root so
      // the rail, the child chips and the product list agree on one selection.
      const initial = this.data._initialCategoryId;
      const initialEntry = categories.find((category) => category.id === initial);
      const initialRoot = initialEntry
        ? (initialEntry.parentId ? initialEntry.parentId : initialEntry.id)
        : (roots[0] ? roots[0].id : "");
      const initialChild = initialEntry && initialEntry.parentId === initialRoot ? initial : "";
      this.setData({
        roots,
        activeRootId: initialRoot,
        activeChildId: initialChild,
        children: categories.filter((category) => category.parentId === initialRoot),
        _allCategories: categories,
        loading: true,
      });
      await this.loadProducts(1);
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "分类加载失败"),
      });
    }
  },

  async loadProducts(nextPage: number) {
    const { activeChildId, activeRootId } = this.data;
    // A page-1 request invalidates the previous page/total so an in-flight
    // load-more cannot append the old category's next page onto the new list.
    this.setData(
      nextPage === 1
        ? { loading: true, error: "", page: 0, total: 0, hasMore: true }
        : { loadingMore: true },
    );
    try {
      const result = await listProducts({
        categoryId: activeChildId || activeRootId || undefined,
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
        hasMore: result.hasMore,
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

  async selectRoot(event: MpTapEvent) {
    const rootId = String(event.currentTarget.dataset.id ?? "");
    if (rootId === this.data.activeRootId) {
      return;
    }
    const children = this.data._allCategories.filter((category) => category.parentId === rootId);
    this.setData({
      activeRootId: rootId,
      activeChildId: "",
      children,
      products: [],
      loading: true,
      error: "",
    });
    await this.loadProducts(1);
  },

  async selectChild(event: MpTapEvent) {
    const childId = String(event.currentTarget.dataset.id ?? "");
    if (childId === this.data.activeChildId) {
      return;
    }
    this.setData({ activeChildId: childId, products: [], loading: true, error: "" });
    await this.loadProducts(1);
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return;
    }
    await this.loadProducts(this.data.page + 1);
  },

  onPullDownRefresh() {
    this.loadProducts(1).then(() => platform.stopPullDownRefresh());
  },

  onReachBottom() {
    void this.loadMore();
  },

  retry() {
    this.setData({ error: "" });
    if (this.data.roots.length === 0) {
      void this.loadCategories();
      return;
    }
    this.setData({ loading: true });
    void this.loadProducts(1);
  },
});
