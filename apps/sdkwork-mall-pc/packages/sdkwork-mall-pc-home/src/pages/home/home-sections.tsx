import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Flame,
  History,
  PackageCheck,
  Sparkles,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MallCmsFloor } from "@sdkwork/mall-pc-cms/cms-config";
import type { MallFootprintItem } from "@sdkwork/mall-pc-reviews/footprint-service";
import type { MallHomeProductCard, MallHomeShopCard } from "../../home-service";
import {
  HomeEmpty,
  HomeProductArtwork,
  HomeProductCard,
  HomeProductSkeletons,
  resolveHomeCatalogVisual,
  resolveHomeProductTone,
} from "./home-product-card";

export function HomeSectionHead({
  icon: Icon,
  moreLabel = "查看更多",
  moreTo,
  subtitle,
  title,
}: {
  readonly icon?: LucideIcon;
  readonly moreLabel?: string;
  readonly moreTo?: string;
  readonly subtitle?: string;
  readonly title: string;
}) {
  return (
    <header className="sdkwork-mall-pc-home-section-head">
      <div className="sdkwork-mall-pc-home-section-title">
        <h2>
          {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.8} /> : null}
          {title}
        </h2>
        {subtitle ? <span className="sdkwork-mall-pc-home-section-sub">{subtitle}</span> : null}
      </div>
      {moreTo ? (
        <Link className="sdkwork-mall-pc-home-section-more" to={moreTo}>
          {moreLabel}
          <ChevronRight aria-hidden="true" size={13} />
        </Link>
      ) : null}
    </header>
  );
}

export interface HomeSeckillSession {
  readonly clockLabel: string;
  readonly discountText?: string;
  readonly highlight?: string;
  readonly id: string;
  readonly phase: "active" | "ended" | "upcoming";
  readonly title: string;
}

export function HomeSeckill({
  countdownLabel,
  clockParts,
  sessions,
}: {
  readonly clockParts?: readonly [string, string, string];
  readonly countdownLabel?: string;
  readonly sessions: HomeSeckillSession[];
}) {
  if (sessions.length === 0) {
    return null;
  }
  return (
    <section aria-label="限时秒杀" className="sdkwork-mall-pc-home-seckill">
      <div className="sdkwork-mall-pc-home-seckill-head">
        <span className="sdkwork-mall-pc-home-seckill-brand">
          <Flame aria-hidden="true" size={20} />
          限时秒杀
        </span>
        <span className="sdkwork-mall-pc-home-seckill-note">每日 10 点、20 点两场，限量开抢</span>
        {clockParts ? (
          <span className="sdkwork-mall-pc-home-seckill-clock">
            <Clock aria-hidden="true" size={13} />
            {countdownLabel ?? "距结束"}
            <strong>
              {clockParts.map((part, index) => (
                <span key={`${part}-${index}`}>{part}</span>
              ))}
            </strong>
          </span>
        ) : null}
        <Link className="sdkwork-mall-pc-home-seckill-more" to="/activity">
          更多秒杀
          <ChevronRight aria-hidden="true" size={13} />
        </Link>
      </div>
      <div className="sdkwork-mall-pc-home-seckill-offers">
        {sessions.map((session) => (
          <Link className="sdkwork-mall-pc-home-offer" key={session.id} to={`/activity/${session.id}`}>
            <span className="sdkwork-mall-pc-home-offer-top">
              <span className="sdkwork-mall-pc-home-offer-badge">
                {session.discountText ?? "限时特惠"}
              </span>
              <ArrowRight aria-hidden="true" className="sdkwork-mall-pc-home-offer-arrow" size={15} />
            </span>
            <span className="sdkwork-mall-pc-home-offer-title">{session.title}</span>
            {session.highlight ? (
              <p className="sdkwork-mall-pc-home-offer-highlight">{session.highlight}</p>
            ) : null}
            <span className="sdkwork-mall-pc-home-offer-foot">
              <span
                className={
                  session.phase === "active"
                    ? "sdkwork-mall-pc-home-offer-clock"
                    : "sdkwork-mall-pc-home-offer-clock is-muted"
                }
              >
                {session.clockLabel}
              </span>
              <span className="sdkwork-mall-pc-home-offer-arrow">立即抢</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function resolveFloorIcon(title: string): LucideIcon {
  if (/爆款|热卖|秒杀/.test(title)) {
    return Flame;
  }
  if (/新品|首发/.test(title)) {
    return Sparkles;
  }
  return resolveHomeCatalogVisual(title).icon;
}

/**
 * 楼层货架统一使用 5 列栅格。
 *
 * Earlier shelves re-flowed to 3 or 4 columns when a CMS floor was backed by
 * fewer products, which stretched each card to 280-380px and made neighbouring
 * sections look misaligned. Every storefront shelf (floors and 猜你喜欢) now
 * shares one card rhythm; a short shelf simply leaves its trailing cells empty,
 * exactly like a mainstream mall.
 */
const SHELF_COLUMNS = 5;

export function HomeFloor({
  floor,
  loading,
  products,
}: {
  readonly floor: MallCmsFloor;
  readonly loading: boolean;
  readonly products: MallHomeProductCard[];
}) {
  const isNew = floor.id.includes("new") || floor.productQuery === "new";
  const moreTo =
    floor.productQuery && floor.productQuery !== "new"
      ? `/search?q=${encodeURIComponent(floor.productQuery)}`
      : isNew
        ? "/search?sort=newest"
        : "/search";
  const FloorIcon = resolveFloorIcon(floor.title);
  if (!loading && products.length < 3) {
    return null;
  }
  // 不足一整行的货架用一块“查看全部”跳转卡补齐，保持每层右边缘与 5 列栅格对齐。
  const remainder = products.length % SHELF_COLUMNS;
  const fillSpan = remainder === 0 ? 0 : SHELF_COLUMNS - remainder;
  return (
    <section className="sdkwork-mall-pc-home-section">
      <HomeSectionHead
        icon={FloorIcon}
        moreLabel="查看更多"
        moreTo={moreTo}
        title={floor.title}
      />
      {loading ? (
        <HomeProductSkeletons count={SHELF_COLUMNS} />
      ) : (
        <div className="sdkwork-mall-pc-home-grid is-cols-5">
          {products.map((product) => (
            <HomeProductCard key={product.id} product={product} />
          ))}
          {fillSpan > 0 ? (
            <Link
              aria-label={`查看更多${floor.title}商品`}
              className="sdkwork-mall-pc-home-shelf-fill"
              style={{ gridColumn: `span ${fillSpan}` }}
              to={moreTo}
            >
              <FloorIcon
                aria-hidden="true"
                className="sdkwork-mall-pc-home-shelf-fill-icon"
                size={88}
                strokeWidth={1.1}
              />
              <span className="sdkwork-mall-pc-home-shelf-fill-title">
                {floor.title}
              </span>
              <span className="sdkwork-mall-pc-home-shelf-fill-copy">
                精选好物持续上新
              </span>
              <span className="sdkwork-mall-pc-home-shelf-fill-cta">
                查看全部
                <ArrowRight aria-hidden="true" size={14} />
              </span>
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function HomeProductSection({
  loading,
  products,
  subtitle,
  title,
  moreTo,
  columns = "five",
}: {
  readonly columns?: "four" | "five";
  readonly loading: boolean;
  readonly moreTo: string;
  readonly products: MallHomeProductCard[];
  readonly subtitle?: string;
  readonly title: string;
}) {
  return (
    <section className="sdkwork-mall-pc-home-section">
      <HomeSectionHead
        icon={PackageCheck}
        moreLabel="查看更多"
        moreTo={moreTo}
        subtitle={subtitle}
        title={title}
      />
      {loading ? (
        <HomeProductSkeletons count={columns === "four" ? 4 : 5} />
      ) : products.length === 0 ? (
        <HomeEmpty message={`${title}暂无商品`} />
      ) : (
        <div
          className={
            columns === "four"
              ? "sdkwork-mall-pc-home-grid is-four"
              : "sdkwork-mall-pc-home-grid"
          }
        >
          {products.map((product) => (
            <HomeProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeShops({ shops }: { readonly shops: MallHomeShopCard[] }) {
  if (shops.length === 0) {
    return null;
  }
  return (
    <section className="sdkwork-mall-pc-home-section">
      <HomeSectionHead
        icon={Store}
        moreLabel="更多店铺"
        moreTo="/search?q=brand"
        subtitle="官方旗舰 · 品牌直营"
        title="热门店铺"
      />
      <div className="sdkwork-mall-pc-home-shops">
        {shops.map((shop) => (
          <Link className="sdkwork-mall-pc-shop-card" key={shop.id} to={`/shop/${shop.id}`}>
            <span className="sdkwork-mall-pc-home-shop-head">
              <span aria-hidden="true" className="sdkwork-mall-pc-home-shop-logo">
                {shop.name.trim().slice(0, 1)}
              </span>
              <span className="sdkwork-mall-pc-home-shop-meta">
                <strong>{shop.name}</strong>
                <span>官方认证商家</span>
              </span>
            </span>
            {shop.description ? <p>{shop.description}</p> : null}
            <span className="sdkwork-mall-pc-home-shop-enter">
              进店逛逛
              <ChevronRight aria-hidden="true" size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomeRecent({ items }: { readonly items: MallFootprintItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="sdkwork-mall-pc-home-section">
      <HomeSectionHead
        icon={History}
        moreLabel="查看足迹"
        moreTo="/buyer/footprint"
        subtitle="继续上次的浏览"
        title="最近浏览"
      />
      <div className="sdkwork-mall-pc-home-recent">
        {items.map((item) => (
          <Link className="sdkwork-mall-pc-home-recent-card" key={item.id} to={`/product/${item.id}`}>
            <span className="sdkwork-mall-pc-home-recent-media">
              <HomeProductArtwork
                product={{ id: item.id, priceCny: null, title: item.title }}
                tone={resolveHomeProductTone(item.id)}
              />
            </span>
            <span className="sdkwork-mall-pc-home-recent-body">
              <strong>{item.title}</strong>
              <span>
                <Clock aria-hidden="true" size={11} />
                {new Date(item.viewedAt).toLocaleDateString("zh-CN")} 浏览
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomeGuess({
  loading,
  products,
}: {
  readonly loading: boolean;
  readonly products: MallHomeProductCard[];
}) {
  return (
    <section aria-label="猜你喜欢" className="sdkwork-mall-pc-home-guess">
      <div className="sdkwork-mall-pc-home-guess-head">
        <span className="sdkwork-mall-pc-home-guess-title">
          <Sparkles aria-hidden="true" size={17} />
          猜你喜欢
        </span>
      </div>
      {loading ? (
        <HomeProductSkeletons count={10} />
      ) : products.length === 0 ? (
        <HomeEmpty actionLabel="去逛逛" actionTo="/search" message="暂无推荐商品，先去逛逛吧" />
      ) : (
        <div className="sdkwork-mall-pc-home-grid">
          {products.map((product) => (
            <HomeProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
