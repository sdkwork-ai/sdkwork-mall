import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Crown,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Truck,
  UserRound,
} from "lucide-react";
import type { MallCmsBanner } from "@sdkwork/mall-pc-cms/cms-config";
import { resolveHomeCatalogVisual } from "./home-product-card";

const BANNER_AUTOPLAY_INTERVAL_MS = 5200;

const SLIDE_THEMES = ["theme-crimson", "theme-midnight", "theme-champagne", "theme-forest"] as const;

const HERO_SERVICES: ReadonlyArray<{
  readonly desc: string;
  readonly icon: typeof Ticket;
  readonly label: string;
  readonly to: string;
}> = [
  { icon: Ticket, label: "领券中心", desc: "领券下单更省", to: "/buyer/coupons" },
  { icon: Crown, label: "会员专区", desc: "专属会员权益", to: "/buyer/membership" },
  { icon: Sparkles, label: "新品首发", desc: "抢先体验新品", to: "/search?q=new" },
  { icon: BadgeCheck, label: "品牌馆", desc: "官方品牌直营", to: "/search?q=brand" },
];

const HERO_BENEFITS: ReadonlyArray<{
  readonly desc: string;
  readonly icon: typeof Ticket;
  readonly title: string;
}> = [
  { icon: ShieldCheck, title: "正品保障", desc: "官方自营 · 品牌直供" },
  { icon: Truck, title: "极速配送", desc: "多仓直发 · 次日可达" },
  { icon: RotateCcw, title: "无忧退换", desc: "7 天无理由退换货" },
  { icon: Headphones, title: "专属客服", desc: "7×24 小时在线答疑" },
];

export interface HomeCategoryItem {
  readonly id: string;
  readonly name: string;
  readonly to: string;
}

function HomeCategoryPanel({ categories }: { readonly categories: HomeCategoryItem[] }) {
  return (
    <aside aria-label="商品分类导航" className="sdkwork-mall-pc-home-categories">
      {/* 列表独立滚动，行高固定：类目数量少时不会被拉伸，数量多时只在面板内滚动。 */}
      <div className="sdkwork-mall-pc-home-category-list">
        {categories.map((category) => {
          const visual = resolveHomeCatalogVisual(category.name);
          const Icon = visual.icon;
          return (
            <Link className="sdkwork-mall-pc-home-category-item" key={category.id} to={category.to}>
              <span className="sdkwork-mall-pc-home-category-icon">
                <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
              </span>
              <span className="sdkwork-mall-pc-home-category-name">{category.name}</span>
              <ChevronRight
                aria-hidden="true"
                className="sdkwork-mall-pc-home-category-chevron"
                size={13}
              />
            </Link>
          );
        })}
      </div>
      <Link className="sdkwork-mall-pc-home-category-more" to="/categories">
        查看全部类目
        <ChevronRight aria-hidden="true" size={12} />
      </Link>
    </aside>
  );
}

function HomeHeroCarousel({ banners }: { readonly banners: MallCmsBanner[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = banners.length;

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + count) % count);
  }, [count]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1 || isPaused) {
      return undefined;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, BANNER_AUTOPLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [count, isPaused]);

  useEffect(() => {
    if (activeIndex >= count) {
      setActiveIndex(0);
    }
  }, [activeIndex, count]);

  if (count === 0) {
    return (
      <div className="sdkwork-mall-pc-home-stage">
        <div className="sdkwork-mall-pc-home-slide theme-crimson is-active">
          <div className="sdkwork-mall-pc-home-slide-copy">
            <span className="sdkwork-mall-pc-home-slide-eyebrow">
              <Sparkles aria-hidden="true" size={13} />
              SDKWork 甄选
            </span>
            <h2 className="sdkwork-mall-pc-home-slide-title">品质生活，一站购齐</h2>
            <p className="sdkwork-mall-pc-home-slide-subtitle">
              平台自营与品牌旗舰商家，正品直供，会员权益全覆盖。
            </p>
            <div className="sdkwork-mall-pc-home-slide-actions">
              <Link className="sdkwork-mall-pc-home-slide-cta" to="/search">
                开始逛逛
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="sdkwork-mall-pc-home-slide-art">
            <span className="sdkwork-mall-pc-home-slide-halo" />
            <span className="sdkwork-mall-pc-home-slide-seal">
              <span className="sdkwork-mall-pc-home-slide-seal-mark">商</span>
              <span className="sdkwork-mall-pc-home-slide-seal-caption">SDKWORK SELECT</span>
            </span>
            <span className="sdkwork-mall-pc-home-slide-art-note">
              <ShieldCheck aria-hidden="true" size={13} />
              官方自营 · 品质保障
            </span>
            <Sparkles className="sdkwork-mall-pc-home-slide-spark is-large" size={40} strokeWidth={1.2} />
            <Sparkles className="sdkwork-mall-pc-home-slide-spark is-small" size={22} strokeWidth={1.2} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sdkwork-mall-pc-home-stage"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {banners.map((banner, index) => {
        const isActive = index === activeIndex;
        return (
          <div
            aria-hidden={!isActive}
            className={`sdkwork-mall-pc-home-slide ${SLIDE_THEMES[index % SLIDE_THEMES.length]}${
              banner.imageUrl ? " has-image" : ""
            }${isActive ? " is-active" : ""}`}
            key={banner.id}
          >
            {banner.imageUrl ? (
              <img
                alt=""
                className="sdkwork-mall-pc-home-slide-image"
                decoding="async"
                loading={index === 0 ? "eager" : "lazy"}
                src={banner.imageUrl}
              />
            ) : null}
            <div className="sdkwork-mall-pc-home-slide-copy">
              <span className="sdkwork-mall-pc-home-slide-eyebrow">
                <Sparkles aria-hidden="true" size={13} />
                SDKWork 甄选
              </span>
              <h2 className="sdkwork-mall-pc-home-slide-title">{banner.title}</h2>
              {banner.subtitle ? (
                <p className="sdkwork-mall-pc-home-slide-subtitle">{banner.subtitle}</p>
              ) : null}
              <div className="sdkwork-mall-pc-home-slide-actions">
                <Link className="sdkwork-mall-pc-home-slide-cta" to={banner.linkUrl}>
                  立即查看
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
                <Link className="sdkwork-mall-pc-home-slide-ghost" to="/activity">
                  全部活动
                </Link>
              </div>
            </div>
            {banner.imageUrl ? null : (
              <div aria-hidden="true" className="sdkwork-mall-pc-home-slide-art">
                <span className="sdkwork-mall-pc-home-slide-halo" />
                <span className="sdkwork-mall-pc-home-slide-seal">
                  <span className="sdkwork-mall-pc-home-slide-seal-mark">商</span>
                  <span className="sdkwork-mall-pc-home-slide-seal-caption">SDKWORK SELECT</span>
                </span>
                <span className="sdkwork-mall-pc-home-slide-art-note">
                  <ShieldCheck aria-hidden="true" size={13} />
                  官方自营 · 品质保障
                </span>
                <Sparkles className="sdkwork-mall-pc-home-slide-spark is-large" size={40} strokeWidth={1.2} />
                <Sparkles className="sdkwork-mall-pc-home-slide-spark is-small" size={22} strokeWidth={1.2} />
              </div>
            )}
          </div>
        );
      })}

      {count > 1 ? (
        <>
          <button
            aria-label="上一张"
            className="sdkwork-mall-pc-home-slide-nav is-prev"
            onClick={showPrevious}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button
            aria-label="下一张"
            className="sdkwork-mall-pc-home-slide-nav is-next"
            onClick={showNext}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
          <div aria-label="轮播图切换" className="sdkwork-mall-pc-home-slide-dots" role="tablist">
            {banners.map((banner, index) => (
              <button
                aria-label={`切换到第 ${index + 1} 张`}
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "sdkwork-mall-pc-home-slide-dot is-active"
                    : "sdkwork-mall-pc-home-slide-dot"
                }
                key={banner.id}
                onClick={() => setActiveIndex(index)}
                role="tab"
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function HomeHeroRail() {
  return (
    <aside aria-label="账户与快捷入口" className="sdkwork-mall-pc-home-rail">
      <div className="sdkwork-mall-pc-home-user">
        <div className="sdkwork-mall-pc-home-user-top">
          <span aria-hidden="true" className="sdkwork-mall-pc-home-user-avatar">
            <UserRound size={22} strokeWidth={1.7} />
          </span>
          <span className="sdkwork-mall-pc-home-user-greeting">
            <strong>Hi，欢迎来到 SDKWork 商城</strong>
            <span>登录后享会员价与专属权益</span>
          </span>
        </div>
        <div className="sdkwork-mall-pc-home-user-actions">
          <Link to="/auth/login">登录</Link>
          <Link to="/auth/login">免费注册</Link>
        </div>
      </div>

      <div className="sdkwork-mall-pc-home-services">
        {HERO_SERVICES.map((service) => (
          <Link className="sdkwork-mall-pc-home-service" key={service.label} to={service.to}>
            <service.icon aria-hidden="true" size={22} strokeWidth={1.7} />
            <span className="sdkwork-mall-pc-home-service-label">{service.label}</span>
            <span className="sdkwork-mall-pc-home-service-desc">{service.desc}</span>
          </Link>
        ))}
      </div>

      <div className="sdkwork-mall-pc-home-notice">
        <Bell aria-hidden="true" size={15} />
        <span>平台自营正品 · 7 天无理由退换</span>
      </div>
    </aside>
  );
}

export function HomeHero({
  banners,
  categories,
}: {
  readonly banners: MallCmsBanner[];
  readonly categories: HomeCategoryItem[];
}) {
  return (
    <>
      <section className="sdkwork-mall-pc-home-hero">
        <HomeCategoryPanel categories={categories} />
        <HomeHeroCarousel banners={banners} />
        <HomeHeroRail />
      </section>

      <section aria-label="服务承诺" className="sdkwork-mall-pc-home-benefits">
        {HERO_BENEFITS.map((benefit) => (
          <div className="sdkwork-mall-pc-home-benefit" key={benefit.title}>
            <span className="sdkwork-mall-pc-home-benefit-icon">
              <benefit.icon aria-hidden="true" size={18} strokeWidth={1.8} />
            </span>
            <span className="sdkwork-mall-pc-home-benefit-copy">
              <strong>{benefit.title}</strong>
              <span>{benefit.desc}</span>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
