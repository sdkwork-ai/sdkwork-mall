import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loadMallH5HomeSnapshot, type MallH5HomeSnapshot } from "../home-service";

/**
 * TV surface (10-foot UI) — the mall's living-room entry in the spirit of
 * JD's TV shopping app. Left category rail + right product grid, driven by
 * arrow keys (remote D-pad) with Enter opening the product page and
 * Escape/Backspace returning home. Consumes the same commerce facade as the
 * storefront surfaces; a dedicated apps/sdkwork-mall-tv client stays governed
 * by docs/architecture/decisions/0001-tv-client-deferred.md.
 */
export function SdkworkMallH5TvPage() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<MallH5HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState<"rail" | "grid">("rail");
  const [railIndex, setRailIndex] = useState(0);
  const [gridIndex, setGridIndex] = useState(0);
  const [gridPage, setGridPage] = useState(0);
  const railRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const gridRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    let active = true;
    loadMallH5HomeSnapshot()
      .then((data) => {
        if (active) {
          setSnapshot(data);
        }
      })
      .catch(() => {
        // TV surface degrades to an empty grid; the header stays usable.
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const products = useMemo(() => {
    const hot = snapshot?.hotProducts ?? [];
    const page = hot.slice(gridPage * 8, gridPage * 8 + 8);
    return page;
  }, [snapshot, gridPage]);

  const totalPages = Math.max(1, Math.ceil((snapshot?.hotProducts.length ?? 0) / 8));

  const syncFocus = useCallback(() => {
    if (zone === "rail") {
      railRefs.current[railIndex]?.focus();
    } else {
      gridRefs.current[gridIndex]?.focus();
    }
  }, [zone, railIndex, gridIndex]);

  useEffect(() => {
    syncFocus();
  }, [syncFocus]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const categories = snapshot?.categories ?? [];
      switch (event.key) {
        case "ArrowLeft": {
          event.preventDefault();
          if (zone === "grid") {
            if (gridIndex % 4 > 0) {
              setGridIndex(gridIndex - 1);
            } else {
              setZone("rail");
            }
          }
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (zone === "rail") {
            setZone("grid");
          } else if (gridIndex % 4 < 3 && gridIndex + 1 < products.length) {
            setGridIndex(gridIndex + 1);
          }
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          if (zone === "rail" && railIndex > 0) {
            setRailIndex(railIndex - 1);
          }
          if (zone === "grid" && gridIndex >= 4) {
            setGridIndex(gridIndex - 4);
          }
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          if (zone === "rail" && railIndex < categories.length - 1) {
            setRailIndex(railIndex + 1);
          }
          if (zone === "grid" && gridIndex + 4 < products.length) {
            setGridIndex(gridIndex + 4);
          } else if (zone === "grid" && gridPage + 1 < totalPages) {
            setGridPage(gridPage + 1);
            setGridIndex(gridIndex % 4);
          }
          break;
        }
        case "Escape":
        case "Backspace": {
          event.preventDefault();
          navigate("/");
          break;
        }
        default:
          break;
      }
    },
    [zone, railIndex, gridIndex, gridPage, products.length, snapshot, totalPages, navigate],
  );

  return (
    <div
      className="sdk-tv"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          syncFocus();
        }
      }}
      onKeyDown={handleKeyDown}
      role="application"
      tabIndex={-1}
    >
      <header className="sdk-tv-header">
        <span className="sdk-tv-brand">SDKWork 商城</span>
        <span className="sdk-tv-header-hint">方向键移动 · 回车打开 · 返回键回到首页</span>
      </header>

      <div className="sdk-tv-body">
        <nav aria-label="分类导航" className="sdk-tv-rail">
          <button
            className="sdk-tv-rail-item sdk-tv-rail-static"
            onClick={() => navigate("/categories")}
            ref={(node) => {
              railRefs.current[0] = node;
            }}
            tabIndex={zone === "rail" && railIndex === 0 ? 0 : -1}
            type="button"
          >
            全部分类
          </button>
          {(snapshot?.categories ?? []).map((category, index) => (
            <button
              className={
                zone === "rail" && railIndex === index + 1
                  ? "sdk-tv-rail-item sdk-tv-rail-focused"
                  : "sdk-tv-rail-item"
              }
              key={category.id}
              onClick={() => navigate(`/categories/${category.id}`)}
              onFocus={() => {
                setZone("rail");
                setRailIndex(index + 1);
              }}
              ref={(node) => {
                railRefs.current[index + 1] = node;
              }}
              tabIndex={zone === "rail" && railIndex === index + 1 ? 0 : -1}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </nav>

        <section aria-label="推荐商品" className="sdk-tv-grid-wrap">
          <h1 className="sdk-tv-title">热卖推荐</h1>
          {loading ? <div className="sdk-tv-empty">加载中...</div> : null}
          {!loading && products.length === 0 ? (
            <div className="sdk-tv-empty">暂无推荐商品</div>
          ) : null}
          <div className="sdk-tv-grid">
            {products.map((product, index) => (
              <Link
                className={
                  zone === "grid" && gridIndex === index
                    ? "sdk-tv-card sdk-tv-card-focused"
                    : "sdk-tv-card"
                }
                key={product.id}
                onFocus={() => {
                  setZone("grid");
                  setGridIndex(index);
                }}
                ref={(node) => {
                  gridRefs.current[index] = node;
                }}
                tabIndex={zone === "grid" && gridIndex === index ? 0 : -1}
                to={`/product/${product.id}`}
              >
                <div className="sdk-tv-card-image">
                  {product.imageUrl ? (
                    <img alt={product.title} loading="lazy" src={product.imageUrl} />
                  ) : null}
                </div>
                <div className="sdk-tv-card-title">{product.title}</div>
                <div className="sdk-tv-card-meta">
                  {product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}
                  {product.sales != null ? <span>已售 {product.sales}</span> : null}
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="sdk-tv-pager">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  className={
                    gridPage === index
                      ? "sdk-tv-pager-dot sdk-tv-pager-dot-active"
                      : "sdk-tv-pager-dot"
                  }
                  key={index}
                  onClick={() => setGridPage(index)}
                  tabIndex={-1}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
