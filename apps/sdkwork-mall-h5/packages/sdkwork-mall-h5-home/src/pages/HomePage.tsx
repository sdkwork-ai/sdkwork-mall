import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Aperture,
  ArrowRight,
  Coffee,
  Cpu,
  Gem,
  Headphones,
  Home as HomeIcon,
  Search,
  Shirt,
  ShoppingBag,
  Ticket,
  Watch,
  type LucideIcon,
} from "lucide-react";

import { loadMallH5HomeSnapshot, type MallH5HomeOffer, type MallH5HomeSnapshot } from "../home-service";
import { readMallH5Footprint } from "@sdkwork/mall-h5-buyer/favorites-service";

const HOME_BANNERS = [
  { id: "banner-quality", linkUrl: "/categories", subtitle: "平台自营与品牌商家", title: "品质生活，一站购齐" },
  { id: "banner-new", linkUrl: "/search?q=new", subtitle: "每周上新", title: "新品首发" },
  { id: "banner-coupon", linkUrl: "/buyer/coupons", subtitle: "领券下单更划算", title: "领券中心" },
  { id: "banner-member", linkUrl: "/buyer/membership", subtitle: "专属价与积分回馈", title: "会员专区" },
];

const CATEGORY_ICONS: readonly LucideIcon[] = [Cpu, Headphones, HomeIcon, Shirt, Coffee, Watch, Gem, Aperture, ShoppingBag];

function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function BannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HOME_BANNERS.length);
    }, 4200);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section aria-label="推荐" className="sdk-h5-banner-carousel">
      <div className="sdk-h5-banner-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {HOME_BANNERS.map((banner) => (
          <Link className="sdk-h5-banner" key={banner.id} to={banner.linkUrl}>
            <h1>{banner.title}</h1>
            <p>{banner.subtitle}</p>
          </Link>
        ))}
      </div>
      <div className="sdk-h5-banner-dots" role="tablist" aria-label="轮播导航">
        {HOME_BANNERS.map((banner, index) => (
          <button
            aria-label={`第 ${index + 1} 张横幅`}
            aria-selected={index === activeIndex}
            className={index === activeIndex ? "sdk-h5-banner-dot sdk-h5-banner-dot-active" : "sdk-h5-banner-dot"}
            key={banner.id}
            onClick={() => setActiveIndex(index)}
            role="tab"
            type="button"
          />
        ))}
      </div>
    </section>
  );
}

function SeckillFloor({ offer, products }: { offer: MallH5HomeOffer | undefined; products: MallH5HomeSnapshot["hotProducts"] }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!offer?.endAt) {
      return 0;
    }
    return Math.max(0, Math.floor((new Date(offer.endAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!offer?.endAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.floor((new Date(offer.endAt ?? "").getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [offer?.endAt]);

  if (!offer) {
    return null;
  }

  return (
    <section className="sdk-h5-section sdk-h5-seckill">
      <header className="sdk-h5-seckill-header">
        <h2>限时秒杀</h2>
        <span className="sdk-h5-seckill-countdown" aria-label="距结束倒计时">
          {formatCountdown(remainingSeconds)}
        </span>
        <Link className="sdk-h5-seckill-more" to={`/activity/${offer.id}`}>
          {offer.discountText || "去抢购"} <ArrowRight aria-hidden="true" size={12} />
        </Link>
      </header>
      {offer.highlight ? <p className="sdk-h5-muted">{offer.highlight}</p> : null}
      <div className="sdk-h5-seckill-grid">
        {products.slice(0, 4).map((product) => (
          <Link className="sdk-h5-seckill-item" key={product.id} to={`/product/${product.id}`}>
            <div className="sdk-h5-product-image">
              {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : <Search aria-hidden="true" size={20} />}
            </div>
            <div className="sdk-h5-seckill-price">
              {product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

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
  const footprint = readMallH5Footprint().slice(0, 6);
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

  const flashOffer = useMemo(
    () => snapshot?.offers.find((offer) => offer.title.includes("秒杀") || offer.title.includes("闪购")) ?? snapshot?.offers[0],
    [snapshot],
  );

  return (
    <div className="sdk-h5-page">
      <BannerCarousel />

      <section aria-label="快捷入口" className="sdk-h5-quick-row">
        <Link className="sdk-h5-quick-item" to="/categories">分类逛</Link>
        <Link className="sdk-h5-quick-item" to="/search?q=new">新品</Link>
        <Link className="sdk-h5-quick-item" to="/search?sort=sales">热卖</Link>
        <Link className="sdk-h5-quick-item" to="/activity">活动</Link>
        <Link className="sdk-h5-quick-item" to="/buyer/coupons">领券</Link>
      </section>

      {loading ? <div className="sdk-h5-loading">加载中...</div> : null}
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {snapshot?.categories.length ? (
        <section aria-label="分类导航" className="sdk-h5-section">
          <div className="sdk-h5-category-grid">
            {snapshot.categories.slice(0, 9).map((category, index) => {
              const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
              return (
                <Link className="sdk-h5-category-item" key={category.id} to={`/categories/${category.id}`}>
                  <Icon aria-hidden="true" size={22} />
                  <span>{category.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <SeckillFloor offer={flashOffer} products={snapshot?.hotProducts ?? []} />

      <Link aria-label="领券中心入口" className="sdk-h5-coupon-entry" to="/buyer/coupons">
        <Ticket aria-hidden="true" size={18} />
        <span>领券中心 · 天天领福利</span>
        <ArrowRight aria-hidden="true" size={14} />
      </Link>

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

      {footprint.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>最近浏览</h2>
          <div className="sdk-h5-chip-row">
            {footprint.map((item) => (
              <Link key={`${item.id}-${item.viewedAt}`} to={`/product/${item.id}`}>{item.title || item.id}</Link>
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
