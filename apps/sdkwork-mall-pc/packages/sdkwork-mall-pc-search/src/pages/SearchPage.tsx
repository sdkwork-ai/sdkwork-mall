import { formatMoney } from "@sdkwork/utils/money";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, History, Sparkles } from "lucide-react";
import {
  readAccountScopedItem,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  LoadingBlock,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@sdkwork/ui-pc-react";
import { sdkworkMallPcCategoryNav } from "@sdkwork/mall-pc-commons/category-nav";
import { listEnabledMallCmsHotKeywords, type MallCmsHotKeyword } from "@sdkwork/mall-pc-cms/cms-config";
import { loadMallCmsConfigRemote } from "@sdkwork/mall-pc-cms/cms-service";
import { listMallCategories, searchMallProducts, searchMallShops, type MallSearchProduct, type MallSearchShop } from "../search-service";

const sortOptions = [
  { label: "综合", value: "" },
  { label: "销量", value: "sales" },
  { label: "价格 ↑", value: "price-asc" },
  { label: "价格 ↓", value: "price-desc" },
  { label: "好评", value: "rating" },
  { label: "上新", value: "created_at" },
] as const;

const PAGE_SIZE = 20;
const SEARCH_HISTORY_KEY = "sdkwork-mall-pc-search-history";
const SEARCH_HISTORY_LIMIT = 10;

/** Local search history: account-scoped, so another account starts empty. */
function readSearchHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = readAccountScopedItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, SEARCH_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(entries: string[]): void {
  try {
    writeAccountScopedItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Private mode or a full quota: history is a convenience, not a requirement.
  }
}

function formatCny(value: number | null): string {
  return value == null ? "询价" : (formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "询价");
}

function formatSalesCount(count?: number): string | null {
  if (count == null) return null;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

function formatRating(rating?: number): string | null {
  if (rating == null) return null;
  return rating.toFixed(1);
}

/**
 * 统一的筛选胶囊样式名：选中态由 `is-active` 承担，供类目、品牌、
 * 发货地、服务标签与排序共用同一套视觉语言。
 */
function searchChipClass(active: boolean, extraClassName?: string): string {
  const base = active
    ? "sdkwork-mall-pc-search-chip is-active"
    : "sdkwork-mall-pc-search-chip";
  return extraClassName ? `${base} ${extraClassName}` : base;
}

export function SdkworkMallSearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const sort = params.get("sort") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const shopId = params.get("shopId") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;

  const [items, setItems] = useState<MallSearchProduct[]>([]);
  const [shops, setShops] = useState<MallSearchShop[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // 客户端筛选维度
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [filterFreeShipping, setFilterFreeShipping] = useState(false);
  const [filterSelfOperated, setFilterSelfOperated] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);

  useEffect(() => {
    listMallCategories()
      .then(setCategories)
      .catch(() => {
        setCategories(sdkworkMallPcCategoryNav.map((name, index) => ({ id: String(index + 1), name })));
      });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    const productPromise = searchMallProducts({
      categoryId: categoryId || undefined,
      query: query || undefined,
      shopId: shopId || undefined,
      sort: sort || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    const shopPromise =
      query && !shopId && page === 1
        ? searchMallShops({ query, pageSize: 6 })
        : Promise.resolve({ items: [] as MallSearchShop[], total: 0 });

    Promise.all([productPromise, shopPromise])
      .then(([productResult, shopResult]) => {
        if (active) {
          setItems(productResult.items);
          setTotal(productResult.total);
          setShops(shopResult.items);
        }
      })
      .catch((cause: unknown) => {
        // A failed search must not render the "no results" empty state: that
        // tells the shopper the catalog has nothing matching when the request
        // never reached the backend at all.
        if (active) {
          setItems([]);
          setTotal(0);
          setShops([]);
          setLoadError(cause instanceof Error && cause.message ? cause.message : "搜索请求失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, sort, categoryId, shopId, page, reloadToken]);

  const [hotKeywords, setHotKeywords] = useState<MallCmsHotKeyword[]>(() => listEnabledMallCmsHotKeywords());
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());

  // Record every effective keyword once, newest first, de-duplicated and capped.
  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) {
      return;
    }
    setHistory((current) => {
      const next = [keyword, ...current.filter((entry) => entry !== keyword)].slice(0, SEARCH_HISTORY_LIMIT);
      writeSearchHistory(next);
      return next;
    });
  }, [query]);

  function clearSearchHistory() {
    writeSearchHistory([]);
    setHistory([]);
  }

  useEffect(() => {
    let active = true;
    loadMallCmsConfigRemote()
      .then((config) => {
        if (active) {
          setHotKeywords(listEnabledMallCmsHotKeywords(config));
        }
      })
      .catch(() => {
        // Keep local defaults when remote CMS is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // 切换筛选/排序时回到第1页
    if (key !== "page") {
      next.delete("page");
    }
    setParams(next);
  }

  // 从搜索结果中提取品牌和发货地选项
  const brandOptions = useMemo(() => {
    const brands = items
      .map((item) => item.brand)
      .filter((brand): brand is string => Boolean(brand));
    const counts = new Map<string, number>();
    for (const brand of brands) {
      counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([brand, count]) => ({ brand, count }));
  }, [items]);

  const originOptions = useMemo(() => {
    const origins = items
      .map((item) => item.origin)
      .filter((origin): origin is string => Boolean(origin));
    const counts = new Map<string, number>();
    for (const origin of origins) {
      counts.set(origin, (counts.get(origin) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([origin, count]) => ({ origin, count }));
  }, [items]);

  // 客户端筛选：品牌、发货地、包邮、自营、现货、价格区间
  const filteredItems = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    return items.filter((product) => {
      // 价格区间
      if (product.priceCny != null) {
        if (min != null && Number.isFinite(min) && product.priceCny < min) return false;
        if (max != null && Number.isFinite(max) && product.priceCny > max) return false;
      } else if (min != null || max != null) {
        return false;
      }
      // 品牌
      if (selectedBrands.length > 0) {
        if (!product.brand || !selectedBrands.includes(product.brand)) return false;
      }
      // 发货地
      if (selectedOrigins.length > 0) {
        if (!product.origin || !selectedOrigins.includes(product.origin)) return false;
      }
      // 包邮
      if (filterFreeShipping && !product.freeShipping) return false;
      // 自营
      if (filterSelfOperated && !product.selfOperated) return false;
      // 现货
      if (filterInStock && product.inStock === false) return false;
      return true;
    });
  }, [items, minPrice, maxPrice, selectedBrands, selectedOrigins, filterFreeShipping, filterSelfOperated, filterInStock]);

  const [fallbackProducts, setFallbackProducts] = useState<MallSearchProduct[]>([]);

  useEffect(() => {
    if (!loading && items.length === 0) {
      searchMallProducts({ pageSize: 8, sort: "sales" })
        .then((result) => setFallbackProducts(result.items))
        .catch(() => setFallbackProducts([]));
    }
  }, [loading, items.length]);

  const activeCategoryName = categories.find((category) => category.id === categoryId)?.name;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters =
    selectedBrands.length > 0 ||
    selectedOrigins.length > 0 ||
    filterFreeShipping ||
    filterSelfOperated ||
    filterInStock ||
    Boolean(minPrice.trim()) ||
    Boolean(maxPrice.trim());

  function clearAllFilters() {
    setSelectedBrands([]);
    setSelectedOrigins([]);
    setFilterFreeShipping(false);
    setFilterSelfOperated(false);
    setFilterInStock(false);
    setMinPrice("");
    setMaxPrice("");
  }

  function toggleBrand(brand: string) {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
  }

  function toggleOrigin(origin: string) {
    setSelectedOrigins((prev) =>
      prev.includes(origin) ? prev.filter((o) => o !== origin) : [...prev, origin],
    );
  }

  // 分页页码生成
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, page - half);
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="sdkwork-mall-pc-search-page">
      <nav aria-label="面包屑" className="sdkwork-mall-pc-search-crumb">
        <Link to="/">首页</Link>
        <ChevronRight aria-hidden="true" size={12} />
        <span>{query ? `搜索「${query}」` : "全部商品"}</span>
      </nav>

      <header className="sdkwork-mall-pc-search-head">
        <h1 className="sdkwork-mall-pc-search-title">
          {shopId ? "店内商品" : (activeCategoryName ?? query) || "全部商品"}
        </h1>
      </header>

      {/* 搜索历史 / 热搜：轻量文字行，避免与顶部导航的搜索框重复。 */}
      {hotKeywords.length > 0 || history.length > 0 ? (
        <div className="sdkwork-mall-pc-search-keywords">
          {hotKeywords.length > 0 && !query ? (
            <div className="sdkwork-mall-pc-search-keyword-row">
              <span className="sdkwork-mall-pc-search-keyword-label">
                <Sparkles aria-hidden="true" size={13} />
                热搜
              </span>
              {hotKeywords.slice(0, 10).map((keyword) => (
                <Link key={keyword.id} to={`/search?q=${encodeURIComponent(keyword.keyword)}`}>
                  {keyword.keyword}
                </Link>
              ))}
            </div>
          ) : null}
          {history.length > 0 ? (
            <div className="sdkwork-mall-pc-search-keyword-row">
              <span className="sdkwork-mall-pc-search-keyword-label">
                <History aria-hidden="true" size={13} />
                搜索历史
              </span>
              {history.map((keyword) => (
                <Link key={keyword} to={`/search?q=${encodeURIComponent(keyword)}`}>
                  {keyword}
                </Link>
              ))}
              <button onClick={clearSearchHistory} type="button">
                清空
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-label="筛选条件" className="sdkwork-mall-pc-search-facets">
        {categories.length > 0 ? (
          <div className="sdkwork-mall-pc-search-facet">
            <span className="sdkwork-mall-pc-search-facet-label">类目</span>
            <div className="sdkwork-mall-pc-search-facet-values">
              <button
                aria-pressed={!categoryId}
                className={searchChipClass(!categoryId)}
                onClick={() => updateParam("categoryId", "")}
                type="button"
              >
                全部
              </button>
              {categories.map((category) => (
                <button
                  aria-pressed={categoryId === category.id}
                  className={searchChipClass(categoryId === category.id)}
                  key={category.id}
                  onClick={() => updateParam("categoryId", category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {brandOptions.length > 0 ? (
          <div className="sdkwork-mall-pc-search-facet">
            <span className="sdkwork-mall-pc-search-facet-label">品牌</span>
            <div className="sdkwork-mall-pc-search-facet-values">
              {brandOptions.map(({ brand, count }) => (
                <button
                  aria-pressed={selectedBrands.includes(brand)}
                  className={searchChipClass(selectedBrands.includes(brand))}
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  type="button"
                >
                  {brand}
                  <span className="sdkwork-mall-pc-search-chip-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {originOptions.length > 0 ? (
          <div className="sdkwork-mall-pc-search-facet">
            <span className="sdkwork-mall-pc-search-facet-label">发货地</span>
            <div className="sdkwork-mall-pc-search-facet-values">
              {originOptions.map(({ origin, count }) => (
                <button
                  aria-pressed={selectedOrigins.includes(origin)}
                  className={searchChipClass(selectedOrigins.includes(origin))}
                  key={origin}
                  onClick={() => toggleOrigin(origin)}
                  type="button"
                >
                  {origin}
                  <span className="sdkwork-mall-pc-search-chip-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sdkwork-mall-pc-search-facet">
          <span className="sdkwork-mall-pc-search-facet-label">价格</span>
          <div className="sdkwork-mall-pc-search-facet-values">
            <div className="sdkwork-mall-pc-search-price-range">
              <Input
                aria-label="最低价"
                min={0}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="¥ 最低"
                type="number"
                value={minPrice}
              />
              <span className="sdkwork-mall-pc-search-price-separator">-</span>
              <Input
                aria-label="最高价"
                min={0}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="¥ 最高"
                type="number"
                value={maxPrice}
              />
            </div>
            <span aria-hidden="true" className="sdkwork-mall-pc-search-facet-divider" />
            <button
              aria-pressed={filterFreeShipping}
              className={searchChipClass(filterFreeShipping)}
              onClick={() => setFilterFreeShipping((current) => !current)}
              type="button"
            >
              包邮
            </button>
            <button
              aria-pressed={filterSelfOperated}
              className={searchChipClass(filterSelfOperated)}
              onClick={() => setFilterSelfOperated((current) => !current)}
              type="button"
            >
              自营
            </button>
            <button
              aria-pressed={filterInStock}
              className={searchChipClass(filterInStock)}
              onClick={() => setFilterInStock((current) => !current)}
              type="button"
            >
              仅看现货
            </button>
          </div>
        </div>

        {!loading && shops.length > 0 ? (
          <div className="sdkwork-mall-pc-search-facet">
            <span className="sdkwork-mall-pc-search-facet-label">相关店铺</span>
            <div className="sdkwork-mall-pc-search-facet-values">
              {shops.map((shop) => (
                <Link
                  className="sdkwork-mall-pc-search-chip sdkwork-mall-pc-search-shop-chip"
                  key={shop.id}
                  to={`/shop/${shop.id}`}
                >
                  {shop.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="sdkwork-mall-pc-search-toolbar">
        <div aria-label="排序方式" className="sdkwork-mall-pc-search-sort" role="group">
          {sortOptions.map((option) => (
            <button
              aria-pressed={sort === option.value}
              className={searchChipClass(sort === option.value, "sdkwork-mall-pc-search-sort-option")}
              key={option.value || "default"}
              onClick={() => updateParam("sort", option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="sdkwork-mall-pc-search-toolbar-meta">
          <span className="sdkwork-mall-pc-search-count">
            共 <strong>{filteredItems.length}</strong> 件
            {filteredItems.length !== total ? <span>（筛选自 {total} 件）</span> : null}
          </span>
          {hasActiveFilters ? (
            <button className="sdkwork-mall-pc-search-reset" onClick={clearAllFilters} type="button">
              清空筛选
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <LoadingBlock label="搜索中..." /> : null}

      {!loading && loadError ? (
        <EmptyState
          actions={(
            <>
              <Button onClick={() => setReloadToken((token) => token + 1)} type="button" variant="outline">
                重试
              </Button>
              <Link to="/">返回首页</Link>
            </>
          )}
          description={loadError}
          title="搜索请求失败"
        />
      ) : null}

      {!loading && !loadError && filteredItems.length === 0 ? (
        <>
          <EmptyState
            actions={<Link to="/">去首页逛逛</Link>}
            description={
              query || categoryId || shopId
                ? "换个关键词试试，或看看下面的热卖推荐"
                : "当前还没有可浏览的商品，请稍后再试"
            }
            title={query || categoryId || shopId ? "没有找到相关商品" : "暂无商品"}
          />
          {fallbackProducts.length > 0 ? (
            <section className="sdkwork-mall-pc-floor">
              <h2>热卖推荐</h2>
              <div className="sdkwork-mall-pc-product-grid sdkwork-mall-pc-search-grid">
                {fallbackProducts.map((product) => (
                  <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                    <div className="sdkwork-mall-pc-product-image">
                      {product.imageUrl ? <img alt={product.title} src={product.imageUrl} /> : null}
                    </div>
                    <div className="sdkwork-mall-pc-product-body">
                      <h3>{product.title}</h3>
                      <strong>{formatCny(product.priceCny)}</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* 商品列表 */}
      {!loading && filteredItems.length > 0 ? (
        <div className="sdkwork-mall-pc-product-grid sdkwork-mall-pc-search-grid">
          {filteredItems.map((product) => (
            <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
              <div className="sdkwork-mall-pc-product-image">
                {product.imageUrl ? <img alt={product.title} src={product.imageUrl} /> : null}
                {product.selfOperated ? (
                  <Badge variant="danger" className="sdkwork-mall-pc-product-badge-self">自营</Badge>
                ) : null}
              </div>
              <div className="sdkwork-mall-pc-product-body">
                <h3 className="sdkwork-mall-pc-product-title">{product.title}</h3>
                {product.brand ? (
                  <span className="sdkwork-mall-pc-product-brand">{product.brand}</span>
                ) : null}
                <div className="sdkwork-mall-pc-product-price-row">
                  <strong className="sdkwork-mall-pc-product-price">{formatCny(product.priceCny)}</strong>
                  {product.freeShipping ? (
                    <Badge variant="success">包邮</Badge>
                  ) : null}
                  {product.inStock === false ? (
                    <Badge variant="warning">缺货</Badge>
                  ) : null}
                </div>
                <div className="sdkwork-mall-pc-product-meta">
                  {product.shopName ? <span className="sdkwork-mall-pc-product-shop">{product.shopName}</span> : null}
                  {product.origin ? <span className="sdkwork-mall-pc-product-origin">{product.origin}</span> : null}
                </div>
                <div className="sdkwork-mall-pc-product-stats">
                  {product.rating != null ? (
                    <span className="sdkwork-mall-pc-product-rating">
                      评分 {formatRating(product.rating)}
                    </span>
                  ) : null}
                  {product.salesCount != null ? (
                    <span className="sdkwork-mall-pc-product-sales">
                      已售 {formatSalesCount(product.salesCount)}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {/* 分页 */}
      {!loading && filteredItems.length > 0 && totalPages > 1 ? (
        <Pagination className="sdkwork-mall-pc-search-pagination">
          <PaginationContent>
            {page > 1 ? (
              <PaginationItem>
                <PaginationPrevious onClick={() => updateParam("page", String(page - 1))} />
              </PaginationItem>
            ) : null}
            {pageNumbers.map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  isActive={pageNum === page}
                  onClick={() => updateParam("page", String(pageNum))}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}
            {page < totalPages ? (
              <PaginationItem>
                <PaginationNext onClick={() => updateParam("page", String(page + 1))} />
              </PaginationItem>
            ) : null}
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
