import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  buildMallH5CategoryTree,
  listMallH5Categories,
  searchMallH5Products,
  type MallH5CategoryTreeNode,
  type MallH5ProductCard,
} from "../catalog-service";

const SORT_OPTIONS = [
  { code: "", label: "综合" },
  { code: "sales", label: "销量" },
  { code: "price_asc", label: "价格↑" },
  { code: "price_desc", label: "价格↓" },
] as const;

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
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const keyword = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "";

  const [categoryTree, setCategoryTree] = useState<MallH5CategoryTreeNode[]>([]);
  const [items, setItems] = useState<MallH5ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    searchMallH5Products({
      categoryId,
      pageSize: 20,
      query: categoryId ? undefined : keyword || undefined,
      sort: sort || undefined,
    })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.total);
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
  }, [categoryId, keyword, sort]);

  const activeRoot = categoryId
    ? categoryTree.find((node) => node.id === categoryId)
      ?? categoryTree.find((node) => node.children.some((child) => child.id === categoryId))
    : undefined;
  const childCategories = activeRoot?.children ?? [];

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-sort-row">
        {SORT_OPTIONS.map((option) => (
          <button
            className={sort === option.code ? "sdk-h5-sort sdk-h5-sort-active" : "sdk-h5-sort"}
            key={option.code || "default"}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (option.code) {
                next.set("sort", option.code);
              } else {
                next.delete("sort");
              }
              setSearchParams(next);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="sdk-h5-section">
        <div className="sdk-h5-chip-row">
          <button
            className={!categoryId ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
            onClick={() => {
              const next = new URLSearchParams();
              if (keyword) {
                next.set("q", keyword);
              }
              setSearchParams(next);
            }}
            type="button"
          >
            全部分类
          </button>
          {categoryTree.map((node) => (
            <button
              className={node.id === categoryId || node.children.some((child) => child.id === categoryId) ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
              key={node.id}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("categoryId", node.id);
                setSearchParams(next);
              }}
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
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("categoryId", child.id);
                  setSearchParams(next);
                }}
                type="button"
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

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
      {total > items.length ? (
        <div className="sdk-h5-list-footer">共 {total} 件，仅展示前 {items.length} 件</div>
      ) : null}
    </div>
  );
}
