import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
import { t } from "../../i18n";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { type MpCategory, type MpProductCard, listCategories, listProducts } from "../../services/catalog-service";
import { formatCny } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

interface SearchSort {
  code: string;
  label: string;
}

type SearchProduct = MpProductCard & { priceText: string };

interface SearchData {
  keyword: string;
  sorts: SearchSort[];
  activeSort: string;
  hotKeywords: string[];
  history: string[];
  categories: MpCategory[];
  activeCategoryId: string;
  products: SearchProduct[];
  page: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
}

const SORTS: SearchSort[] = [
  { code: "", label: "综合" },
  { code: "sales", label: "销量" },
  { code: "price_asc", label: "价格↑" },
  { code: "price_desc", label: "价格↓" },
];

const HOT_KEYWORDS: string[] = ["手机", "笔记本", "大米", "人体工学椅", "新品", "旗舰"];
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
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: "",
  } as SearchData,

  onLoad(options: Record<string, string | undefined>) {
    const history = this.readHistory();
    this.setData({
      history,
      keyword: options.q || "",
      activeSort: options.sort || "",
      activeCategoryId: options.categoryId || "",
    });
    void this.loadCategories();
    void this.loadProducts(1);
  },

  readHistory(): string[] {
    try {
      const raw = platform.storage.get(HISTORY_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, 10) : [];
    } catch {
      return [];
    }
  },

  recordHistory(keyword: string) {
    if (!keyword) {
      return;
    }
    const history: string[] = [keyword]
      .concat(this.readHistory().filter((entry: string) => entry !== keyword))
      .slice(0, 10);
    try {
      platform.storage.set(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // storage unavailable
    }
    this.setData({ history });
  },

  clearHistory() {
    try {
      platform.storage.remove(HISTORY_KEY);
    } catch {
      // ignore
    }
    this.setData({ history: [] });
  },

  async loadCategories() {
    try {
      const categories = await listCategories();
      this.setData({
        categories: categories.filter((category) => !category.parentId).slice(0, 12),
      });
    } catch {
      // 分类栏为可选增强
    }
  },

  async loadProducts(nextPage: number) {
    const { keyword, activeSort, activeCategoryId } = this.data;
    // Resetting the cursor on page 1 keeps a scroll-triggered load-more from
    // fetching the previous query's next page while the new one is in flight.
    this.setData(
      nextPage === 1
        ? { loading: true, error: "", page: 0, total: 0, hasMore: true }
        : { loadingMore: true },
    );
    try {
      const result = await listProducts({
        categoryId: activeCategoryId || undefined,
        // A category chip narrows the keyword search; it must not discard the
        // keyword the buyer typed and still sees in the input.
        keyword: keyword || undefined,
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

  onKeywordInput(event: MpInputEvent) {
    this.setData({ keyword: event.detail.value });
  },

  onSearchConfirm() {
    const keyword = this.data.keyword.trim();
    this.recordHistory(keyword);
    this.setData({ activeCategoryId: "" });
    void this.loadProducts(1);
  },

  tapKeyword(event: MpTapEvent) {
    const keyword = String(event.currentTarget.dataset.keyword ?? "");
    this.setData({ keyword, activeCategoryId: "" });
    this.recordHistory(keyword);
    void this.loadProducts(1);
  },

  selectCategory(event: MpTapEvent) {
    const categoryId = String(event.currentTarget.dataset.id ?? "");
    this.setData({
      activeCategoryId: this.data.activeCategoryId === categoryId ? "" : categoryId,
    });
    void this.loadProducts(1);
  },

  selectSort(event: MpTapEvent) {
    this.setData({ activeSort: String(event.currentTarget.dataset.code ?? "") });
    void this.loadProducts(1);
  },

  goProduct(event: MpTapEvent) {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id: String(event.currentTarget.dataset.id ?? "") }));
  },

  onShareAppMessage() {
    const keyword = this.data.keyword.trim();
    return buildMpShareCard({
      query: {
        categoryId: this.data.activeCategoryId,
        q: this.data.activeCategoryId ? "" : keyword,
        sort: this.data.activeSort,
      },
      routeId: "storefront.mall.search",
      title: keyword ? t("share.titledWithMall", { title: keyword }) : undefined,
    });
  },

  loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return;
    }
    void this.loadProducts(this.data.page + 1);
  },

  retry() {
    void this.loadProducts(1);
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.loadProducts(1).finally(() => platform.stopPullDownRefresh());
  },
});
