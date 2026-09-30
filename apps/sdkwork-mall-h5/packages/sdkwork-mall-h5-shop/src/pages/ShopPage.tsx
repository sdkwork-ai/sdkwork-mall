import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Star, Store } from "lucide-react";

import {
  retrieveMallH5Shop,
  type MallH5ShopDetail,
} from "../shop-service";

export function SdkworkMallH5ShopPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const [shop, setShop] = useState<MallH5ShopDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(shopId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    retrieveMallH5Shop(shopId)
      .then((detail) => {
        if (active) {
          setShop(detail);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "店铺加载失败");
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
  }, [shopId]);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载店铺...</div>;
  }

  if (error || !shop) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-error" role="alert">{error ?? "店铺不存在或已关闭"}</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button sdk-h5-button-ghost" to="/">回到首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      <header className="sdk-h5-shop-hero">
        {shop.logoUrl ? (
          <img alt={shop.name} className="sdk-h5-shop-logo" src={shop.logoUrl} />
        ) : (
          <span className="sdk-h5-shop-logo-fallback">
            <Store aria-hidden="true" size={22} />
          </span>
        )}
        <div>
          <h1>{shop.name}</h1>
          {shop.rating != null ? (
            <p>
              <Star aria-hidden="true" size={13} /> {shop.rating.toFixed(1)}
            </p>
          ) : null}
        </div>
      </header>

      <section className="sdk-h5-section">
        <h2>店内商品</h2>
        {shop.products.length === 0 ? (
          <div className="sdk-h5-empty">店内暂无在售商品</div>
        ) : (
          <div className="sdk-h5-product-grid">
            {shop.products.map((product) => (
              <Link className="sdk-h5-product-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdk-h5-product-image">
                  {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : null}
                </div>
                <div className="sdk-h5-product-title">{product.title}</div>
                <div className="sdk-h5-product-meta">
                  {product.priceCny != null ? <strong>¥{product.priceCny.toFixed(2)}</strong> : <strong>询价</strong>}
                  {product.sales != null ? <span>已售 {product.sales}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
