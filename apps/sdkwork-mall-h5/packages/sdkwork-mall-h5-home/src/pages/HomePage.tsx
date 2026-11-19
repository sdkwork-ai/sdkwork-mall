import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Flame,
  LayoutGrid,
  LifeBuoy,
  Package,
  PartyPopper,
  Pause,
  Play,
  Search,
  Settings,
  Sparkles,
  Star,
  Ticket,
  Tv,
  type LucideIcon,
} from "lucide-react";

import { loadMallH5HomeSnapshot, type MallH5HomeOffer, type MallH5HomeSnapshot } from "../home-service";
import { resolveSdkworkMallH5CategoryVisual } from "@sdkwork/mall-h5-commons/category-visual";
import { readMallH5Footprint } from "@sdkwork/mall-h5-buyer/favorites-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

type HomeBannerTone = "brand" | "ember" | "teal" | "violet";

interface HomeBanner {
  readonly id: string;
  readonly linkUrl: string;
  readonly subtitleKey: string;
  readonly titleKey: string;
  readonly tone: HomeBannerTone;
}

/**
 * Storefront hero banners. Copy is catalogue-owned (i18n fragments), the link
 * targets stay inside mounted H5 routes, and the tone picks the poster
 * gradient. A CMS-driven banner feed can replace this list without touching
 * the carousel behaviour below.
 */
const HOME_BANNERS: readonly HomeBanner[] = [
  {
    id: "banner-quality",
    linkUrl: "/categories",
    subtitleKey: "home.banners.quality.subtitle",
    titleKey: "home.banners.quality.title",
    tone: "brand",
  },
  {
    id: "banner-new",
    linkUrl: "/search?sort=newest",
    subtitleKey: "home.banners.new.subtitle",
    titleKey: "home.banners.new.title",
    tone: "teal",
  },
  {
    id: "banner-coupon",
    linkUrl: "/buyer/coupons",
    subtitleKey: "home.banners.coupon.subtitle",
    titleKey: "home.banners.coupon.title",
    tone: "ember",
  },
  {
    id: "banner-member",
    linkUrl: "/buyer/membership",
    subtitleKey: "home.banners.member.subtitle",
    titleKey: "home.banners.member.title",
    tone: "violet",
  },
];

const BANNER_AUTOPLAY_INTERVAL_MS = 4200;
const BANNER_SWIPE_MIN_THRESHOLD_PX = 40;
const BANNER_SWIPE_WIDTH_RATIO = 0.18;
const BANNER_SWIPE_CLICK_GUARD_MS = 400;

/**
 * Four columns × two rows. The default dataset seeds exactly eight first-level
 * categories, so a freshly initialized environment fills the grid with no empty
 * cell; the rest stay reachable through the 分类 tab.
 */
const HOME_CATEGORY_GRID_LIMIT = 8;

function wrapBannerIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/** The carousel must not auto-advance for a visitor who asked for less motion. */
function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
    };
  }, []);

  return reducedMotion;
}

function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

type HomeEntryTone = "amber" | "blue" | "emerald" | "rose" | "violet";

interface HomeEntry {
  readonly icon: LucideIcon;
  readonly id: string;
  readonly labelKey: string;
  readonly to: string;
  readonly tone: HomeEntryTone;
}

/**
 * Storefront entry wheel: the five destinations a shopper reaches most often.
 * Icons make the strip scannable at a glance; the labels stay from the
 * catalogue so every locale keeps its own wording.
 */
const HOME_QUICK_ENTRIES: readonly HomeEntry[] = [
  { icon: LayoutGrid, id: "categories", labelKey: "home.quick.categories", to: "/categories", tone: "blue" },
  { icon: Sparkles, id: "new", labelKey: "home.quick.new", to: "/search?sort=newest", tone: "violet" },
  { icon: Flame, id: "hot", labelKey: "home.quick.hot", to: "/search", tone: "amber" },
  { icon: PartyPopper, id: "activity", labelKey: "home.quick.activity", to: "/activity", tone: "rose" },
  { icon: Ticket, id: "coupon", labelKey: "home.quick.coupon", to: "/buyer/coupons", tone: "emerald" },
];

/** Non-trading destinations that would otherwise be orphan screens. */
const HOME_SERVICE_ENTRIES: readonly HomeEntry[] = [
  { icon: LifeBuoy, id: "help", labelKey: "home.more.help", to: "/help", tone: "blue" },
  { icon: Tv, id: "tv", labelKey: "home.more.tv", to: "/tv", tone: "violet" },
  { icon: Package, id: "orders", labelKey: "home.more.orders", to: "/buyer/orders", tone: "amber" },
  { icon: Settings, id: "settings", labelKey: "home.more.settings", to: "/buyer/settings", tone: "emerald" },
];

function HomeSectionHeader({ moreTo, title }: { moreTo?: string; title: string }) {
  const { t } = useTranslation();
  return (
    <header className="sdk-h5-section-header">
      <h2>{title}</h2>
      {moreTo ? (
        <Link className="sdk-h5-section-more" to={moreTo}>
          {t("home.actions.more")}
          <ChevronRight aria-hidden="true" size={14} />
        </Link>
      ) : null}
    </header>
  );
}

/**
 * First-load skeleton. A blank strip under the hero reads as a broken page on
 * a slow network; placeholder tiles keep the layout stable until the snapshot
 * lands and screen readers get one succinct busy state instead of a text flash.
 */
function HomeLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="sdk-h5-home-skeleton">
      <section className="sdk-h5-section">
        <div className="sdk-h5-skeleton-category-grid">
          {Array.from({ length: HOME_CATEGORY_GRID_LIMIT }, (_, index) => (
            <span className="sdk-h5-skeleton sdk-h5-skeleton-tile" key={index} />
          ))}
        </div>
      </section>
      <section className="sdk-h5-section">
        <span className="sdk-h5-skeleton sdk-h5-skeleton-heading" />
        <div className="sdk-h5-skeleton-product-grid">
          {[0, 1, 2, 3].map((index) => (
            <span className="sdk-h5-skeleton sdk-h5-skeleton-product" key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Storefront hero carousel.
 *
 * Completeness rules it has to satisfy on a phone:
 * - every slide is exactly one viewport wide and the track has no gutters, so
 *   a snap never lands between two posters;
 * - it advances on its own, but pauses while the page is hidden, while the
 *   visitor reads (hover/focus), while it is being dragged, and permanently
 *   when the pause control is used (WCAG 2.2.2);
 * - it degrades to a manual carousel for `prefers-reduced-motion`;
 * - swipes navigate without also firing the slide link (a swipe is not a tap);
 * - dots, arrow keys and the pause control give non-touch and assistive
 *   technology users the same destinations.
 */
function BannerCarousel() {
  const { t } = useTranslation();
  const bannerCount = HOME_BANNERS.length;
  const reducedMotion = useReducedMotionPreference();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const dragOffsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const slideLinkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const keyboardFocusPendingRef = useRef(false);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(wrapBannerIndex(index, bannerCount));
    },
    [bannerCount],
  );

  useEffect(() => {
    const sync = () => {
      setPageHidden(document.visibilityState === "hidden");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // Rotation pauses when the visitor's focus is inside the hero (reading a
  // slide link) so the copy does not move under them. The pause control itself
  // is excluded: pressing "play" while it holds focus must actually play.
  const autoplayActive =
    autoplayEnabled && !reducedMotion && !focusWithin && !pageHidden && !dragging;

  // A timeout rather than an interval: every slide (auto or manual) gets a full
  // reading window instead of inheriting the remainder of the previous one.
  useEffect(() => {
    if (bannerCount < 2 || !autoplayActive) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => wrapBannerIndex(current + 1, bannerCount));
    }, BANNER_AUTOPLAY_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, autoplayActive, bannerCount]);

  function resetDrag() {
    dragOriginRef.current = null;
    dragOffsetRef.current = 0;
    setDragging(false);
    setDragOffsetPx(0);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.pointerType === "mouse") {
      return;
    }
    dragOriginRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dragOffsetRef.current = 0;
    suppressClickRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    // A vertical gesture belongs to the page scroll, not to the carousel.
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
    const width = trackRef.current?.clientWidth ?? 0;
    const limit = width > 0 ? width * 0.6 : 240;
    const nextOffset = Math.max(-limit, Math.min(limit, deltaX));
    dragOffsetRef.current = nextOffset;
    setDragOffsetPx(nextOffset);
  }

  function finishDrag(pointerId?: number) {
    const origin = dragOriginRef.current;
    if (!origin || (pointerId !== undefined && pointerId !== origin.pointerId)) {
      return;
    }
    const offset = dragOffsetRef.current;
    const width = trackRef.current?.clientWidth ?? 0;
    resetDrag();
    const threshold = Math.max(BANNER_SWIPE_MIN_THRESHOLD_PX, width * BANNER_SWIPE_WIDTH_RATIO);
    if (Math.abs(offset) < threshold) {
      return;
    }
    // The release after a swipe still emits a click on the slide link. Swallow
    // that one click: a swipe must not also navigate to the banner target.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, BANNER_SWIPE_CLICK_GUARD_MS);
    goTo(activeIndex + (offset < 0 ? 1 : -1));
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) {
      return;
    }
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      keyboardFocusPendingRef.current = true;
      goTo(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      keyboardFocusPendingRef.current = true;
      goTo(activeIndex - 1);
    }
  }

  // The slide that just left becomes `inert`, which drops its focus. A keyboard
  // visitor who pressed an arrow key keeps working inside the hero only if focus
  // follows the new active slide.
  useEffect(() => {
    if (!keyboardFocusPendingRef.current) {
      return;
    }
    keyboardFocusPendingRef.current = false;
    slideLinkRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  return (
    <section
      aria-label={t("home.banners.recommendAria")}
      aria-roledescription={t("home.banners.carouselRole")}
      className="sdk-h5-hero-carousel"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      onClickCapture={handleClickCapture}
      onFocus={(event) => {
        const target = event.target;
        setFocusWithin(!(target instanceof HTMLElement && target.closest(".sdk-h5-hero-toggle")));
      }}
      onKeyDown={handleKeyDown}
      onPointerCancel={() => {
        finishDrag();
      }}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        finishDrag();
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        finishDrag(event.pointerId);
      }}
      role="region"
    >
      <div
        className={dragging ? "sdk-h5-hero-track sdk-h5-hero-track--dragging" : "sdk-h5-hero-track"}
        ref={trackRef}
        style={{ transform: `translate3d(calc(-${activeIndex * 100}% + ${dragOffsetPx}px), 0, 0)` }}
      >
        {HOME_BANNERS.map((banner, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              aria-label={t("home.banners.bannerAria", { index: index + 1, total: bannerCount })}
              aria-roledescription={t("home.banners.slideRole")}
              className={`sdk-h5-hero-slide sdk-h5-hero-slide--${banner.tone}`}
              inert={!isActive}
              key={banner.id}
              role="group"
            >
              <Link
                className="sdk-h5-hero-link"
                ref={(node) => {
                  slideLinkRefs.current[index] = node;
                }}
                tabIndex={isActive ? undefined : -1}
                to={banner.linkUrl}
              >
                <span className="sdk-h5-hero-title">{t(banner.titleKey)}</span>
                <span className="sdk-h5-hero-subtitle">{t(banner.subtitleKey)}</span>
                <span className="sdk-h5-hero-cta">
                  {t("home.banners.cta")}
                  <ArrowRight aria-hidden="true" size={13} />
                </span>
              </Link>
            </div>
          );
        })}
      </div>

      <div aria-label={t("home.banners.carouselAria")} className="sdk-h5-hero-dots" role="group">
        {HOME_BANNERS.map((banner, index) => (
          <button
            aria-current={index === activeIndex ? "true" : undefined}
            aria-label={t("home.banners.dotAria", { index: index + 1, total: bannerCount })}
            className={
              index === activeIndex
                ? "sdk-h5-hero-dot sdk-h5-hero-dot--active"
                : "sdk-h5-hero-dot"
            }
            key={banner.id}
            onClick={(event) => {
              // A tap focuses the dot on mobile browsers; release that focus so
              // the focus-pause rule does not stop rotation permanently.
              if (event.detail > 0) {
                event.currentTarget.blur();
              }
              goTo(index);
            }}
            type="button"
          />
        ))}
      </div>

      {reducedMotion ? null : (
        <button
          aria-label={autoplayEnabled ? t("home.banners.pause") : t("home.banners.play")}
          className="sdk-h5-hero-toggle"
          onClick={() => {
            setAutoplayEnabled((enabled) => !enabled);
          }}
          type="button"
        >
          {autoplayEnabled ? (
            <Pause aria-hidden="true" size={11} />
          ) : (
            <Play aria-hidden="true" size={11} />
          )}
        </button>
      )}
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
          <strong>
            <span className="sdk-h5-price-currency">¥</span>
            {product.priceCny.toFixed(2)}
          </strong>
        ) : (
          <strong>{t("home.price.inquiry")}</strong>
        )}
        {product.sales != null ? <span className="sdk-h5-product-sales">{t("home.price.sold", { count: product.sales })}</span> : null}
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
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [t, reloadToken]);

  /** Retry in place: keeps the shell, the hero and the visitor's scroll. */
  function reloadHome() {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }

  const hasHomeContent = Boolean(
    snapshot &&
      (snapshot.categories.length > 0 ||
        snapshot.featuredShops.length > 0 ||
        snapshot.hotProducts.length > 0 ||
        snapshot.newProducts.length > 0 ||
        snapshot.offers.length > 0),
  );

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
    <div aria-busy={loading} className="sdk-h5-page sdk-h5-home-page">
      <h1 className="sdk-h5-visually-hidden">{t("home.title")}</h1>
      <BannerCarousel />

      <section aria-label={t("home.quick.aria")} className="sdk-h5-quick-row">
        {HOME_QUICK_ENTRIES.map(({ icon: EntryIcon, ...entry }) => (
          <Link className="sdk-h5-quick-item" key={entry.id} to={entry.to}>
            <span aria-hidden="true" className={`sdk-h5-quick-icon sdk-h5-tile--${entry.tone}`}>
              <EntryIcon size={20} />
            </span>
            <span className="sdk-h5-quick-label">{t(entry.labelKey)}</span>
          </Link>
        ))}
      </section>

      {loading ? <HomeLoadingSkeleton /> : null}
      {error ? <SdkworkMallH5ErrorState message={error} onRetry={reloadHome} /> : null}

      {!loading && !error && !hasHomeContent ? (
        <section className="sdk-h5-section sdk-h5-home-empty" role="status">
          <p className="sdk-h5-home-empty-title">{t("home.empty.title")}</p>
          <p className="sdk-h5-muted">{t("home.empty.hint")}</p>
          <button className="sdk-h5-button sdk-h5-button-primary" onClick={reloadHome} type="button">
            {t("home.empty.retry")}
          </button>
        </section>
      ) : null}

      {snapshot?.categories.length ? (
        <section aria-label={t("home.categoriesAria")} className="sdk-h5-section">
          <div className="sdk-h5-category-grid">
            {snapshot.categories.slice(0, HOME_CATEGORY_GRID_LIMIT).map((category) => {
              // The icon belongs to the category identity, not to its position:
              // resolving from index made every card change glyph on reorder.
              const { icon: CategoryIcon, tone } = resolveSdkworkMallH5CategoryVisual({
                code: category.code,
                name: category.name,
              });
              return (
                <Link className="sdk-h5-category-item" key={category.id} to={`/categories/${category.id}`}>
                  <span aria-hidden="true" className={`sdk-h5-category-icon sdk-h5-tile--${tone}`}>
                    <CategoryIcon size={20} />
                  </span>
                  <span className="sdk-h5-category-name">{category.name}</span>
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
          <HomeSectionHeader title={t("home.sections.shops")} />
          <div className="sdk-h5-shop-grid">
            {snapshot.featuredShops.map((shop) => (
              <Link className="sdk-h5-shop-card" key={shop.id} to={`/shop/${shop.id}`}>
                <span aria-hidden="true" className="sdk-h5-shop-avatar">
                  {shop.name.slice(0, 1)}
                </span>
                <span className="sdk-h5-shop-body">
                  <span className="sdk-h5-shop-name">{shop.name}</span>
                  {shop.rating != null ? (
                    <span
                      aria-label={t("home.shops.ratingAria", { rating: shop.rating.toFixed(1) })}
                      className="sdk-h5-shop-rating"
                    >
                      <Star aria-hidden="true" fill="currentColor" size={11} />
                      {shop.rating.toFixed(1)}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" className="sdk-h5-shop-chevron" size={15} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {footprint.length > 0 ? (
        <section className="sdk-h5-section">
          <HomeSectionHeader title={t("home.sections.footprint")} />
          <div className="sdk-h5-chip-row">
            {footprint.map((item) => (
              <Link key={`${item.id}-${item.viewedAt}`} to={`/product/${item.id}`}>{item.title || item.id}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.hotProducts.length ? (
        <section className="sdk-h5-section">
          <HomeSectionHeader moreTo="/search" title={t("home.sections.hot")} />
          <div className="sdk-h5-product-grid">
            {snapshot.hotProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {snapshot?.newProducts.length ? (
        <section className="sdk-h5-section">
          <HomeSectionHeader moreTo="/search?sort=newest" title={t("home.sections.new")} />
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
        <HomeSectionHeader title={t("home.sections.more")} />
        <div className="sdk-h5-quick-grid">
          {HOME_SERVICE_ENTRIES.map(({ icon: EntryIcon, ...entry }) => (
            <Link className="sdk-h5-quick-grid-item" key={entry.id} to={entry.to}>
              <span aria-hidden="true" className={`sdk-h5-service-icon sdk-h5-tile--${entry.tone}`}>
                <EntryIcon size={18} />
              </span>
              <span>{t(entry.labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
