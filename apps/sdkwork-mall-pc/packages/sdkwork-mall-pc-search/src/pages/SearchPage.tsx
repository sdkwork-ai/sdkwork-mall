import { formatMoney } from "@sdkwork/utils/money";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { History, Search, Sparkles, TrendingUp, X } from "lucide-react";import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Input,
  LoadingBlock,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  StatusNotice,
} from "@sdkwork/ui-pc-react";
import { sdkworkMallPcCategoryNav } from "@sdkwork/mall-pc-commons/category-nav";
import { listEnabledMallCmsHotKeywords, type MallCmsHotKeyword } from "@sdkwork/mall-pc-cms/cms-config";
import { loadMallCmsConfigRemote } from "@sdkwork/mall-pc-cms/cms-service";
import { listMallCategories, searchMallProducts, searchMallShops, type MallSearchProduct, type MallSearchShop } from "../search-service";

const sortOptions = [
  { label: "综合", value: "" },
  { label: "销量", value: "sales" },
  { label: "价格升序", value: "price-asc" },
  { label: "价格降序", value: "price-desc" },
  { label: "好评", value: "rating" },
  { label: "上新", value: "created_at" },
] as const;

const PAGE_SIZE = 20;
const SEARCH_HISTORY_KEY = "sdkwork-mall-pc-search-history";
const SEARCH_HISTORY_LIMIT = 10;

/** Local search history: a buyer expectation on every other root. */
function readSearchHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
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
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
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
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // 客户端筛选维度
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [filterFreeShipping, setFilterFreeShipping] = useState(false);
  const [filterSelfOperated, setFilterSelfOperated] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);

  // 搜索框联想
  const [searchInput, setSearchInput] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

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
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, sort, categoryId, shopId, page]);

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

  // 同步 URL query 到搜索框
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // 点击外部关闭联想下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = searchInput.trim();
    updateParam("q", trimmed);
    setShowSuggestions(false);
  }

  function handleSuggestionClick(keyword: string) {
    setSearchInput(keyword);
    updateParam("q", keyword);
    setShowSuggestions(false);
  }

  // 联想词：基于热词 + 输入前缀匹配
  const suggestions = useMemo(() => {
    const input = searchInput.trim().toLowerCase();
    if (!input) return [];
    const matched = hotKeywords
      .filter((kw) => kw.keyword.toLowerCase().includes(input) && kw.keyword.toLowerCase() !== input)
      .slice(0, 8)
      .map((kw) => kw.keyword);
    // 去重
    return Array.from(new Set(matched));
  }, [searchInput, hotKeywords]);

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
      <header className="sdkwork-mall-pc-search-header">
        <h1>
          {shopId
            ? "店内商品"
            : activeCategoryName
              ? `类目：${activeCategoryName}`
              : query
                ? `搜索「${query}」`
                : "商品搜索"}
        </h1>
        <p>
          共 {filteredItems.length} 件商品
          {filteredItems.length !== total ? `（筛选自 ${total} 件）` : ""}
        </p>

        {/* 搜索框 + 联想 */}
        <div className="sdkwork-mall-pc-search-box-wrapper" ref={searchBoxRef}>
          <form className="sdkwork-mall-pc-search-box" onSubmit={handleSearchSubmit}>
            <Search className="sdkwork-mall-pc-search-box-icon" />
            <Input
              aria-label="搜索商品"
              autoComplete="off"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="搜索商品品牌、类目、型号..."
              value={searchInput}
            />
            {searchInput ? (
              <button
                aria-label="清空"
                className="sdkwork-mall-pc-search-box-clear"
                onClick={() => {
                  setSearchInput("");
                  setShowSuggestions(false);
                }}
                type="button"
              >
                <X />
              </button>
            ) : null}
            <Button type="submit" variant="primary" size="default">
              搜索
            </Button>
          </form>

          {showSuggestions && suggestions.length > 0 ? (
            <ul className="sdkwork-mall-pc-search-suggestions" role="listbox">
              {suggestions.map((suggestion) => (
                <li key={suggestion} role="option">
                  <button
                    className="sdkwork-mall-pc-suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                    type="button"
                  >
                    <Search className="sdkwork-mall-pc-suggestion-icon" />
                    <span>{suggestion}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* 热搜词 */}
        {hotKeywords.length > 0 ? (
          <div className="sdkwork-mall-pc-chip-row">
            <Sparkles className="sdkwork-mall-pc-chip-row-icon" />
            {hotKeywords.slice(0, 10).map((keyword) => (
              <Link key={keyword.id} to={`/search?q=${encodeURIComponent(keyword.keyword)}`}>
                {keyword.keyword}
              </Link>
            ))}
          </div>
        ) : null}

        {/* 搜索历史 */}
        {history.length > 0 ? (
          <div className="sdkwork-mall-pc-chip-row">
            <History className="sdkwork-mall-pc-chip-row-icon" />
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

        {/* 类目筛选 */}
        {categories.length > 0 ? (
          <div className="sdkwork-mall-pc-chip-row">
            <button onClick={() => updateParam("categoryId", "")} type="button">
              全部类目
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => updateParam("categoryId", category.id)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="sdkwork-mall-pc-search-layout">
        {/* 左侧筛选区 */}
        <aside className="sdkwork-mall-pc-search-filters">
          <div className="sdkwork-mall-pc-filter-section">
            <h3>价格区间</h3>
            <div className="sdkwork-mall-pc-price-filter">
              <Input
                aria-label="最低价"
                min={0}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="最低"
                type="number"
                value={minPrice}
              />
              <span className="sdkwork-mall-pc-price-separator">-</span>
              <Input
                aria-label="最高价"
                min={0}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="最高"
                type="number"
                value={maxPrice}
              />
            </div>
          </div>

          <div className="sdkwork-mall-pc-filter-section">
            <h3>服务筛选</h3>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterFreeShipping}
                onCheckedChange={(checked) => setFilterFreeShipping(checked === true)}
              />
              <span>包邮</span>
            </label>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterSelfOperated}
                onCheckedChange={(checked) => setFilterSelfOperated(checked === true)}
              />
              <span>自营</span>
            </label>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterInStock}
                onCheckedChange={(checked) => setFilterInStock(checked === true)}
              />
              <span>仅看现货</span>
            </label>
          </div>

          {brandOptions.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3>品牌</h3>
              {brandOptions.map(({ brand, count }) => (
                <label key={brand} className="sdkwork-mall-pc-filter-checkbox">
                  <Checkbox
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                  />
                  <span>{brand}</span>
                  <span className="sdkwork-mall-pc-filter-count">{count}</span>
                </label>
              ))}
            </div>
          ) : null}

          {originOptions.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3>发货地</h3>
              {originOptions.map(({ origin, count }) => (
                <label key={origin} className="sdkwork-mall-pc-filter-checkbox">
                  <Checkbox
                    checked={selectedOrigins.includes(origin)}
                    onCheckedChange={() => toggleOrigin(origin)}
                  />
                  <span>{origin}</span>
                  <span className="sdkwork-mall-pc-filter-count">{count}</span>
                </label>
              ))}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} type="button">
              清空筛选
            </Button>
          ) : null}
        </aside>

        {/* 右侧主区 */}
        <div className="sdkwork-mall-pc-search-main">
          {/* 排序栏 */}
          <div className="sdkwork-mall-pc-sort-row">
            <TrendingUp className="sdkwork-mall-pc-sort-icon" />
            {sortOptions.map((option) => (
              <button
                key={option.value || "default"}
                className={sort === option.value ? "sdkwork-mall-pc-sort-active" : ""}
                onClick={() => updateParam("sort", option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 相关店铺 */}
          {!loading && shops.length > 0 ? (
            <section className="sdkwork-mall-pc-floor">
              <h2>相关店铺</h2>
              <div className="sdkwork-mall-pc-shop-grid">
                {shops.map((shop) => (
                  <Link className="sdkwork-mall-pc-shop-card" key={shop.id} to={`/shop/${shop.id}`}>
                    <strong>{shop.name}</strong>
                    {shop.description ? <p>{shop.description}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {loading ? <LoadingBlock label="搜索中..." /> : null}

          {!loading && filteredItems.length === 0 ? (
            <>
              <EmptyState description="试试其他关键词或浏览热卖商品" title="没有找到相关商品" />
              {fallbackProducts.length > 0 ? (
                <section className="sdkwork-mall-pc-floor">
                  <h2>热卖推荐</h2>
                  <div className="sdkwork-mall-pc-product-grid">
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
            <div className="sdkwork-mall-pc-product-grid">
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

          {/* SDK 阻塞提示 */}
          {!loading && items.length === 0 && !query ? (
            <StatusNotice tone="default">
              搜索联想、同义词、品牌价格高级筛选为 SDK 阻塞项，当前基于返回数据做客户端筛选。
            </StatusNotice>
          ) : null}
        </div>
      </div>
    </div>
  );
}
