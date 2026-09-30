import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import { loadMallH5HomeSnapshot, type MallH5HomeSnapshot } from "../home-service";

const HOME_BANNERS = [
  { id: "banner-quality", linkUrl: "/categories", subtitle: "平台自营与品牌商家", title: "品质生活，一站购齐" },
  { id: "banner-new", linkUrl: "/search?q=new", subtitle: "每周上新", title: "新品首发" },
  { id: "banner-member", linkUrl: "/buyer", subtitle: "专属价与积分回馈", title: "会员专区" },
];

function ProductCard({ product }: { product: MallH5HomeSnapshot["hotProducts"][number] }) {
  return (
    <Link className="sdk-h5-product-card" to={`/product/${product.id}`}>
      <div className="sdk-h5-product-image">
        {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : <Search aria-hidden="true" size={22} />}
      </div>
      <div className="sdk-h5-product-title">{product.title}</div>
      <div className="sdk-h5-product-meta">
        {product.priceCny != null ? <strong>¥{product.priceCny.toFixed(2)}</strong> : <strong>询价</strong>}
        {product.sales != null ? <span>已售 {product.sales}</span> : null}
      </div>
    </Link>
  );
}

export function SdkworkMallH5HomePage() {
  const [snapshot, setSnapshot] = useState<MallH5HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMallH5HomeSnapshot()
      .then((data) => {
        if (active) {
          setSnapshot(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "首页加载失败");
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
  }, []);

  return (
    <div className="sdk-h5-page">
      <section aria-label="推荐" className="sdk-h5-banner">
        <h1>品质生活，一站购齐</h1>
        <p>平台自营与品牌商家，会员权益全覆盖</p>
      </section>

      <section aria-label="快捷入口" className="sdk-h5-quick-row">
        <Link className="sdk-h5-quick-item" to="/categories">分类逛</Link>
        <Link className="sdk-h5-quick-item" to="/search?q=new">新品</Link>
        <Link className="sdk-h5-quick-item" to="/search?sort=sales">热卖</Link>
        <Link className="sdk-h5-quick-item" to="/activity">活动</Link>
        <Link className="sdk-h5-quick-item" to="/buyer">会员</Link>
      </section>

      {loading ? <div className="sdk-h5-loading">加载中...</div> : null}
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {snapshot?.featuredShops.length ? (
        <section className="sdk-h5-section">
          <h2>热门店铺</h2>
          <div className="sdk-h5-chip-row">
            {snapshot.featuredShops.map((shop) => (
              <Link key={shop.id} to={`/shop/${shop.id}`}>{shop.name}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.categories.length ? (
        <section className="sdk-h5-section">
          <h2>热门类目</h2>
          <div className="sdk-h5-chip-row">
            {snapshot.categories.map((category) => (
              <Link key={category.id} to={`/categories/${category.id}`}>{category.name}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.hotProducts.length ? (
        <section className="sdk-h5-section">
          <h2>热卖推荐</h2>
          <div className="sdk-h5-product-grid">
            {snapshot.hotProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.newProducts.length ? (
        <section className="sdk-h5-section">
          <h2>新品上市</h2>
          <div className="sdk-h5-product-grid">
            {snapshot.newProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
