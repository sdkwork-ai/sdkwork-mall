import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

const HOME_BANNERS = [
  { id: "banner-quality", linkUrl: "/categories", subtitleKey: "home.banners.quality.subtitle", titleKey: "home.banners.quality.title" },
  { id: "banner-new", linkUrl: "/search?q=new", subtitleKey: "home.banners.new.subtitle", titleKey: "home.banners.new.title" },
  { id: "banner-coupon", linkUrl: "/buyer/coupons", subtitleKey: "home.banners.coupon.subtitle", titleKey: "home.banners.coupon.title" },
  { id: "banner-member", linkUrl: "/buyer/membership", subtitleKey: "home.banners.member.subtitle", titleKey: "home.banners.member.title" },
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
  const { t } = useTranslation();
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
    <section aria-label={t("home.banners.recommendAria")} className="sdk-h5-banner-carousel">
      <div className="sdk-h5-banner-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {HOME_BANNERS.map((banner) => (
          <Link className="sdk-h5-banner" key={banner.id} to={banner.linkUrl}>
            <h1>{t(banner.titleKey)}</h1>
            <p>{t(banner.subtitleKey)}</p>
          </Link>
        ))}
      </div>
      <div className="sdk-h5-banner-dots" role="tablist" aria-label={t("home.banners.carouselAria")}>
        {HOME_BANNERS.map((banner, index) => (
          <button
            aria-label={t("home.banners.bannerAria", { index: index + 1 })}
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
  const { t } = useTranslation();
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
        <h2>{t("home.seckill.title")}</h2>
        <span className="sdk-h5-seckill-countdown" aria-label={t("home.seckill.countdownAria")}>
          {formatCountdown(remainingSeconds)}
        </span>
        <Link className="sdk-h5-seckill-more" to={`/activity/${offer.id}`}>
          {offer.discountText || t("home.seckill.goBuy")} <ArrowRight aria-hidden="true" size={12} />
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
              {product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : t("home.price.inquiry")}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: MallH5HomeSnapshot["hotProducts"][number] }) {
  const { t } = useTranslation();
  return (
    <Link className="sdk-h5-product-card" to={`/product/${product.id}`}>
      <div className="sdk-h5-product-image">
        {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : <Search aria-hidden="true" size={22} />}
      </div>
      <div className="sdk-h5-product-title">{product.title}</div>
      <div className="sdk-h5-product-meta">
        {product.priceCny != null ? (
          <strong>¥{product.priceCny.toFixed(2)}</strong>
        ) : (
          <strong>{t("home.price.inquiry")}</strong>
        )}
        {product.sales != null ? <span>{t("home.price.sold", { count: product.sales })}</span> : null}
      </div>
    </Link>
  );
}

export function SdkworkMallH5HomePage() {
  const { t } = useTranslation();
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
          setError(cause instanceof Error ? cause.message : t("home.error.load"));
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
  }, [t]);

  const flashOffer = useMemo(() => {
    // Campaign titles are server data; the tokens that identify a seckill are
    // catalogue copy so a locale can describe its own campaign naming.
    const tokens = t("home.seckill.titleMatch").split(",").map((token) => token.trim()).filter(Boolean);
    return (
      snapshot?.offers.find((offer) => tokens.some((token) => offer.title.includes(token)))
      ?? snapshot?.offers[0]
    );
  }, [snapshot, t]);

  return (
    <div className="sdk-h5-page">
      <BannerCarousel />

      <section aria-label={t("home.quick.aria")} className="sdk-h5-quick-row">
        <Link className="sdk-h5-quick-item" to="/categories">{t("home.quick.categories")}</Link>
        <Link className="sdk-h5-quick-item" to="/search?q=new">{t("home.quick.new")}</Link>
        <Link className="sdk-h5-quick-item" to="/search?sort=sales">{t("home.quick.hot")}</Link>
        <Link className="sdk-h5-quick-item" to="/activity">{t("home.quick.activity")}</Link>
        <Link className="sdk-h5-quick-item" to="/buyer/coupons">{t("home.quick.coupon")}</Link>
      </section>

      {loading ? <div className="sdk-h5-loading">{t("home.loading")}</div> : null}
      {error ? <SdkworkMallH5ErrorState message={error} /> : null}

      {snapshot?.categories.length ? (
        <section aria-label={t("home.categoriesAria")} className="sdk-h5-section">
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

      <Link aria-label={t("home.couponEntry.aria")} className="sdk-h5-coupon-entry" to="/buyer/coupons">
        <Ticket aria-hidden="true" size={18} />
        <span>{t("home.couponEntry.text")}</span>
        <ArrowRight aria-hidden="true" size={14} />
      </Link>

      {snapshot?.featuredShops.length ? (
        <section className="sdk-h5-section">
          <h2>{t("home.sections.shops")}</h2>
          <div className="sdk-h5-chip-row">
            {snapshot.featuredShops.map((shop) => (
              <Link key={shop.id} to={`/shop/${shop.id}`}>{shop.name}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {footprint.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>{t("home.sections.footprint")}</h2>
          <div className="sdk-h5-chip-row">
            {footprint.map((item) => (
              <Link key={`${item.id}-${item.viewedAt}`} to={`/product/${item.id}`}>{item.title || item.id}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.hotProducts.length ? (
        <section className="sdk-h5-section">
          <h2>{t("home.sections.hot")}</h2>
          <div className="sdk-h5-product-grid">
            {snapshot.hotProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.newProducts.length ? (
        <section className="sdk-h5-section">
          <h2>{t("home.sections.new")}</h2>
          <div className="sdk-h5-product-grid">
            {snapshot.newProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 服务入口：让帮助中心 / 电视购物 / 设置 这些非交易页在首页可达，
          避免出现「已实现但无入口」的孤儿页面。 */}
      <section className="sdk-h5-section">
        <h2>{t("home.sections.more")}</h2>
        <div className="sdk-h5-quick-grid">
          <Link className="sdk-h5-quick-grid-item" to="/help">
            <span>{t("home.more.help")}</span>
          </Link>
          <Link className="sdk-h5-quick-grid-item" to="/tv">
            <span>{t("home.more.tv")}</span>
          </Link>
          <Link className="sdk-h5-quick-grid-item" to="/buyer/orders">
            <span>{t("home.more.orders")}</span>
          </Link>
          <Link className="sdk-h5-quick-grid-item" to="/buyer/settings">
            <span>{t("home.more.settings")}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
