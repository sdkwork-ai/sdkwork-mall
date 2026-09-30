import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Flame, History, Sparkles, Store, Tag } from "lucide-react";
import { EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import {
  listEnabledMallCmsBanners,
  listEnabledMallCmsFloors,
  type MallCmsBanner,
  type MallCmsFloor,
} from "@sdkwork/mall-pc-cms/cms-config";
import { loadMallCmsConfigRemote } from "@sdkwork/mall-pc-cms/cms-service";
import { searchMallProducts } from "@sdkwork/mall-pc-search/search-service";
import { readMallFootprint, type MallFootprintItem } from "@sdkwork/mall-pc-reviews/footprint-service";
import {
  formatCountdown,
  getActivityCountdownTarget,
  listMallActivities,
  type MallActivityOffer,
} from "@sdkwork/mall-pc-activity/activity-service";
import { loadMallHomeSnapshot, type MallHomeProductCard, type MallHomeSnapshot } from "../home-service";

const BANNER_AUTOPLAY_INTERVAL_MS = 5000;
const SEKILL_AUTOPLAY_INTERVAL_MS = 1000;
const SEKILL_STRIP_SIZE = 4;

interface SdkworkMallSeckillCountdownState {
  phase: "active" | "ended" | "upcoming";
  label: string;
}

function useMallSeckillActivities() {
  const [offers, setOffers] = useState<MallActivityOffer[]>([]);

  useEffect(() => {
    let active = true;
    void listMallActivities()
      .then((rows) => {
        if (active) {
          setOffers(
            rows
              .filter((row) => row.activityType === "flash-sale" || row.activityType === "limited-rush")
              .slice(0, SEKILL_STRIP_SIZE),
          );
        }
      })
      .catch(() => {
        // 秒杀区块为可选增强，加载失败时静默隐藏。
      });
    return () => {
      active = false;
    };
  }, []);

  return offers;
}

function useMallSeckillCountdown(offers: MallActivityOffer[]): SdkworkMallSeckillCountdownState[] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (offers.length === 0) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), SEKILL_AUTOPLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [offers.length]);

  return useMemo(
    () =>
      offers.map((offer) => {
        const countdown = getActivityCountdownTarget(offer);
        if (!countdown || countdown.phase === "ended") {
          return { phase: "ended" as const, label: "已结束" };
        }
        const parts = formatCountdown(countdown.target);
        const pad = (value: number) => String(value).padStart(2, "0");
        const clock = `${pad(parts.days * 24 + parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
        return {
          phase: countdown.phase,
          label: countdown.phase === "upcoming" ? `距开始 ${clock}` : `距结束 ${clock}`,
        };
      }),
    [offers, now],
  );
}

function SdkworkMallSeckillStrip({ offers }: { offers: MallActivityOffer[] }) {
  const countdowns = useMallSeckillCountdown(offers);
  if (offers.length === 0) {
    return null;
  }

  return (
    <section className="sdkwork-mall-pc-floor sdkwork-mall-pc-seckill">
      <h2>
        <Clock aria-hidden="true" size={18} /> 秒杀专场
      </h2>
      <div className="sdkwork-mall-pc-seckill-row">
        {offers.map((offer, index) => {
          const countdown = countdowns[index];
          return (
            <Link
              className="sdkwork-mall-pc-seckill-card"
              key={offer.id}
              to={`/activity/${offer.id}`}
            >
              <div className="sdkwork-mall-pc-seckill-head">
                <strong>{offer.title}</strong>
                {offer.discountText ? <span>{offer.discountText}</span> : null}
              </div>
              {offer.highlight ? <p>{offer.highlight}</p> : null}
              <span
                className={
                  countdown.phase === "active"
                    ? "sdkwork-mall-pc-seckill-countdown sdkwork-mall-pc-seckill-countdown-active"
                    : "sdkwork-mall-pc-seckill-countdown"
                }
              >
                {countdown.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SdkworkMallBannerCarousel({ banners }: { banners: MallCmsBanner[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1 || isPaused) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, BANNER_AUTOPLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [count, isPaused]);

  const activeBanner = banners[activeIndex];

  if (count === 0) {
    return null;
  }

  return (
    <section
      className="sdkwork-mall-pc-banner-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {count === 1 || !activeBanner ? (
        <BannerCard banner={activeBanner ?? banners[0]} />
      ) : (
        <>
          {banners.map((banner, index) => (
            <BannerCard banner={banner} hidden={index !== activeIndex} key={banner.id} />
          ))}
          <div className="sdkwork-mall-pc-banner-dots" role="tablist" aria-label="banner 切换">
            {banners.map((banner, index) => (
              <button
                aria-label={`切换到第 ${index + 1} 张 banner`}
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "sdkwork-mall-pc-banner-dot sdkwork-mall-pc-banner-dot-active"
                    : "sdkwork-mall-pc-banner-dot"
                }
                key={banner.id}
                onClick={() => setActiveIndex(index)}
                role="tab"
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BannerCard({ banner, hidden = false }: { banner: MallCmsBanner; hidden?: boolean }) {
  return (
    <Link
      className="sdkwork-mall-pc-banner-card"
      key={banner.id}
      style={hidden ? { display: "none" } : undefined}
      to={banner.linkUrl}
    >
      {banner.imageUrl ? <img alt={banner.title} src={banner.imageUrl} /> : <Sparkles aria-hidden="true" size={24} />}
      <div>
        <h2>{banner.title}</h2>
        {banner.subtitle ? <p>{banner.subtitle}</p> : null}
      </div>
    </Link>
  );
}

function ProductGrid({
  loading,
  products,
  title,
}: {
  loading: boolean;
  products: MallHomeProductCard[];
  title: string;
}) {
  if (loading) {
    return <LoadingBlock label={`加载${title}...`} />;
  }

  if (products.length === 0) {
    return <EmptyState description="暂无商品" title={title} />;
  }

  return (
    <section className="sdkwork-mall-pc-floor">
      <h2>{title}</h2>
      <div className="sdkwork-mall-pc-product-grid">
        {products.map((product) => (
          <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
            <div className="sdkwork-mall-pc-product-image">
              {product.imageUrl ? <img alt={product.title} src={product.imageUrl} /> : <Tag aria-hidden="true" />}
            </div>
            <div className="sdkwork-mall-pc-product-body">
              <h3>{product.title}</h3>
              {product.subtitle ? <p>{product.subtitle}</p> : null}
              <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}</strong>
              {product.shopName ? <span>{product.shopName}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HomeFloorSection({ floor }: { floor: MallCmsFloor }) {
  const [products, setProducts] = useState<MallHomeProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const sort = floor.id.includes("new") || floor.productQuery === "new" ? "created_at" : "sales";
    searchMallProducts({
      pageSize: 8,
      query: floor.productQuery || undefined,
      sort,
    })
      .then((result) => {
        if (active) {
          setProducts(
            result.items.map((item) => ({
              id: item.id,
              title: item.title,
              priceCny: item.priceCny,
              shopName: item.shopName,
              imageUrl: item.imageUrl,
            })),
          );
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
  }, [floor.id, floor.productQuery]);

  return <ProductGrid loading={loading} products={products} title={floor.title} />;
}

export function SdkworkMallHomePage() {
  const [snapshot, setSnapshot] = useState<MallHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banners, setBanners] = useState<MallCmsBanner[]>(() => listEnabledMallCmsBanners());
  const [floors, setFloors] = useState<MallCmsFloor[]>(() => listEnabledMallCmsFloors());
  const [guessYouLike, setGuessYouLike] = useState<MallHomeProductCard[]>([]);
  const [guessLoading, setGuessLoading] = useState(true);
  const [footprint, setFootprint] = useState<MallFootprintItem[]>([]);
  const seckillOffers = useMallSeckillActivities();

  useEffect(() => {
    let active = true;
    loadMallCmsConfigRemote()
      .then((config) => {
        if (active) {
          setBanners(listEnabledMallCmsBanners(config));
          setFloors(listEnabledMallCmsFloors(config));
        }
      })
      .catch(() => {
        // Keep local defaults when remote CMS is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadMallHomeSnapshot()
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

  useEffect(() => {
    let active = true;
    // 猜你喜欢：基于热销商品随机打散，提供个性化推荐流。
    void searchMallProducts({ pageSize: 12, sort: "sales" })
      .then((result) => {
        if (active) {
          const shuffled = [...result.items]
            .map((item) => ({
              id: item.id,
              title: item.title,
              priceCny: item.priceCny,
              shopName: item.shopName,
              imageUrl: item.imageUrl,
            }))
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);
          setGuessYouLike(shuffled);
        }
      })
      .catch(() => {
        // 推荐流为可选增强，失败时静默处理。
      })
      .finally(() => {
        if (active) {
          setGuessLoading(false);
        }
      });
    // 最近浏览：从本地足迹读取。
    setFootprint(readMallFootprint().slice(0, 6));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载商城首页..." />;
  }

  if (error) {
    return <EmptyState description={error} title="首页暂不可用" />;
  }

  return (
    <div className="sdkwork-mall-pc-home">
      <SdkworkMallBannerCarousel banners={banners} />
      <SdkworkMallSeckillStrip offers={seckillOffers} />

      <section className="sdkwork-mall-pc-hero">
        <div className="sdkwork-mall-pc-hero-banner">
          <Sparkles aria-hidden="true" size={28} />
          <div>
            <h1>品质生活，一站购齐</h1>
            <p>平台自营与品牌商家，会员权益全覆盖</p>
          </div>
          <Link className="sdkwork-mall-pc-hero-cta" to="/activity">
            活动会场
          </Link>
        </div>
        <div className="sdkwork-mall-pc-hero-side">
          <Link to="/search?q=new">
            <Flame aria-hidden="true" size={18} />
            新品上市
          </Link>
          <Link to="/search?q=brand">品牌馆</Link>
          <Link to="/buyer/membership">会员专区</Link>
        </div>
      </section>

      {snapshot?.categories.length ? (
        <section className="sdkwork-mall-pc-floor">
          <h2>热门类目</h2>
          <div className="sdkwork-mall-pc-chip-row">
            {snapshot.categories.map((category) => (
              <Link key={category.id} to={`/categories/${category.id}`}>
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.featuredShops.length ? (
        <section className="sdkwork-mall-pc-floor">
          <h2><Store aria-hidden="true" size={18} /> 热门店铺</h2>
          <div className="sdkwork-mall-pc-shop-grid">
            {snapshot.featuredShops.map((shop) => (
              <Link className="sdkwork-mall-pc-shop-card" key={shop.id} to={`/shop/${shop.id}`}>
                <strong>{shop.name}</strong>
                {shop.description ? <p>{shop.description}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {floors.map((floor) => (
        <HomeFloorSection floor={floor} key={floor.id} />
      ))}

      {snapshot?.hotProducts.length ? (
        <ProductGrid loading={false} products={snapshot.hotProducts} title="热卖推荐" />
      ) : null}
      {snapshot?.newProducts.length ? (
        <ProductGrid loading={false} products={snapshot.newProducts} title="新品首发" />
      ) : null}

      {/* 最近浏览：基于本地足迹 */}
      {footprint.length > 0 ? (
        <section className="sdkwork-mall-pc-floor">
          <h2><History aria-hidden="true" size={18} /> 最近浏览</h2>
          <div className="sdkwork-mall-pc-product-grid">
            {footprint.map((item) => (
              <Link className="sdkwork-mall-pc-product-card" key={item.id} to={`/product/${item.id}`}>
                <div className="sdkwork-mall-pc-product-body">
                  <h3>{item.title}</h3>
                  <small>
                    <Clock aria-hidden="true" size={12} />
                    {new Date(item.viewedAt).toLocaleDateString("zh-CN")}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 猜你喜欢：推荐流 */}
      <ProductGrid loading={guessLoading} products={guessYouLike} title="猜你喜欢" />
    </div>
  );
}
