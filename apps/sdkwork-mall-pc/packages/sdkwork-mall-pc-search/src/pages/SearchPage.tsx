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

// Only the dimensions the catalog read model actually honours are offered:
// `price-asc` / `price-desc` are the two sort values the authority maps, and
// `newest` resolves to the default (publish time) order on the real authority
// and is recognised by the dev double. "销量" and "好评" used to be shown here
// but there is no sales/rating column in the catalog read model, so the
// authority silently ignored them and the list never changed.
const sortOptions = [
  { label: "综合", value: "" },
  { label: "价格 ↑", value: "price-asc" },
  { label: "价格 ↓", value: "price-desc" },
  { label: "上新", value: "newest" },
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
  return value == null ? "暂无报价" : (formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "暂无报价");
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

  // 品牌字段已由 catalog 投影并在标题下展示；品牌筛选参数 `brand_id` 虽已由
  // catalog app-api 接受，但 cloudrouter 生成的 catalog 客户端白名单尚未透出，
  // 前端补传会被丢弃。等 cloudrouter 契约再生效后再加筛选 UI，避免“只筛当前页
  // 却宣称全量筛选”。产地/价格/服务筛选同样继续隐藏。

  const [fallbackProducts, setFallbackProducts] = useState<MallSearchProduct[]>([]);

  useEffect(() => {
    if (!loading && items.length === 0) {
      searchMallProducts({ pageSize: 8 })
        .then((result) => setFallbackProducts(result.items))
        .catch(() => setFallbackProducts([]));
    }
  }, [loading, items.length]);

  const activeCategoryName = categories.find((category) => category.id === categoryId)?.name;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            共 <strong>{total}</strong> 件
          </span>
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

      {!loading && !loadError && items.length === 0 ? (
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
      {!loading && items.length > 0 ? (
        <div className="sdkwork-mall-pc-product-grid sdkwork-mall-pc-search-grid">
          {items.map((product) => (
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
      {!loading && items.length > 0 && totalPages > 1 ? (
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
