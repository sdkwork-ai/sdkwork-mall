import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@sdkwork/ui-pc-react";
import {
  listEnabledMallCmsBanners,
  listEnabledMallCmsFloors,
  type MallCmsBanner,
  type MallCmsFloor,
} from "@sdkwork/mall-pc-cms/cms-config";
import { loadMallCmsConfigRemote } from "@sdkwork/mall-pc-cms/cms-service";
import { searchMallProducts, type MallSearchProduct } from "@sdkwork/mall-pc-search/search-service";
import { readMallFootprint, type MallFootprintItem } from "@sdkwork/mall-pc-reviews/footprint-service";
import {
  formatCountdown,
  getActivityCountdownTarget,
  listMallActivities,
  type MallActivityOffer,
} from "@sdkwork/mall-pc-activity/activity-service";
import { sdkworkMallPcCategoryNav } from "@sdkwork/mall-pc-commons/category-nav";
import {
  claimMallHomeAutomaticSeed,
  getMallHomeSeedProfile,
  isMallHomeSeedAvailable,
  isMallHomeSeedSignedIn,
  runMallHomeSeed,
  type MallHomeSeedProfile,
} from "../home-seed";
import {
  loadMallHomeSnapshot,
  type MallHomeProductCard,
  type MallHomeSnapshot,
} from "../home-service";
import { HomeHero, type HomeCategoryItem } from "./home/home-hero";
import { HomeSetupNotice, type HomeSeedPhase } from "./home/home-setup-notice";
import {
  HomeFloor,
  HomeGuess,
  HomeProductSection,
  HomeRecent,
  HomeSeckill,
  HomeShops,
  type HomeSeckillSession,
} from "./home/home-sections";

const SECKILL_AUTOPLAY_INTERVAL_MS = 1000;
const SECKILL_STRIP_SIZE = 4;
const FOOTPRINT_SIZE = 6;
const FLOOR_PRODUCT_SIZE = 10;
const GUESS_PRODUCT_SIZE = 10;

/**
 * Upper bound for the skeleton state when the catalog API is unreachable.
 *
 * The SDK retries failed requests for a while; without this watchdog a dead
 * gateway would leave the shelves shimmering forever.
 */
const HOME_LOADING_TIMEOUT_MS = 8000;

interface FloorProductsState {
  readonly loading: boolean;
  readonly products: MallHomeProductCard[];
}

interface SeckillView {
  readonly header?: { readonly label: string; readonly parts: readonly [string, string, string] };
  readonly sessions: HomeSeckillSession[];
}

function padClock(value: number): string {
  return String(value).padStart(2, "0");
}

function toClockParts(target: Date): [string, string, string] {
  const parts = formatCountdown(target);
  return [
    padClock(parts.days * 24 + parts.hours),
    padClock(parts.minutes),
    padClock(parts.seconds),
  ];
}

function useMallSeckillOffers(): MallActivityOffer[] {
  const [offers, setOffers] = useState<MallActivityOffer[]>([]);

  useEffect(() => {
    let active = true;
    void listMallActivities()
      .then((rows) => {
        if (active) {
          setOffers(
            rows
              .filter((row) => row.activityType === "flash-sale" || row.activityType === "limited-rush")
              .slice(0, SECKILL_STRIP_SIZE),
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

function useMallSeckillView(offers: MallActivityOffer[]): SeckillView {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (offers.length === 0) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), SECKILL_AUTOPLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [offers.length]);

  return useMemo(() => {
    let header: SeckillView["header"];

    const sessions = offers.map((offer) => {
      const countdown = getActivityCountdownTarget(offer);
      if (!countdown || countdown.phase === "ended") {
        return {
          id: offer.id,
          title: offer.title,
          discountText: offer.discountText,
          highlight: offer.highlight,
          phase: "ended" as const,
          clockLabel: "已结束",
        };
      }
      const parts = toClockParts(countdown.target);
      const label = countdown.phase === "upcoming" ? "距开始" : "距结束";
      if (!header && countdown.phase === "active") {
        header = { label, parts };
      }
      return {
        id: offer.id,
        title: offer.title,
        discountText: offer.discountText,
        highlight: offer.highlight,
        phase: countdown.phase,
        clockLabel: `${label} ${parts.join(":")}`,
      };
    });

    return { header, sessions };
  }, [offers, now]);
}

function mapSearchProduct(product: MallSearchProduct): MallHomeProductCard {
  return {
    id: product.id,
    title: product.title,
    priceCny: product.priceCny,
    listPriceCny: product.listPriceCny ?? null,
    shopName: product.shopName,
    imageUrl: product.imageUrl,
    brand: product.brand,
    rating: product.rating,
    salesCount: product.salesCount,
    selfOperated: product.selfOperated,
    freeShipping: product.freeShipping,
    inStock: product.inStock,
  };
}

function useFloorProducts(floors: MallCmsFloor[]): Record<string, FloorProductsState> {
  const [state, setState] = useState<Record<string, FloorProductsState>>({});

  useEffect(() => {
    let active = true;
    setState(
      Object.fromEntries(
        floors.map((floor) => [floor.id, { loading: true, products: [] }]),
      ) as Record<string, FloorProductsState>,
    );

    for (const floor of floors) {
      const isNew = floor.id.includes("new") || floor.productQuery === "new";
      const sort = isNew ? "created_at" : "sales";
      void searchMallProducts({
        pageSize: FLOOR_PRODUCT_SIZE,
        query: isNew ? undefined : floor.productQuery || undefined,
        sort,
      })
        .then(async (result) => {
          // A floor keyword that matches nothing (a localized shelf over a
          // catalog written in another locale, for example) must not render an
          // empty shelf: fall back to the general list for the same sort.
          const resolved = result.items.length === 0 && floor.productQuery && !isNew
            ? await searchMallProducts({ pageSize: FLOOR_PRODUCT_SIZE, sort })
            : result;
          return resolved;
        })
        .then((result) => {
          if (!active) {
            return;
          }
          setState((current) => ({
            ...current,
            [floor.id]: { loading: false, products: result.items.map(mapSearchProduct) },
          }));
        })
        .catch(() => {
          if (!active) {
            return;
          }
          setState((current) => ({
            ...current,
            [floor.id]: { loading: false, products: [] },
          }));
        });
    }

    const watchdog = window.setTimeout(() => {
      if (!active) {
        return;
      }
      setState((current) => {
        const next: Record<string, FloorProductsState> = { ...current };
        for (const floor of floors) {
          if (next[floor.id]?.loading) {
            next[floor.id] = { loading: false, products: next[floor.id].products };
          }
        }
        return next;
      });
    }, HOME_LOADING_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(watchdog);
    };
  }, [floors]);

  return state;
}

function fallbackCategories(): HomeCategoryItem[] {
  return sdkworkMallPcCategoryNav.map((name, index) => ({
    id: `local-category-${index}`,
    name,
    to: `/search?q=${encodeURIComponent(name)}`,
  }));
}

export function SdkworkMallHomePage() {
  const [snapshot, setSnapshot] = useState<MallHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedPhase, setSeedPhase] = useState<HomeSeedPhase>("idle");
  const [seedMessage, setSeedMessage] = useState<string | undefined>(undefined);
  const [banners, setBanners] = useState<MallCmsBanner[]>(() => listEnabledMallCmsBanners());
  const [floors, setFloors] = useState<MallCmsFloor[]>(() => listEnabledMallCmsFloors());
  const [guessYouLike, setGuessYouLike] = useState<MallHomeProductCard[]>([]);
  const [guessLoading, setGuessLoading] = useState(true);
  const [footprint, setFootprint] = useState<MallFootprintItem[]>([]);
  const seckillOffers = useMallSeckillOffers();
  const seckillView = useMallSeckillView(seckillOffers);
  const floorProducts = useFloorProducts(floors);

  const reloadCms = useCallback(async () => {
    try {
      const config = await loadMallCmsConfigRemote();
      setBanners(listEnabledMallCmsBanners(config));
      setFloors(listEnabledMallCmsFloors(config));
    } catch {
      // Keep local defaults when remote CMS is unavailable.
    }
  }, []);

  useEffect(() => {
    void reloadCms();
  }, [reloadCms]);

  const loadHomeSnapshot = useCallback(async (): Promise<MallHomeSnapshot | null> => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadMallHomeSnapshot();
      setSnapshot(next);
      return next;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "首页加载失败");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Provisions the default dataset from the storefront.
   *
   * This is the recovery path for an install whose backend is reachable but
   * whose catalog has never been seeded: without it the home page could only
   * ever show an unexplained empty mall. The plan is idempotent, so a rerun is
   * safe and a partially seeded environment is completed rather than duplicated.
   */
  const startSeed = useCallback(async (profile?: MallHomeSeedProfile) => {
    setSeedPhase("running");
    setSeedMessage(undefined);
    const outcome = await runMallHomeSeed(profile ? { profile } : {});
    if (outcome.state === "succeeded") {
      setSeedPhase("succeeded");
      await Promise.all([loadHomeSnapshot(), reloadCms()]);
      return;
    }
    setSeedPhase("failed");
    setSeedMessage(outcome.message);
  }, [loadHomeSnapshot, reloadCms]);

  useEffect(() => {
    void loadHomeSnapshot();
  }, [loadHomeSnapshot]);

  // Non-production installs provision themselves on first paint; production
  // waits for the explicit action so a live storefront never gains demo rows
  // without an operator decision.
  useEffect(() => {
    if (!snapshot?.isEmpty || !claimMallHomeAutomaticSeed()) {
      return;
    }
    void startSeed();
  }, [snapshot, startSeed]);

  useEffect(() => {
    let active = true;
    // 猜你喜欢：基于热销商品随机打散，提供个性化推荐流。
    void searchMallProducts({ pageSize: 20, sort: "sales" })
      .then((result) => {
        if (active) {
          setGuessYouLike(
            [...result.items]
              .map(mapSearchProduct)
              .sort(() => Math.random() - 0.5)
              .slice(0, GUESS_PRODUCT_SIZE),
          );
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
    setFootprint(readMallFootprint().slice(0, FOOTPRINT_SIZE));
    const watchdog = window.setTimeout(() => {
      if (active) {
        setGuessLoading(false);
      }
    }, HOME_LOADING_TIMEOUT_MS);
    return () => {
      active = false;
      window.clearTimeout(watchdog);
    };
  }, []);

  const categories = useMemo<HomeCategoryItem[]>(() => {
    if (!snapshot?.categories.length) {
      return fallbackCategories();
    }
    return snapshot.categories.map((category) => ({
      id: category.id,
      name: category.name,
      to: `/categories/${category.id}`,
    }));
  }, [snapshot]);

  const hotProducts = snapshot?.hotProducts ?? [];
  const newProducts = snapshot?.newProducts ?? [];
  // A storefront with categories but no products is just as much a dead end as
  // a completely empty catalog, so the setup notice also covers that state.
  const hasProducts = hotProducts.length > 0 || newProducts.length > 0;

  // 推荐流优先展示上方楼层尚未出现的商品，再用已出现商品补足 10 个。
  const guessProducts = useMemo(() => {
    const shownIds = new Set<string>();
    for (const state of Object.values(floorProducts)) {
      for (const product of state.products) {
        shownIds.add(product.id);
      }
    }
    for (const product of [...hotProducts, ...newProducts]) {
      shownIds.add(product.id);
    }
    const unseen = guessYouLike.filter((product) => !shownIds.has(product.id));
    const repeated = guessYouLike.filter((product) => shownIds.has(product.id));
    return [...unseen, ...repeated].slice(0, GUESS_PRODUCT_SIZE);
  }, [floorProducts, guessYouLike, hotProducts, newProducts]);

  if (error) {
    return (
      <div className="sdkwork-mall-pc-home">
        <div className="sdkwork-mall-pc-container">
          <div className="sdkwork-mall-pc-home-fallback">
            <h2>首页暂不可用</h2>
            <p>{error}</p>
            <p className="sdkwork-mall-pc-home-fallback-hint">
              刚完成安装时通常是后台服务尚未就绪或接口地址未配置；服务恢复后点“重试”即可。
            </p>
            <Button onClick={() => void loadHomeSnapshot()} type="button" variant="outline">
              重试
            </Button>
            <Link className="sdkwork-mall-pc-home-section-more" to="/categories">
              浏览全部商品分类
            </Link>
            <Link className="sdkwork-mall-pc-home-section-more" to="/admin/default-data">
              默认数据初始化
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sdkwork-mall-pc-home">
      <h1 className="sdkwork-mall-pc-visually-hidden">SDKWork 商城首页</h1>
      <div className="sdkwork-mall-pc-container">
        <HomeHero banners={banners} categories={categories} />

        {snapshot && (snapshot.isEmpty || snapshot.issues.length > 0 || !hasProducts) ? (
          <HomeSetupNotice
            issues={snapshot.issues}
            message={seedMessage}
            onRetry={() => {
              void loadHomeSnapshot();
            }}
            onSeed={() => {
              void startSeed();
            }}
            onSeedDemo={() => {
              void startSeed("demo");
            }}
            phase={seedPhase}
            seedAvailable={isMallHomeSeedAvailable()}
            seedProfile={getMallHomeSeedProfile()}
            signedIn={isMallHomeSeedSignedIn()}
          />
        ) : null}

        <HomeSeckill
          clockParts={seckillView.header?.parts}
          countdownLabel={seckillView.header?.label}
          sessions={seckillView.sessions}
        />

        {floors.length > 0
          ? floors.map((floor) => {
              const state = floorProducts[floor.id] ?? { loading: true, products: [] };
              return (
                <HomeFloor
                  floor={floor}
                  key={floor.id}
                  loading={state.loading}
                  products={state.products}
                />
              );
            })
          : (
            <>
              {hotProducts.length > 0 || loading ? (
                <HomeProductSection
                  loading={loading}
                  moreTo="/search?sort=sales"
                  products={hotProducts}
                  subtitle="大家都在买"
                  title="热卖推荐"
                />
              ) : null}
              {newProducts.length > 0 || loading ? (
                <HomeProductSection
                  columns="four"
                  loading={loading}
                  moreTo="/search?q=new"
                  products={newProducts}
                  subtitle="新品抢先看"
                  title="新品首发"
                />
              ) : null}
            </>
          )}

        <HomeShops shops={snapshot?.featuredShops ?? []} />
        <HomeRecent items={footprint} />
        <HomeGuess loading={guessLoading} products={guessProducts} />
      </div>
    </div>
  );
}
