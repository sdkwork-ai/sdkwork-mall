import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  buildMallH5CategoryTree,
  listMallH5Categories,
  searchMallH5Products,
  type MallH5CategoryTreeNode,
  type MallH5ProductCard,
} from "../catalog-service";
import {
  clearMallH5SearchHistory,
  readMallH5SearchHistory,
  recordMallH5SearchHistory,
} from "../search-history-service";

const SORT_OPTIONS = [
  { code: "", label: "综合" },
  { code: "sales", label: "销量" },
  { code: "price_asc", label: "价格↑" },
  { code: "price_desc", label: "价格↓" },
] as const;

const HOT_SEARCH_KEYWORDS = ["手机", "笔记本", "大米", "人体工学椅", "新品", "旗舰"] as const;

function ProductRow({ product }: { product: MallH5ProductCard }) {
  return (
    <Link className="sdk-h5-product-row" to={`/product/${product.id}`}>
      <div className="sdk-h5-product-image">
        {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : null}
      </div>
      <div className="sdk-h5-product-row-body">
        <div className="sdk-h5-product-title">{product.title}</div>
        <div className="sdk-h5-product-meta">
          {product.priceCny != null ? <strong>¥{product.priceCny.toFixed(2)}</strong> : <strong>询价</strong>}
          {product.sales != null ? <span>已售 {product.sales}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function SdkworkMallH5CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // 分类 id 既可能是路径参数（/categories/:categoryId 深链）也可能是查询参数（页内切换）。
  const routeParams = useParams<{ categoryId?: string }>();
  const categoryId = searchParams.get("categoryId") ?? routeParams.categoryId ?? undefined;
  const keyword = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "";
  // 搜索态（带关键词）保持纵向列表；分类态使用京东式左轨布局。
  const searchMode = Boolean(keyword) && !categoryId;

  const [categoryTree, setCategoryTree] = useState<MallH5CategoryTreeNode[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [items, setItems] = useState<MallH5ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readMallH5SearchHistory());

  const activeRoot = useMemo(() => {
    if (!categoryId) {
      return undefined;
    }
    return (
      categoryTree.find((node) => node.id === categoryId)
      ?? categoryTree.find((node) => node.children.some((child) => child.id === categoryId))
    );
  }, [categoryTree, categoryId]);
  const childCategories = activeRoot?.children ?? [];
  // 分类态默认落在第一个一级分类，保证左轨始终有激活项。
  const railActiveRoot = activeRoot ?? categoryTree[0];
  // 分类态商品查询跟随左轨：未选二级时展示当前一级分类（含子分类）的商品。
  const effectiveCategoryId = searchMode ? undefined : categoryId ?? railActiveRoot?.id;

  useEffect(() => {
    let active = true;
    listMallH5Categories()
      .then((categories) => {
        if (active) {
          setCategoryTree(buildMallH5CategoryTree(categories));
        }
      })
      .catch(() => {
        // 分类栏加载失败时不阻塞商品列表。
      })
      .finally(() => {
        if (active) {
          setCategoriesLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const categoriesReady = searchMode || categoriesLoaded;

  useEffect(() => {
    // 分类态等待分类树就绪，避免先全量请求再按根分类重复请求。
    if (!categoriesReady) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    if (!effectiveCategoryId && keyword) {
      recordMallH5SearchHistory(keyword);
      setSearchHistory(readMallH5SearchHistory());
    }
    searchMallH5Products({
      categoryId: effectiveCategoryId,
      page: 1,
      pageSize: 20,
      query: effectiveCategoryId ? undefined : keyword || undefined,
      sort: sort || undefined,
    })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.total);
          setPage(1);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "商品加载失败");
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
  }, [categoriesReady, effectiveCategoryId, keyword, sort]);

  async function loadMore() {
    if (loadingMore || items.length >= total) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await searchMallH5Products({
        categoryId: effectiveCategoryId,
        page: nextPage,
        pageSize: 20,
        query: effectiveCategoryId ? undefined : keyword || undefined,
        sort: sort || undefined,
      });
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setPage(nextPage);
    } catch {
      // 加载更多失败时保留当前列表，用户可重试。
    } finally {
      setLoadingMore(false);
    }
  }

  function setSort(nextSort: string) {
    const next = new URLSearchParams(searchParams);
    if (nextSort) {
      next.set("sort", nextSort);
    } else {
      next.delete("sort");
    }
    setSearchParams(next);
  }

  function searchKeyword(entry: string) {
    const next = new URLSearchParams();
    next.set("q", entry);
    setSearchParams(next);
  }

  function goCategory(nextCategoryId: string | undefined) {
    const next = new URLSearchParams();
    if (nextCategoryId) {
      next.set("categoryId", nextCategoryId);
    }
    if (sort) {
      next.set("sort", sort);
    }
    setSearchParams(next);
  }

  const productCount = items.length;
  const hasMoreProducts = productCount > 0 && productCount < total;

  const sortRow = (
    <div className="sdk-h5-sort-row">
      {SORT_OPTIONS.map((option) => (
        <button
          className={sort === option.code ? "sdk-h5-sort sdk-h5-sort-active" : "sdk-h5-sort"}
          key={option.code || "default"}
          onClick={() => setSort(option.code)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const productArea = (
    <>
      {loading ? <div className="sdk-h5-loading">加载中...</div> : null}
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="sdk-h5-empty">暂无匹配商品</div>
      ) : null}
      <div className="sdk-h5-product-list">
        {items.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </div>
      {hasMoreProducts ? (
        <div className="sdk-h5-center">
          <button
            className="sdk-h5-button sdk-h5-button-secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
          >
            {loadingMore ? "加载中..." : `加载更多（已展示 ${items.length}/${total}）`}
          </button>
        </div>
      ) : null}
    </>
  );

  if (searchMode) {
    return (
      <div className="sdk-h5-page">
        <section className="sdk-h5-section">
          <h2>热搜</h2>
          <div className="sdk-h5-chip-row">
            {HOT_SEARCH_KEYWORDS.map((entry) => (
              <button className="sdk-h5-chip" key={entry} onClick={() => searchKeyword(entry)} type="button">
                {entry}
              </button>
            ))}
          </div>
        </section>

        {searchHistory.length > 0 ? (
          <section className="sdk-h5-section">
            <div className="sdk-h5-flex-between">
              <h2>搜索历史</h2>
              <button
                className="sdk-h5-button sdk-h5-button-ghost"
                onClick={() => {
                  clearMallH5SearchHistory();
                  setSearchHistory([]);
                }}
                type="button"
              >
                清空
              </button>
            </div>
            <div className="sdk-h5-chip-row">
              {searchHistory.map((entry) => (
                <button className="sdk-h5-chip" key={entry} onClick={() => searchKeyword(entry)} type="button">
                  {entry}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {sortRow}

        <section className="sdk-h5-section">
          <div className="sdk-h5-chip-row">
            <button
              className={!categoryId ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
              onClick={() => goCategory(undefined)}
              type="button"
            >
              全部分类
            </button>
            {categoryTree.map((node) => (
              <button
                className={node.id === categoryId || node.children.some((child) => child.id === categoryId) ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
                key={node.id}
                onClick={() => goCategory(node.id)}
                type="button"
              >
                {node.name}
              </button>
            ))}
          </div>
          {childCategories.length > 0 ? (
            <div className="sdk-h5-chip-row sdk-h5-chip-row-sub">
              {childCategories.map((child) => (
                <button
                  className={child.id === categoryId ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
                  key={child.id}
                  onClick={() => goCategory(child.id)}
                  type="button"
                >
                  {child.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {productArea}
      </div>
    );
  }

  // 分类态：京东式左侧一级分类轨道 + 右侧内容（二级宫格 / 商品列表）。
  return (
    <div className="sdk-h5-catalog">
      <nav aria-label="分类导航" className="sdk-h5-catalog-rail">
        {categoryTree.map((node) => (
          <button
            className={railActiveRoot?.id === node.id ? "sdk-h5-catalog-rail-item sdk-h5-catalog-rail-item-active" : "sdk-h5-catalog-rail-item"}
            key={node.id}
            onClick={() => goCategory(node.id)}
            type="button"
          >
            {node.name}
          </button>
        ))}
        {categoryTree.length === 0 ? <div className="sdk-h5-catalog-rail-empty">分类加载中</div> : null}
      </nav>

      <div className="sdk-h5-catalog-content">
        {railActiveRoot ? (
          <h1 className="sdk-h5-catalog-title">
            {categoryId && activeRoot?.id !== categoryId
              ? childCategories.find((child) => child.id === categoryId)?.name ?? railActiveRoot.name
              : railActiveRoot.name}
          </h1>
        ) : null}

        {/* 未指定二级分类时展示该一级分类下的二级宫格 */}
        {!categoryId && railActiveRoot && railActiveRoot.children.length > 0 ? (
          <div className="sdk-h5-catalog-child-grid">
            {railActiveRoot.children.map((child) => (
              <button
                className="sdk-h5-catalog-child-card"
                key={child.id}
                onClick={() => goCategory(child.id)}
                type="button"
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* 选中二级分类时提供同级切换 */}
        {categoryId && activeRoot && childCategories.length > 0 ? (
          <div className="sdk-h5-chip-row sdk-h5-catalog-siblings">
            <button
              className={activeRoot.id === categoryId ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
              onClick={() => goCategory(activeRoot.id)}
              type="button"
            >
              全部{activeRoot.name}
            </button>
            {childCategories.map((child) => (
              <button
                className={child.id === categoryId ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
                key={child.id}
                onClick={() => goCategory(child.id)}
                type="button"
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}

        {sortRow}
        {productArea}
      </div>
    </div>
  );
}
