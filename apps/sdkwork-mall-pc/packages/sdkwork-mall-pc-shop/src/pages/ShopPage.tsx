import { formatMoney } from "@sdkwork/utils/money";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Headphones, Heart, Store, Truck } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  LoadingBlock,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Progress,
  Separator,
  StatusNotice,
} from "@sdkwork/ui-pc-react";
import { isMallShopFavorite, toggleMallShopFavorite } from "@sdkwork/mall-pc-commerce/favorites-service";
import { searchMallProducts, type MallSearchProduct } from "@sdkwork/mall-pc-search/search-service";
import { extractShopCategories, retrieveMallShop, type MallShopDetail } from "../shop-service";

const SHOP_PAGE_SIZE = 24;

const SHOP_SORT_OPTIONS = [
  { label: "综合", value: "" },
  { label: "销量", value: "sales" },
  { label: "价格升序", value: "price-asc" },
  { label: "价格降序", value: "price-desc" },
  { label: "好评", value: "rating" },
  { label: "上新", value: "created_at" },
] as const;

function formatCny(value: number | null): string {
  return value == null ? "询价" : (formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "询价");
}

function formatRating(rating: number | null | undefined): string {
  if (rating == null) return "暂无";
  return rating.toFixed(1);
}

function ShopRatingPanel({ shop }: { shop: MallShopDetail }) {
  if (!shop.rating) return null;
  const { overall, descriptionMatch, logistics, service } = shop.rating;
  const items = [
    { label: "描述相符", value: descriptionMatch },
    { label: "物流服务", value: logistics },
    { label: "服务态度", value: service },
  ];
  const hasAny = items.some((item) => item.value != null);
  if (!hasAny && overall == null) return null;

  return (
    <div className="sdkwork-mall-pc-shop-rating-panel">
      {overall != null ? (
        <div className="sdkwork-mall-pc-shop-rating-overall">
          <strong>{formatRating(overall)}</strong>
          <span>综合评分</span>
        </div>
      ) : null}
      <div className="sdkwork-mall-pc-shop-rating-details">
        {items.map((item) =>
          item.value != null ? (
            <div key={item.label} className="sdkwork-mall-pc-shop-rating-item">
              <span className="sdkwork-mall-pc-shop-rating-label">{item.label}</span>
              <Progress value={item.value * 20} />
              <span className="sdkwork-mall-pc-shop-rating-value">{formatRating(item.value)}</span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function SdkworkMallShopPage() {
  const { shopId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const selectedCategory = params.get("category") ?? "";

  const [shop, setShop] = useState<MallShopDetail | null>(null);
  const [products, setProducts] = useState<MallSearchProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(() => isMallShopFavorite(shopId));

  useEffect(() => {
    setFollowing(isMallShopFavorite(shopId));
  }, [shopId]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [shopDetail, productResult] = await Promise.all([
          retrieveMallShop(shopId),
          searchMallProducts({
            page,
            pageSize: SHOP_PAGE_SIZE,
            shopId,
            sort: sort || undefined,
          }),
        ]);
        if (active) {
          setShop(shopDetail);
          setProducts(productResult.items);
          setTotal(productResult.total);
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
  }, [shopId, sort, page]);

  // 从当前页商品中提取店铺分类（基于 brand 的品牌聚合）
  const shopCategories = useMemo(() => extractShopCategories(products), [products]);

  // 按分类（品牌）对当前页做高亮过滤
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((product) => product.brand === selectedCategory);
  }, [products, selectedCategory]);

  // 分页使用服务端返回的 total
  const totalPages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));

  // 店铺推荐（取前4个商品作为推荐）
  const recommendedProducts = useMemo(() => products.slice(0, 4), [products]);

  // Hook order invariant: every hook runs before the loading/empty early
  // returns below, or the hook count changes across renders and React tears
  // the component down (rules of hooks).
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, page - half);
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== "page") {
      next.delete("page");
    }
    setParams(next);
  }

  if (loading) {
    return <LoadingBlock label="加载店铺..." />;
  }

  if (!shop) {
    return <EmptyState description="店铺可能已下线或迁移" title="未找到店铺" />;
  }

  return (
    <div className="sdkwork-mall-pc-shop-page">
      {/* 店铺头图 */}
      <div className="sdkwork-mall-pc-shop-banner">
        {shop.bannerUrl ? (
          <img alt={shop.name} src={shop.bannerUrl} />
        ) : (
          <div className="sdkwork-mall-pc-shop-banner-placeholder" />
        )}
      </div>

      <header className="sdkwork-mall-pc-shop-header">
        <div className="sdkwork-mall-pc-shop-header-main">
          <div className="sdkwork-mall-pc-shop-logo-row">
            {shop.logoUrl ? (
              <img alt={shop.name} className="sdkwork-mall-pc-shop-logo" src={shop.logoUrl} />
            ) : (
              <div className="sdkwork-mall-pc-shop-logo-placeholder">
                <Store />
              </div>
            )}
            <div className="sdkwork-mall-pc-shop-title-row">
              <h1>{shop.name}</h1>
              <div className="sdkwork-mall-pc-shop-meta-row">
                {shop.operationStatus ? (
                  <Badge variant={shop.operationStatus === "active" || shop.operationStatus === "operating" ? "success" : "secondary"}>
                    {shop.operationStatus === "active" || shop.operationStatus === "operating" ? "营业中" : shop.operationStatus}
                  </Badge>
                ) : null}
                {shop.followerCount != null ? (
                  <span className="sdkwork-mall-pc-shop-meta-text">{shop.followerCount} 人关注</span>
                ) : null}
                {shop.productCount != null ? (
                  <span className="sdkwork-mall-pc-shop-meta-text">{shop.productCount} 件商品</span>
                ) : null}
                {shop.location ? (
                  <span className="sdkwork-mall-pc-shop-meta-text">{shop.location}</span>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            onClick={() => {
              const next = toggleMallShopFavorite({ id: shopId, name: shop.name });
              setFollowing(next);
            }}
            type="button"
            variant={following ? "outline" : "primary"}
          >
            <Heart className="sdkwork-mall-pc-shop-follow-icon" />
            {following ? "已关注" : "关注店铺"}
          </Button>
        </div>

        {/* 店铺评分 */}
        <ShopRatingPanel shop={shop} />

        {/* 店铺公告 */}
        {shop.announcement || shop.description ? (
          <p className="sdkwork-mall-pc-shop-announcement">
            店铺公告：{shop.announcement ?? shop.description}
          </p>
        ) : null}

        {/* 快捷入口 */}
        <nav className="sdkwork-mall-pc-quick-links">
          <Link to="/activity">
            <Badge variant="outline">店铺活动</Badge>
          </Link>
          <Link to="/help">
            <Headphones className="sdkwork-mall-pc-quick-link-icon" />
            联系客服
          </Link>
          <Link to={`/search?shopId=${encodeURIComponent(shopId)}`}>
            <Truck className="sdkwork-mall-pc-quick-link-icon" />
            店内搜索
          </Link>
        </nav>
      </header>

      <Separator />

      {/* 店铺推荐 */}
      {recommendedProducts.length > 0 ? (
        <section className="sdkwork-mall-pc-shop-section">
          <h2>店铺推荐</h2>
          <div className="sdkwork-mall-pc-product-grid">
            {recommendedProducts.map((product) => (
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
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Separator />

      {/* 全部商品 */}
      <section className="sdkwork-mall-pc-shop-section">
        <div className="sdkwork-mall-pc-shop-section-header">
          <h2>全部商品</h2>
          <span className="sdkwork-mall-pc-shop-product-count">共 {total} 件</span>
        </div>

        {/* 排序栏 */}
        <div className="sdkwork-mall-pc-shop-sort-row">
          {SHOP_SORT_OPTIONS.map((option) => (
            <button
              key={option.value || "default"}
              className={sort === option.value ? "sdkwork-mall-pc-sort-active" : ""}
              onClick={() => updateParam("sort", option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 店铺分类 */}
        {shopCategories.length > 0 ? (
          <div className="sdkwork-mall-pc-shop-category-row">
            <span className="sdkwork-mall-pc-shop-category-label">分类：</span>
            <button
              className={!selectedCategory ? "sdkwork-mall-pc-shop-category-active" : ""}
              onClick={() => updateParam("category", "")}
              type="button"
            >
              全部
            </button>
            {shopCategories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.id ? "sdkwork-mall-pc-shop-category-active" : ""}
                onClick={() => updateParam("category", category.id)}
                type="button"
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        ) : null}

        {filteredProducts.length === 0 ? (
          <EmptyState description="店铺正在上新" title="暂无商品" />
        ) : (
          <>
            <div className="sdkwork-mall-pc-product-grid">
              {filteredProducts.map((product) => (
                <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                  <div className="sdkwork-mall-pc-product-image">
                    {product.imageUrl ? <img alt={product.title} src={product.imageUrl} /> : null}
                    {product.selfOperated ? (
                      <Badge variant="danger" className="sdkwork-mall-pc-product-badge-self">自营</Badge>
                    ) : null}
                  </div>
                  <div className="sdkwork-mall-pc-product-body">
                    <h3 className="sdkwork-mall-pc-product-title">{product.title}</h3>
                    {product.brand ? (
                      <span className="sdkwork-mall-pc-product-brand">{product.brand}</span>
                    ) : null}
                    <div className="sdkwork-mall-pc-product-price-row">
                      <strong className="sdkwork-mall-pc-product-price">{formatCny(product.priceCny)}</strong>
                      {product.freeShipping ? <Badge variant="success">包邮</Badge> : null}
                      {product.inStock === false ? <Badge variant="warning">缺货</Badge> : null}
                    </div>
                    <div className="sdkwork-mall-pc-product-stats">
                      {product.rating != null ? (
                        <span className="sdkwork-mall-pc-product-rating">
                          评分 {formatRating(product.rating)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 ? (
              <Pagination className="sdkwork-mall-pc-shop-pagination">
                <PaginationContent>
                  {page > 1 ? (
                    <PaginationItem>
                      <PaginationPrevious onClick={() => updateParam("page", String(page - 1))} />
                    </PaginationItem>
                  ) : null}
                  {pageNumbers.map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === page}
                        onClick={() => updateParam("page", String(pageNum))}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  {page < totalPages ? (
                    <PaginationItem>
                      <PaginationNext onClick={() => updateParam("page", String(page + 1))} />
                    </PaginationItem>
                  ) : null}
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        )}
      </section>

      {products.length === 0 ? (
        <StatusNotice tone="default">
          店铺商品数据为 SDK 阻塞项，当前展示可能为空。
        </StatusNotice>
      ) : null}
    </div>
  );
}
