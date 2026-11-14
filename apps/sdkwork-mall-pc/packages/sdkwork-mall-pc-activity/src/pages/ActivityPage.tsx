import { formatMoney } from "@sdkwork/utils/money";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Flame, Tag, Timer, Zap } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  LoadingBlock,
  Separator,
  StatusNotice,
} from "@sdkwork/ui-pc-react";
import { searchMallProducts, type MallSearchProduct } from "@sdkwork/mall-pc-search/search-service";
import {
  formatCountdown,
  getActivityCountdownTarget,
  getMallActivityTypeLabel,
  listMallActivities,
  retrieveMallActivity,
  type CountdownParts,
  type MallActivityOffer,
  type MallActivityType,
} from "../activity-service";

const ACTIVITY_TYPE_FILTERS: Array<{ value: MallActivityType | "all"; label: string }> = [
  { value: "all", label: "全部活动" },
  { value: "flash-sale", label: "秒杀" },
  { value: "limited-rush", label: "限时抢购" },
  { value: "brand-day", label: "品牌日" },
  { value: "member-day", label: "会员日" },
  { value: "big-promo", label: "大促专题" },
  { value: "new-launch", label: "新品首发" },
];

function activityTypeBadgeVariant(type: MallActivityType): "default" | "secondary" | "success" | "warning" | "danger" | "outline" {
  switch (type) {
    case "flash-sale":
      return "danger";
    case "limited-rush":
      return "warning";
    case "brand-day":
      return "default";
    case "member-day":
      return "success";
    case "big-promo":
      return "danger";
    case "new-launch":
      return "secondary";
    default:
      return "outline";
  }
}

function formatCny(value: number | null): string {
  return value == null ? "询价" : (formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "询价");
}

/** 倒计时组件 */
function useCountdown(target: Date | null): CountdownParts | null {
  const [parts, setParts] = useState<CountdownParts | null>(() =>
    target ? formatCountdown(target) : null,
  );

  useEffect(() => {
    if (!target) {
      setParts(null);
      return;
    }
    setParts(formatCountdown(target));
    const timer = setInterval(() => {
      setParts(formatCountdown(target));
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return parts;
}

function CountdownDisplay({ target, phase }: { target: Date; phase: "upcoming" | "active" | "ended" }) {
  const parts = useCountdown(target);
  if (!parts) return null;

  if (phase === "ended") {
    return (
      <StatusNotice tone="default">
        该活动已结束
      </StatusNotice>
    );
  }

  const label = phase === "upcoming" ? "距开始" : "距结束";
  return (
    <div className="sdkwork-mall-pc-activity-countdown">
      <Timer className="sdkwork-mall-pc-countdown-icon" />
      <span className="sdkwork-mall-pc-countdown-label">{label}</span>
      <div className="sdkwork-mall-pc-countdown-parts">
        {parts.days > 0 ? (
          <span className="sdkwork-mall-pc-countdown-unit">
            <strong>{parts.days}</strong>天
          </span>
        ) : null}
        <span className="sdkwork-mall-pc-countdown-unit">
          <strong>{String(parts.hours).padStart(2, "0")}</strong>时
        </span>
        <span className="sdkwork-mall-pc-countdown-unit">
          <strong>{String(parts.minutes).padStart(2, "0")}</strong>分
        </span>
        <span className="sdkwork-mall-pc-countdown-unit">
          <strong>{String(parts.seconds).padStart(2, "0")}</strong>秒
        </span>
      </div>
    </div>
  );
}

export function SdkworkMallActivityListPage() {
  const [items, setItems] = useState<MallActivityOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [typeFilter, setTypeFilter] = useState<MallActivityType | "all">("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    listMallActivities()
      .then((rows) => {
        if (active) {
          setItems(rows);
        }
      })
      .catch((cause: unknown) => {
        // An unreachable campaign service must not read as "no campaigns".
        if (active) {
          setItems([]);
          setLoadError(cause instanceof Error && cause.message ? cause.message : "活动加载失败");
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
  }, [reloadToken]);

  const filteredItems = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => item.activityType === typeFilter);
  }, [items, typeFilter]);

  if (loading) {
    return <LoadingBlock label="加载活动会场..." />;
  }

  if (loadError) {
    return (
      <EmptyState
        actions={(
          <Button onClick={() => setReloadToken((token) => token + 1)} type="button" variant="outline">
            重试
          </Button>
        )}
        description={loadError}
        title="活动加载失败"
      />
    );
  }

  return (
    <div className="sdkwork-mall-pc-activity-page">
      <header className="sdkwork-mall-pc-activity-header">
        <div className="sdkwork-mall-pc-activity-header-title">
          <Flame aria-hidden="true" size={28} />
          <div>
            <h1>活动会场</h1>
            <p>限时秒杀、品牌日、会员日与平台大促</p>
          </div>
        </div>
      </header>

      {/* 活动类型筛选 */}
      <div className="sdkwork-mall-pc-activity-type-filters">
        {ACTIVITY_TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={typeFilter === filter.value ? "sdkwork-mall-pc-type-filter-active" : ""}
            onClick={() => setTypeFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        typeFilter === "all" ? (
          <EmptyState
            actions={<Link to="/admin/default-data">初始化默认数据</Link>}
            description="新活动上线后将在此展示；若刚完成安装，可先初始化默认数据集。"
            title="暂无活动"
          />
        ) : (
          <EmptyState description="新活动上线后将在此展示" title="暂无活动" />
        )
      ) : (
        <div className="sdkwork-mall-pc-activity-grid">
          {filteredItems.map((item) => {
            const countdown = getActivityCountdownTarget(item);
            return (
              <Link className="sdkwork-mall-pc-activity-card" key={item.id} to={`/activity/${item.id}`}>
                {item.bannerUrl ? (
                  <div className="sdkwork-mall-pc-activity-banner">
                    <img alt={item.title} src={item.bannerUrl} />
                  </div>
                ) : null}
                <div className="sdkwork-mall-pc-activity-card-body">
                  <div className="sdkwork-mall-pc-activity-card-header">
                    <Badge variant={activityTypeBadgeVariant(item.activityType)}>
                      {getMallActivityTypeLabel(item.activityType)}
                    </Badge>
                    {item.discountText ? (
                      <Badge variant="danger">{item.discountText}</Badge>
                    ) : null}
                  </div>
                  <h3>{item.title}</h3>
                  {item.highlight ? (
                    <p className="sdkwork-mall-pc-activity-highlight">{item.highlight}</p>
                  ) : null}
                  {item.description ? (
                    <p className="sdkwork-mall-pc-activity-desc">{item.description}</p>
                  ) : null}
                  {item.tags && item.tags.length > 0 ? (
                    <div className="sdkwork-mall-pc-activity-tags">
                      <Tag className="sdkwork-mall-pc-activity-tag-icon" />
                      {item.tags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {countdown ? (
                    <div className="sdkwork-mall-pc-activity-card-countdown">
                      <Clock className="sdkwork-mall-pc-activity-clock-icon" />
                      {countdown.phase === "upcoming" ? "即将开始" : countdown.phase === "active" ? "进行中" : "已结束"}
                      {item.startAt ? <span>{new Date(item.startAt).toLocaleDateString()}</span> : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SdkworkMallActivityDetailPage() {
  const { eventId = "" } = useParams();
  const [activity, setActivity] = useState<MallActivityOffer | null>(null);
  const [products, setProducts] = useState<MallSearchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    async function load() {
      try {
        const [detail, productResult] = await Promise.all([
          retrieveMallActivity(eventId),
          searchMallProducts({ pageSize: 12, query: eventId ? undefined : "sale" }),
        ]);
        if (active) {
          setActivity(detail);
          setProducts(productResult.items);
        }
      } catch (cause: unknown) {
        // Leave the skeleton and report the failure instead of spinning forever
        // or claiming the campaign ended.
        if (active) {
          setActivity(null);
          setLoadError(cause instanceof Error && cause.message ? cause.message : "活动详情加载失败");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId, reloadToken]);

  if (loading) {
    return <LoadingBlock label="加载活动详情..." />;
  }

  if (loadError) {
    return (
      <EmptyState
        actions={(
          <Button onClick={() => setReloadToken((token) => token + 1)} type="button" variant="outline">
            重试
          </Button>
        )}
        description={loadError}
        title="活动详情加载失败"
      />
    );
  }

  if (!activity) {
    return <EmptyState description="活动可能已结束" title="未找到活动" />;
  }

  const countdown = getActivityCountdownTarget(activity);

  return (
    <div className="sdkwork-mall-pc-activity-detail">
      {/* 活动 Banner */}
      {activity.bannerUrl ? (
        <div className="sdkwork-mall-pc-activity-detail-banner">
          <img alt={activity.title} src={activity.bannerUrl} />
        </div>
      ) : null}

      <header className="sdkwork-mall-pc-activity-detail-header">
        <div className="sdkwork-mall-pc-activity-detail-title-row">
          <Badge variant={activityTypeBadgeVariant(activity.activityType)}>
            {getMallActivityTypeLabel(activity.activityType)}
          </Badge>
          {activity.discountText ? (
            <Badge variant="danger">{activity.discountText}</Badge>
          ) : null}
        </div>
        <h1>{activity.title}</h1>
        {activity.highlight ? (
          <p className="sdkwork-mall-pc-activity-highlight">{activity.highlight}</p>
        ) : null}
        {activity.description ? <p className="sdkwork-mall-pc-activity-desc">{activity.description}</p> : null}

        {/* 倒计时 */}
        {countdown ? (
          <CountdownDisplay target={countdown.target} phase={countdown.phase} />
        ) : null}

        {/* 活动时间 */}
        <div className="sdkwork-mall-pc-activity-time-info">
          {activity.startAt ? (
            <span>
              <Clock className="sdkwork-mall-pc-activity-clock-icon" />
              开始：{new Date(activity.startAt).toLocaleString()}
            </span>
          ) : null}
          {activity.endAt ? (
            <span>
              <Clock className="sdkwork-mall-pc-activity-clock-icon" />
              结束：{new Date(activity.endAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {/* 标签系统 */}
        {activity.tags && activity.tags.length > 0 ? (
          <div className="sdkwork-mall-pc-activity-tags">
            <Tag className="sdkwork-mall-pc-activity-tag-icon" />
            {activity.tags.map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        ) : null}
      </header>

      <Separator />

      {/* 活动规则 */}
      {activity.rules && activity.rules.length > 0 ? (
        <section className="sdkwork-mall-pc-activity-rules">
          <h2><Zap className="sdkwork-mall-pc-activity-rules-icon" /> 活动规则</h2>
          <ol>
            {activity.rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <Separator />

      {/* 活动商品 */}
      <section className="sdkwork-mall-pc-activity-products">
        <h2>活动商品</h2>
        {products.length === 0 ? (
          <EmptyState description="活动商品正在准备中" title="暂无活动商品" />
        ) : (
          <div className="sdkwork-mall-pc-product-grid">
            {products.map((product) => (
              <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdkwork-mall-pc-product-image">
                  {product.imageUrl ? <img alt={product.title} src={product.imageUrl} /> : null}
                  {product.selfOperated ? (
                    <Badge variant="danger" className="sdkwork-mall-pc-product-badge-self">自营</Badge>
                  ) : null}
                </div>
                <div className="sdkwork-mall-pc-product-body">
                  <h3 className="sdkwork-mall-pc-product-title">{product.title}</h3>
                  <div className="sdkwork-mall-pc-product-price-row">
                    <strong className="sdkwork-mall-pc-product-price">{formatCny(product.priceCny)}</strong>
                    {product.freeShipping ? <Badge variant="success">包邮</Badge> : null}
                  </div>
                  {product.shopName ? (
                    <span className="sdkwork-mall-pc-product-shop">{product.shopName}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 返回活动列表 */}
      <div className="sdkwork-mall-pc-activity-back">
        <Link to="/activity">
          <Button variant="outline" size="default">查看更多活动</Button>
        </Link>
      </div>
    </div>
  );
}
