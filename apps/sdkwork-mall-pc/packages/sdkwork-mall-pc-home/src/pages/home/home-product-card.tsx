import { Link } from "react-router-dom";
import {
  Apple,
  Baby,
  BookOpen,
  Car,
  Dumbbell,
  Headphones,
  Laptop,
  Refrigerator,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Tag,
  Tv,
  WashingMachine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MallHomeProductCard } from "../../home-service";

const HOME_PRICE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const HOME_SALES_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

interface CatalogVisual {
  readonly icon: LucideIcon;
  readonly label: string;
}

const CATALOG_VISUALS: ReadonlyArray<{ readonly pattern: RegExp; readonly visual: CatalogVisual }> = [
  { pattern: /手机|通讯|5G|影像|iPhone|华为|小米/i, visual: { icon: Smartphone, label: "数码" } },
  { pattern: /耳机|音箱|降噪|音频/i, visual: { icon: Headphones, label: "音频" } },
  { pattern: /笔记本|电脑|显示器|键盘|平板|办公|Pad/i, visual: { icon: Laptop, label: "电脑" } },
  { pattern: /家居|家装|家具|客厅|卧室/i, visual: { icon: Sofa, label: "家居" } },
  { pattern: /冰箱|冷柜/i, visual: { icon: Refrigerator, label: "家电" } },
  { pattern: /洗衣|干衣/i, visual: { icon: WashingMachine, label: "家电" } },
  { pattern: /家用电器|电视|空调|家电|厨电|烤箱|蒸烤/i, visual: { icon: Tv, label: "家电" } },
  { pattern: /衣|衬衫|毛衣|外套|服饰|鞋|跑鞋|包|穿搭/i, visual: { icon: Shirt, label: "服饰" } },
  { pattern: /护肤|精华|面霜|口红|美妆|洗发|洁面|面膜/i, visual: { icon: Sparkles, label: "美妆" } },
  { pattern: /米|坚果|水果|生鲜|食品|橙|零食|粮油/i, visual: { icon: Apple, label: "生鲜" } },
  { pattern: /跑步|哑铃|帐篷|健身|户外|运动|瑜伽/i, visual: { icon: Dumbbell, label: "运动" } },
  { pattern: /奶粉|玩具|积木|母婴|辅食|婴儿/i, visual: { icon: Baby, label: "母婴" } },
  { pattern: /汽车|车品|车载|轮胎/i, visual: { icon: Car, label: "车品" } },
  { pattern: /图书|音乐|专辑|文娱|阅读|数字/i, visual: { icon: BookOpen, label: "文娱" } },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

/** Deterministic placeholder tone so a product keeps the same artwork slot per id. */
export function resolveHomeProductTone(id: string): number {
  return hashString(id) % 6;
}

export function resolveHomeCatalogVisual(text: string | undefined): CatalogVisual {
  if (text) {
    for (const entry of CATALOG_VISUALS) {
      if (entry.pattern.test(text)) {
        return entry.visual;
      }
    }
  }
  return { icon: Tag, label: "精选" };
}

export function formatHomePrice(value: number | null): string {
  return value == null ? "暂无报价" : `¥${HOME_PRICE_FORMATTER.format(value)}`;
}

export function formatHomeSales(count: number | undefined): string | null {
  if (count == null || count <= 0) {
    return null;
  }
  if (count >= 10000) {
    return `已售 ${HOME_SALES_FORMATTER.format(count / 10000)}万`;
  }
  return `已售 ${count}`;
}

export function HomePrice({
  value,
  listValue,
}: {
  readonly listValue?: number | null;
  readonly value: number | null;
}) {
  if (value == null) {
    return <span className="sdkwork-mall-pc-product-price is-quote">询价</span>;
  }
  const formatted = HOME_PRICE_FORMATTER.format(value);
  const [amount, cents] = formatted.split(".");
  return (
    <span className="sdkwork-mall-pc-product-price">
      <span className="price-symbol">¥</span>
      {amount}
      {cents ? <span className="price-cents">.{cents}</span> : null}
      {listValue != null && listValue > value ? (
        <span className="sdkwork-mall-pc-product-price-was">
          {`¥${HOME_PRICE_FORMATTER.format(listValue)}`}
        </span>
      ) : null}
    </span>
  );
}

export function HomeProductArtwork({
  product,
  tone,
}: {
  readonly product: MallHomeProductCard;
  readonly tone: number;
}) {
  const visual = resolveHomeCatalogVisual(`${product.title} ${product.subtitle ?? ""} ${product.brand ?? ""}`);
  const Icon = visual.icon;
  const initial = (product.brand || product.title).trim().slice(0, 1);

  return (
    <span aria-hidden="true" className={`sdkwork-mall-pc-product-art tone-${tone}`}>
      <span className="sdkwork-mall-pc-product-art-initial">{initial}</span>
      <span className="sdkwork-mall-pc-product-art-inner">
        <span className="sdkwork-mall-pc-product-art-icon">
          <Icon size={26} strokeWidth={1.6} />
        </span>
        <span className="sdkwork-mall-pc-product-art-label">{visual.label}</span>
      </span>
    </span>
  );
}

function HomeProductBadges({ product }: { readonly product: MallHomeProductCard }) {
  const badges: Array<{ label: string; variant: string }> = [];
  if (product.selfOperated) {
    badges.push({ label: "自营", variant: "is-brand" });
  }
  if (product.inStock === false) {
    badges.push({ label: "缺货", variant: "" });
  } else if (product.freeShipping) {
    badges.push({ label: "包邮", variant: "" });
  }
  if (badges.length === 0) {
    return null;
  }
  return (
    <span className="sdkwork-mall-pc-product-badges">
      {badges.map((badge) => (
        <span
          className={
            badge.variant
              ? `sdkwork-mall-pc-product-badge ${badge.variant}`
              : "sdkwork-mall-pc-product-badge"
          }
          key={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}

export function HomeProductCard({
  product,
  tone,
}: {
  readonly product: MallHomeProductCard;
  readonly tone?: number;
}) {
  const sales = formatHomeSales(product.salesCount);
  const tags = [
    product.brand ? { label: product.brand, variant: "is-neutral" } : null,
    product.rating != null && product.rating >= 4.8
      ? { label: "高分好评", variant: "is-gold" }
      : null,
    product.inStock === false ? { label: "缺货", variant: "is-neutral" } : null,
  ].filter((tag): tag is { label: string; variant: string } => Boolean(tag));
  const visibleTags = tags.filter(
    (tag, index) => tags.findIndex((candidate) => candidate.label === tag.label) === index,
  ).slice(0, 2);

  return (
    <Link className="sdkwork-mall-pc-product-card" to={`/product/${product.id}`}>
      <div className="sdkwork-mall-pc-product-image">
        {product.imageUrl ? (
          <img
            alt={product.title}
            decoding="async"
            loading="lazy"
            src={product.imageUrl}
          />
        ) : (
          <HomeProductArtwork product={product} tone={tone ?? resolveHomeProductTone(product.id)} />
        )}
        <HomeProductBadges product={product} />
      </div>
      <div className="sdkwork-mall-pc-product-body">
        <h3>{product.title}</h3>
        {product.subtitle ? <p className="sdkwork-mall-pc-product-subtitle">{product.subtitle}</p> : null}
        {visibleTags.length > 0 ? (
          <div className="sdkwork-mall-pc-product-tags">
            {visibleTags.map((tag, index) => (
              <span
                className={
                  tag.variant
                    ? `sdkwork-mall-pc-product-tag ${tag.variant}`
                    : "sdkwork-mall-pc-product-tag"
                }
                key={`${tag.label}-${index}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="sdkwork-mall-pc-product-price-row">
          <HomePrice listValue={product.listPriceCny} value={product.priceCny} />
        </div>
        <div className="sdkwork-mall-pc-product-foot">
          <span>{product.shopName ?? "SDKWork 商城"}</span>
          {sales ? <span className="is-num">{sales}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function HomeProductSkeletons({ count = 5 }: { readonly count?: number }) {
  return (
    <div aria-hidden="true" className="sdkwork-mall-pc-home-skeleton-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="sdkwork-mall-pc-home-skeleton" key={index}>
          <div className="sdkwork-mall-pc-home-skeleton-media" />
          <div className="sdkwork-mall-pc-home-skeleton-line" />
          <div className="sdkwork-mall-pc-home-skeleton-line is-short" />
        </div>
      ))}
    </div>
  );
}

export function HomeEmpty({
  actionLabel,
  actionTo,
  message,
}: {
  readonly actionLabel?: string;
  readonly actionTo?: string;
  readonly message: string;
}) {
  return (
    <div className="sdkwork-mall-pc-home-empty">
      <Tag aria-hidden="true" size={26} strokeWidth={1.5} />
      <span>{message}</span>
      {actionTo && actionLabel ? (
        <Link className="sdkwork-mall-pc-home-empty-action" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
