import { formatMoney } from "@sdkwork/utils/money";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Flame,
  Heart,
  MessageCircleQuestion,
  Package,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Input,
  KeyValueTable,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type KeyValueTableRowData,
} from "@sdkwork/ui-pc-react";
import { isMallFavorite, toggleMallFavorite } from "@sdkwork/mall-pc-commerce/favorites-service";
import { buildMallCategoryTree, listMallCategories, searchMallProducts, type MallCategoryTreeNode, type MallSearchProduct } from "@sdkwork/mall-pc-search/search-service";
import { recordMallFootprint } from "@sdkwork/mall-pc-reviews/footprint-service";
import {
  listEnabledMallCmsBanners,
  type MallCmsBanner,
} from "@sdkwork/mall-pc-cms/cms-config";
import { loadMallCmsConfigRemote } from "@sdkwork/mall-pc-cms/cms-service";
import {
  addMallProductToCart,
  loadMallProductCoupons,
  loadMallProductDetail,
  retrieveMallCategory,
  type MallProductDetail,
  type MallShopRatingSummary,
} from "../catalog-service";

const DEFAULT_SERVICE_COMMITMENTS = [
  { title: "7天无理由退货", description: "支持7天内无理由退换货" },
  { title: "正品保障", description: "平台正品保障，假一赔十" },
  { title: "闪电发货", description: "下单后24小时内发货" },
  { title: "全国包邮", description: "全国大部分地区包邮配送" },
];

const DEFAULT_FAQ = [
  {
    question: "商品支持哪些支付方式？",
    answer: "支持在线支付、货到付款（部分区域）、微信/支付宝等多种支付方式。",
  },
  {
    question: "如何申请退换货？",
    answer: "签收后7天内可在「我的订单」中申请售后，选择退款/退货/换货/维修等类型。",
  },
  {
    question: "发票如何开具？",
    answer: "下单时可在结算页选择电子发票或纸质发票，发票内容为商品明细。",
  },
];

function formatCny(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "询价";
  return formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "询价";
}

function formatRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "暂无";
  return value.toFixed(1);
}

function resolveStockStatus(stock: number | undefined): {
  label: string;
  tone: "default" | "success" | "warning" | "danger";
} {
  if (stock == null) return { label: "库存信息待确认", tone: "default" };
  if (stock <= 0) return { label: "暂时缺货", tone: "danger" };
  if (stock < 10) return { label: `仅剩 ${stock} 件`, tone: "warning" };
  return { label: "现货充足", tone: "success" };
}

function ShopRatingPanel({ rating }: { rating: MallShopRatingSummary | null | undefined }) {
  if (!rating) {
    return (
      <div className="sdkwork-mall-pc-pdp-shop-rating-empty">
        <span>店铺评分暂未公开</span>
      </div>
    );
  }
  const items: Array<{ label: string; value: number | null; max: number }> = [
    { label: "综合评分", value: rating.overall, max: 5 },
    { label: "描述相符", value: rating.descriptionMatch, max: 5 },
    { label: "物流服务", value: rating.logistics, max: 5 },
    { label: "服务态度", value: rating.service, max: 5 },
  ];
  return (
    <div className="sdkwork-mall-pc-pdp-shop-rating">
      {items.map((item) => {
        const percent = item.value == null ? 0 : Math.min(100, (item.value / item.max) * 100);
        return (
          <div className="sdkwork-mall-pc-pdp-rating-row" key={item.label}>
            <span className="sdkwork-mall-pc-pdp-rating-label">{item.label}</span>
            <Progress className="sdkwork-mall-pc-pdp-rating-bar" value={percent} />
            <span className="sdkwork-mall-pc-pdp-rating-value">{formatRating(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORY_SORT_OPTIONS = [
  { label: "综合", value: "" },
  { label: "销量", value: "sales" },
  { label: "价格升序", value: "price-asc" },
  { label: "价格降序", value: "price-desc" },
  { label: "好评", value: "rating" },
  { label: "上新", value: "created_at" },
] as const;

const CATEGORY_PAGE_SIZE = 20;

function formatCategoryCny(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "询价";
  return `¥${value.toFixed(2)}`;
}

function formatCategorySales(count?: number): string | null {
  if (count == null) return null;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

function formatCategoryRating(rating?: number): string | null {
  if (rating == null) return null;
  return rating.toFixed(1);
}

export function SdkworkMallCategoryPage() {
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [items, setItems] = useState<MallSearchProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryTree, setCategoryTree] = useState<MallCategoryTreeNode[]>([]);
  const [categoryDetail, setCategoryDetail] = useState<{ description?: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<MallCmsBanner[]>(() => listEnabledMallCmsBanners());
  const [hotProducts, setHotProducts] = useState<MallSearchProduct[]>([]);
  const [newProducts, setNewProducts] = useState<MallSearchProduct[]>([]);

  // 客户端筛选维度
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [filterFreeShipping, setFilterFreeShipping] = useState(false);
  const [filterSelfOperated, setFilterSelfOperated] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);

  useEffect(() => {
    let active = true;
    loadMallCmsConfigRemote()
      .then((config) => {
        if (active) {
          setBanners(listEnabledMallCmsBanners(config));
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
    setLoading(true);
    setCategoryDetail(null);
    async function load() {
      const categoryList = await listMallCategories().catch(() => [] as Array<{ id: string; name: string }>);
      let detail: { description?: string; name: string } | null = null;
      if (categoryId) {
        try {
          const categoryRecord = await retrieveMallCategory(categoryId);
          if (categoryRecord) {
            detail = {
              name: categoryRecord.name,
            };
          }
        } catch {
          // Fall back to list lookup when retrieve is unavailable.
        }
      }
      const matchedCategory = categoryId
        ? categoryList.find((category) => category.id === categoryId)
        : keyword
          ? categoryList.find((category) => category.name.includes(keyword))
          : undefined;
      if (!detail && matchedCategory) {
        detail = { name: matchedCategory.name };
      }
      const resolvedCategoryId = categoryId ?? matchedCategory?.id;
      const productResult = await searchMallProducts({
        categoryId: resolvedCategoryId,
        pageSize: CATEGORY_PAGE_SIZE,
        query: !resolvedCategoryId && keyword ? keyword : undefined,
        sort: sort || undefined,
        page,
      });
      if (active) {
        setCategoryTree(buildMallCategoryTree(categoryList));
        setCategoryDetail(detail);
        setItems(productResult.items);
        setTotal(productResult.total);
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [categoryId, keyword, sort, page]);

  // 侧边栏热销榜与新品榜
  useEffect(() => {
    let active = true;
    const hotPromise = searchMallProducts({
      categoryId: categoryId ?? undefined,
      pageSize: 6,
      sort: "sales",
    });
    const newPromise = searchMallProducts({
      categoryId: categoryId ?? undefined,
      pageSize: 6,
      sort: "created_at",
    });
    Promise.all([hotPromise, newPromise])
      .then(([hotResult, newResult]) => {
        if (active) {
          setHotProducts(hotResult.items);
          setNewProducts(newResult.items);
        }
      })
      .catch(() => {
        if (active) {
          setHotProducts([]);
          setNewProducts([]);
        }
      });
    return () => {
      active = false;
    };
  }, [categoryId]);

  // 从搜索结果中提取品牌选项
  const brandOptions = useMemo(() => {
    const brands = items
      .map((item) => item.brand)
      .filter((brand): brand is string => Boolean(brand));
    const counts = new Map<string, number>();
    for (const brand of brands) {
      counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([brand, count]) => ({ brand, count }));
  }, [items]);

  // 客户端筛选：品牌、包邮、自营、现货、价格区间
  const filteredItems = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    return items.filter((product) => {
      if (product.priceCny != null) {
        if (min != null && Number.isFinite(min) && product.priceCny < min) return false;
        if (max != null && Number.isFinite(max) && product.priceCny > max) return false;
      } else if (min != null || max != null) {
        return false;
      }
      if (selectedBrands.length > 0) {
        if (!product.brand || !selectedBrands.includes(product.brand)) return false;
      }
      if (filterFreeShipping && !product.freeShipping) return false;
      if (filterSelfOperated && !product.selfOperated) return false;
      if (filterInStock && product.inStock === false) return false;
      return true;
    });
  }, [items, minPrice, maxPrice, selectedBrands, filterFreeShipping, filterSelfOperated, filterInStock]);

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    filterFreeShipping ||
    filterSelfOperated ||
    filterInStock ||
    Boolean(minPrice.trim()) ||
    Boolean(maxPrice.trim());

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== "page") {
      next.delete("page");
    }
    setSearchParams(next);
  }

  function clearAllFilters() {
    setSelectedBrands([]);
    setFilterFreeShipping(false);
    setFilterSelfOperated(false);
    setFilterInStock(false);
    setMinPrice("");
    setMaxPrice("");
  }

  function toggleBrand(brand: string) {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
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

  if (loading) {
    return <LoadingBlock label="加载类目..." />;
  }

  const activeCategory = categoryDetail
    ?? categoryTree.find((category) => category.id === categoryId)
    ?? categoryTree.flatMap((root) => root.children).find((category) => category.id === categoryId)
    ?? (keyword ? categoryTree.find((category) => category.name.includes(keyword)) : undefined);

  const categoryTitle = activeCategory?.name ?? (keyword ? `类目：${keyword}` : categoryId ? "类目商品" : "全部类目");

  return (
    <div className="sdkwork-mall-pc-category-page">
      {/* 面包屑 */}
      <nav className="sdkwork-mall-pc-pdp-breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <Link to="/categories">全部类目</Link>
        {activeCategory ? (
          <>
            <ChevronRight aria-hidden="true" size={14} />
            <span>{activeCategory.name}</span>
          </>
        ) : null}
      </nav>

      {/* 类目横幅 */}
      {banners.length > 0 ? (
        <section className="sdkwork-mall-pc-banner-grid">
          {banners.slice(0, 3).map((banner) => (
            <Link className="sdkwork-mall-pc-banner-card" key={banner.id} to={banner.linkUrl}>
              {banner.imageUrl ? <img alt={banner.title} src={banner.imageUrl} /> : <Sparkles aria-hidden="true" size={24} />}
              <div>
                <h2>{banner.title}</h2>
                {banner.subtitle ? <p>{banner.subtitle}</p> : null}
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {/* 类目标题与描述 */}
      <header className="sdkwork-mall-pc-category-header">
        <h1>{categoryTitle}</h1>
        {activeCategory && "description" in activeCategory && activeCategory.description ? (
          <p>{activeCategory.description}</p>
        ) : null}
        <p className="sdkwork-mall-pc-category-count">
          共 {filteredItems.length} 件商品
          {filteredItems.length !== total ? `（筛选自 ${total} 件）` : ""}
        </p>
      </header>

      {/* 类目导航：一级类目 + 当前一级下的子类目 */}
      {categoryTree.length > 0 ? (
        <section className="sdkwork-mall-pc-floor">
          <div className="sdkwork-mall-pc-chip-row">
            <Link
              className={!categoryId ? "is-active" : ""}
              to="/categories"
            >
              全部类目
            </Link>
            {categoryTree.map((node) => (
              <Link
                className={node.id === categoryId || node.children.some((child) => child.id === categoryId) ? "is-active" : ""}
                key={node.id}
                to={`/categories/${node.id}`}
              >
                {node.name}
              </Link>
            ))}
          </div>
          {(() => {
            const activeRoot = categoryId
              ? categoryTree.find((node) => node.id === categoryId)
                ?? categoryTree.find((node) => node.children.some((child) => child.id === categoryId))
              : undefined;
            if (!activeRoot || activeRoot.children.length === 0) {
              return null;
            }
            return (
              <div className="sdkwork-mall-pc-chip-row sdkwork-mall-pc-subcategory-row">
                {activeRoot.children.map((child) => (
                  <Link
                    className={child.id === categoryId ? "is-active" : ""}
                    key={child.id}
                    to={`/categories/${child.id}`}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            );
          })()}
        </section>
      ) : null}

      <div className="sdkwork-mall-pc-search-layout">
        {/* 左侧筛选区 */}
        <aside className="sdkwork-mall-pc-search-filters">
          <div className="sdkwork-mall-pc-filter-section">
            <h3>价格区间</h3>
            <div className="sdkwork-mall-pc-price-filter">
              <Input
                aria-label="最低价"
                min={0}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="最低"
                type="number"
                value={minPrice}
              />
              <span className="sdkwork-mall-pc-price-separator">-</span>
              <Input
                aria-label="最高价"
                min={0}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="最高"
                type="number"
                value={maxPrice}
              />
            </div>
          </div>

          <div className="sdkwork-mall-pc-filter-section">
            <h3>服务筛选</h3>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterFreeShipping}
                onCheckedChange={(checked) => setFilterFreeShipping(checked === true)}
              />
              <span>包邮</span>
            </label>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterSelfOperated}
                onCheckedChange={(checked) => setFilterSelfOperated(checked === true)}
              />
              <span>自营</span>
            </label>
            <label className="sdkwork-mall-pc-filter-checkbox">
              <Checkbox
                checked={filterInStock}
                onCheckedChange={(checked) => setFilterInStock(checked === true)}
              />
              <span>仅看现货</span>
            </label>
          </div>

          {brandOptions.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3>品牌</h3>
              {brandOptions.map(({ brand, count }) => (
                <label key={brand} className="sdkwork-mall-pc-filter-checkbox">
                  <Checkbox
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                  />
                  <span>{brand}</span>
                  <span className="sdkwork-mall-pc-filter-count">{count}</span>
                </label>
              ))}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} type="button">
              清空筛选
            </Button>
          ) : null}

          <Separator />

          {/* 热销榜 */}
          {hotProducts.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3><Flame aria-hidden="true" size={14} /> 热销榜</h3>
              <ul className="sdkwork-mall-pc-rank-list">
                {hotProducts.map((product, index) => (
                  <li key={product.id}>
                    <Link to={`/product/${product.id}`}>
                      <span className="sdkwork-mall-pc-rank-index">{index + 1}</span>
                      <span className="sdkwork-mall-pc-rank-title">{product.title}</span>
                      <strong className="sdkwork-mall-pc-rank-price">{formatCategoryCny(product.priceCny)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 新品榜 */}
          {newProducts.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3><Sparkles aria-hidden="true" size={14} /> 新品榜</h3>
              <ul className="sdkwork-mall-pc-rank-list">
                {newProducts.map((product, index) => (
                  <li key={product.id}>
                    <Link to={`/product/${product.id}`}>
                      <span className="sdkwork-mall-pc-rank-index">{index + 1}</span>
                      <span className="sdkwork-mall-pc-rank-title">{product.title}</span>
                      <strong className="sdkwork-mall-pc-rank-price">{formatCategoryCny(product.priceCny)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* 右侧主区 */}
        <div className="sdkwork-mall-pc-search-main">
          {/* 排序栏 */}
          <div className="sdkwork-mall-pc-sort-row">
            <TrendingUp className="sdkwork-mall-pc-sort-icon" />
            {CATEGORY_SORT_OPTIONS.map((option) => (
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

          {/* 商品列表 */}
          {filteredItems.length === 0 ? (
            <EmptyState description="该类目下暂无商品，试试调整筛选条件" title="暂无商品" />
          ) : (
            <div className="sdkwork-mall-pc-product-grid">
              {filteredItems.map((product) => (
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
                      <strong className="sdkwork-mall-pc-product-price">{formatCategoryCny(product.priceCny)}</strong>
                      {product.freeShipping ? (
                        <Badge variant="success">包邮</Badge>
                      ) : null}
                      {product.inStock === false ? (
                        <Badge variant="warning">缺货</Badge>
                      ) : null}
                    </div>
                    <div className="sdkwork-mall-pc-product-meta">
                      {product.shopName ? <span className="sdkwork-mall-pc-product-shop">{product.shopName}</span> : null}
                    </div>
                    <div className="sdkwork-mall-pc-product-stats">
                      {product.rating != null ? (
                        <span className="sdkwork-mall-pc-product-rating">
                          评分 {formatCategoryRating(product.rating)}
                        </span>
                      ) : null}
                      {product.salesCount != null ? (
                        <span className="sdkwork-mall-pc-product-sales">
                          已售 {formatCategorySales(product.salesCount)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 ? (
            <Pagination className="sdkwork-mall-pc-pagination">
              <PaginationContent>
                {page > 1 ? (
                  <PaginationItem>
                    <PaginationPrevious onClick={() => updateParam("page", String(page - 1))} />
                  </PaginationItem>
                ) : null}
                {pageNumbers.map((num) => (
                  <PaginationItem key={num}>
                    <PaginationLink
                      isActive={num === page}
                      onClick={() => updateParam("page", String(num))}
                    >
                      {num}
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
        </div>
      </div>
    </div>
  );
}

export function SdkworkMallProductDetailPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MallProductDetail | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [coupons, setCoupons] = useState<Array<{ id: string; title: string }>>([]);
  const [recommendations, setRecommendations] = useState<Awaited<ReturnType<typeof searchMallProducts>>["items"]>([]);
  const [sameShopProducts, setSameShopProducts] = useState<Awaited<ReturnType<typeof searchMallProducts>>["items"]>([]);

  useEffect(() => {
    loadMallProductDetail(productId)
      .then((data) => {
        setDetail(data);
        setSelectedSkuId(data.skus[0]?.id ?? "");
        setFavorited(isMallFavorite(data.id));
        recordMallFootprint({ id: data.id, title: data.title });
        void searchMallProducts({
          categoryId: undefined,
          pageSize: 8,
          query: data.title.split(/\s+/)[0] || undefined,
        }).then((result) => {
          setRecommendations(result.items.filter((item) => item.id !== data.id).slice(0, 6));
        });
        if (data.shopId) {
          void searchMallProducts({
            categoryId: undefined,
            pageSize: 8,
            shopId: data.shopId,
          }).then((result) => {
            setSameShopProducts(result.items.filter((item) => item.id !== data.id).slice(0, 6));
          });
        }
      })
      .finally(() => setLoading(false));
    void loadMallProductCoupons().then(setCoupons);
  }, [productId]);

  useEffect(() => {
    // SKU 切换时联动主图：若 SKU 有图片则切换到对应图片，否则保持第一张。
    if (!detail) return;
    const selectedSku = detail.skus.find((sku) => sku.id === selectedSkuId);
    if (selectedSku?.imageUrl) {
      const idx = detail.images.indexOf(selectedSku.imageUrl);
      setActiveImageIndex(idx >= 0 ? idx : 0);
    }
  }, [selectedSkuId, detail]);

  if (loading) {
    return <LoadingBlock label="加载商品详情..." />;
  }

  if (!detail) {
    return <EmptyState description="商品可能已下架" title="商品不存在" />;
  }

  const selectedSku = detail.skus.find((sku) => sku.id === selectedSkuId) ?? detail.skus[0];
  const displayPrice = selectedSku?.priceCny ?? detail.priceCny;
  const hasDiscount =
    detail.listPriceCny != null &&
    displayPrice != null &&
    detail.listPriceCny > displayPrice;
  const discountPercent =
    hasDiscount && displayPrice != null && detail.listPriceCny != null
      ? Math.round((1 - displayPrice / detail.listPriceCny) * 100)
      : null;
  const stockStatus = resolveStockStatus(selectedSku?.stock);
  const serviceCommitments =
    detail.serviceCommitments.length > 0 ? detail.serviceCommitments : DEFAULT_SERVICE_COMMITMENTS;
  const faqItems = detail.faq.length > 0 ? detail.faq : DEFAULT_FAQ;
  const activeImage = detail.images[activeImageIndex] ?? detail.images[0];

  const specRows: KeyValueTableRowData[] = detail.specifications.map((row) => ({
    id: row.label,
    label: row.label,
    value: row.value,
  }));

  async function handleAddToCart() {
    if (!selectedSku?.id) {
      setMessage("请选择规格");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await addMallProductToCart({
        productId: detail!.id,
        skuId: selectedSku.id,
        quantity,
      });
      setMessage("已加入购物车");
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "加入购物车失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sdkwork-mall-pc-pdp">
      {/* 面包屑 */}
      <nav className="sdkwork-mall-pc-pdp-breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        <ChevronRight aria-hidden="true" size={14} />
        {detail.shopId ? (
          <Link to={`/shop/${detail.shopId}`}>{detail.shopName ?? "店铺"}</Link>
        ) : (
          <span>{detail.shopName ?? "平台自营"}</span>
        )}
        <ChevronRight aria-hidden="true" size={14} />
        <span>{detail.title}</span>
      </nav>

      <div className="sdkwork-mall-pc-pdp-main">
        {/* 商品主信息区 + SKU 选择区 + 购买操作区 */}
        <div className="sdkwork-mall-pc-pdp-gallery">
          <div className="sdkwork-mall-pc-pdp-gallery-main">
            {activeImage ? (
              <img alt={detail.title} src={activeImage} />
            ) : (
              <div className="sdkwork-mall-pc-pdp-gallery-placeholder">
                <Package aria-hidden="true" size={48} />
              </div>
            )}
          </div>
          {detail.images.length > 1 ? (
            <div className="sdkwork-mall-pc-pdp-gallery-thumbs">
              {detail.images.map((image, index) => (
                <button
                  aria-label={`查看第 ${index + 1} 张图片`}
                  className={
                    index === activeImageIndex
                      ? "sdkwork-mall-pc-pdp-gallery-thumb is-active"
                      : "sdkwork-mall-pc-pdp-gallery-thumb"
                  }
                  key={image + index}
                  onClick={() => setActiveImageIndex(index)}
                  type="button"
                >
                  <img alt="" src={image} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sdkwork-mall-pc-pdp-info">
          <h1>{detail.title}</h1>
          {detail.subtitle ? <p className="sdkwork-mall-pc-pdp-subtitle">{detail.subtitle}</p> : null}

          <div className="sdkwork-mall-pc-pdp-price-block">
            <div className="sdkwork-mall-pc-pdp-price-current">
              <span className="sdkwork-mall-pc-pdp-price-label">促销价</span>
              <strong className="sdkwork-mall-pc-pdp-price">{formatCny(displayPrice)}</strong>
            </div>
            {hasDiscount ? (
              <div className="sdkwork-mall-pc-pdp-price-list">
                <span className="sdkwork-mall-pc-pdp-price-original">{formatCny(detail.listPriceCny)}</span>
                {discountPercent != null ? (
                  <Badge variant="danger">省 {discountPercent}%</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {detail.promotionTags.length > 0 ? (
            <div className="sdkwork-mall-pc-pdp-promo-tags">
              {detail.promotionTags.map((tag) => (
                <Badge key={tag} variant="warning">{tag}</Badge>
              ))}
            </div>
          ) : null}

          {coupons.length > 0 ? (
            <section className="sdkwork-mall-pc-pdp-coupons">
              <span className="sdkwork-mall-pc-pdp-coupons-label">可用优惠</span>
              <div className="sdkwork-mall-pc-chip-row">
                {coupons.map((coupon) => (
                  <Link key={coupon.id} to="/buyer/coupons">
                    <Badge variant="default">{coupon.title}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="sdkwork-mall-pc-pdp-meta-row">
            <span className="sdkwork-mall-pc-pdp-meta-label">配送</span>
            <span className="sdkwork-mall-pc-pdp-meta-value">
              <Truck aria-hidden="true" size={14} /> 全国包邮 · 闪电发货
            </span>
            <span className="sdkwork-mall-pc-pdp-meta-label">库存</span>
            <StatusNotice tone={stockStatus.tone}>{stockStatus.label}</StatusNotice>
          </div>

          <div className="sdkwork-mall-pc-pdp-meta-row">
            <span className="sdkwork-mall-pc-pdp-meta-label">服务承诺</span>
            <div className="sdkwork-mall-pc-pdp-commitments">
              {serviceCommitments.map((commitment) => (
                <span className="sdkwork-mall-pc-pdp-commitment" key={commitment.title}>
                  <ShieldCheck aria-hidden="true" size={14} />
                  {commitment.title}
                </span>
              ))}
            </div>
          </div>

          {detail.skus.length > 1 ? (
            <div className="sdkwork-mall-pc-pdp-sku-picker">
              <span className="sdkwork-mall-pc-pdp-meta-label">规格</span>
              <div className="sdkwork-mall-pc-pdp-sku-options">
                {detail.skus.map((sku) => (
                  <button
                    className={
                      sku.id === selectedSkuId
                        ? "sdkwork-mall-pc-pdp-sku-option is-active"
                        : "sdkwork-mall-pc-pdp-sku-option"
                    }
                    key={sku.id}
                    onClick={() => setSelectedSkuId(sku.id)}
                    type="button"
                  >
                    {sku.imageUrl ? <img alt="" src={sku.imageUrl} /> : null}
                    <span>{sku.name}</span>
                    {sku.stock != null && sku.stock <= 0 ? (
                      <Badge variant="secondary">缺货</Badge>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="sdkwork-mall-pc-quantity">
            <span className="sdkwork-mall-pc-pdp-meta-label">数量</span>
            <span className="sdkwork-mall-pc-pdp-quantity-control">
              <button
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                type="button"
              >
                -
              </button>
              <input
                min={1}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                type="number"
                value={quantity}
              />
              <button
                onClick={() => setQuantity((value) => value + 1)}
                type="button"
              >
                +
              </button>
            </span>
          </label>

          {message ? <StatusNotice tone="default">{message}</StatusNotice> : null}

          <div className="sdkwork-mall-pc-pdp-actions">
            <Button
              onClick={() => {
                const next = toggleMallFavorite({ id: detail.id, title: detail.title });
                setFavorited(next);
                setMessage(next ? "已加入收藏" : "已取消收藏");
              }}
              type="button"
              variant="outline"
            >
              <Heart aria-hidden="true" fill={favorited ? "currentColor" : "none"} size={16} />
              {favorited ? "已收藏" : "收藏"}
            </Button>
            <Button disabled={busy || stockStatus.tone === "danger"} onClick={handleAddToCart} type="button">
              加入购物车
            </Button>
            <Button
              disabled={busy || stockStatus.tone === "danger"}
              onClick={async () => {
                await handleAddToCart();
                navigate("/checkout");
              }}
              type="button"
              variant="primary"
            >
              立即购买
            </Button>
          </div>
        </div>

        {/* 店铺信息区 */}
        <aside className="sdkwork-mall-pc-pdp-shop">
          <div className="sdkwork-mall-pc-pdp-shop-header">
            <Store aria-hidden="true" size={18} />
            <div>
              <strong>{detail.shopName ?? "平台自营"}</strong>
              {detail.shopId ? (
                <Link to={`/shop/${detail.shopId}`}>进店逛逛</Link>
              ) : null}
            </div>
          </div>
          <ShopRatingPanel rating={detail.shopRating} />
          <Separator />
          <div className="sdkwork-mall-pc-pdp-shop-actions">
            <Button onClick={() => navigate("/buyer/messages")} size="sm" type="button" variant="outline">
              <MessageCircleQuestion aria-hidden="true" size={14} />
              联系客服
            </Button>
            {detail.shopId ? (
              <Button onClick={() => navigate(`/shop/${detail.shopId}`)} size="sm" type="button" variant="ghost">
                查看店铺
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      {/* 评价摘要 */}
      {detail.reviewSummary ? (
        <section className="sdkwork-mall-pc-pdp-review-summary">
          <h2>评价摘要</h2>
          <div className="sdkwork-mall-pc-pdp-review-summary-grid">
            <div className="sdkwork-mall-pc-pdp-review-score">
              <strong>{formatRating(detail.reviewSummary.averageRating)}</strong>
              <span>综合评分</span>
              {detail.reviewSummary.goodRate != null ? (
                <Badge variant="success">好评率 {Math.round(detail.reviewSummary.goodRate * 100)}%</Badge>
              ) : null}
            </div>
            <div className="sdkwork-mall-pc-pdp-review-tags">
              <span>共 {detail.reviewSummary.totalReviews} 条评价</span>
              {detail.reviewSummary.tags?.length ? (
                <div className="sdkwork-mall-pc-chip-row">
                  {detail.reviewSummary.tags.map((tag) => (
                    <Badge key={tag.label} variant="secondary">
                      {tag.label} ({tag.count})
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* 商品详情区：图文详情 / 规格参数 / 包装清单 / 售后说明 / 常见问题 */}
      <section className="sdkwork-mall-pc-pdp-detail-tabs">
        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description">图文详情</TabsTrigger>
            <TabsTrigger value="specifications">规格参数</TabsTrigger>
            <TabsTrigger value="package">包装清单</TabsTrigger>
            <TabsTrigger value="after-sales">售后说明</TabsTrigger>
            <TabsTrigger value="faq">常见问题</TabsTrigger>
          </TabsList>

          <TabsContent value="description">
            <div className="sdkwork-mall-pc-pdp-description-content">
              {detail.description ? <p>{detail.description}</p> : <p>暂无图文详情。</p>}
              {detail.images.length > 0 ? (
                <div className="sdkwork-mall-pc-pdp-description-images">
                  {detail.images.map((image, index) => (
                    <img alt={`${detail.title} 详情图 ${index + 1}`} key={image + index} src={image} />
                  ))}
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="specifications">
            {specRows.length > 0 ? (
              <KeyValueTable rows={specRows} />
            ) : (
              <EmptyState description="商家暂未提供规格参数" title="暂无规格参数" />
            )}
          </TabsContent>

          <TabsContent value="package">
            {detail.packageList.length > 0 ? (
              <ul className="sdkwork-mall-pc-pdp-package-list">
                {detail.packageList.map((item) => (
                  <li key={item.name}>
                    <PackageCheck aria-hidden="true" size={16} />
                    <span>{item.name}</span>
                    {item.quantity ? <Badge variant="secondary">×{item.quantity}</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="商家暂未提供包装清单" title="暂无包装清单" />
            )}
          </TabsContent>

          <TabsContent value="after-sales">
            {detail.afterSalesNotes.length > 0 ? (
              <div className="sdkwork-mall-pc-pdp-after-sales">
                <RotateCcw aria-hidden="true" size={18} />
                <ul>
                  {detail.afterSalesNotes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="sdkwork-mall-pc-pdp-after-sales">
                <RotateCcw aria-hidden="true" size={18} />
                <ul>
                  <li>支持 7 天无理由退货（特殊商品除外）。</li>
                  <li>商品质量问题支持 15 天换货。</li>
                  <li>退换货运费：质量问题由商家承担，非质量问题由买家承担。</li>
                  <li>如需售后帮助，请联系店铺客服或前往「我的订单」申请售后。</li>
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="faq">
            {faqItems.length > 0 ? (
              <ul className="sdkwork-mall-pc-pdp-faq">
                {faqItems.map((item, index) => (
                  <li key={index}>
                    <details>
                      <summary>
                        <MessageCircleQuestion aria-hidden="true" size={16} />
                        {item.question}
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="暂无常见问题" title="暂无 FAQ" />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* 评价区 */}
      <section className="sdkwork-mall-pc-pdp-reviews">
        <h2>商品评价</h2>
        <EmptyState
          description="评价晒单与媒体上传需等待 commerce 商品评价 API 合约落地。"
          title="暂无评价"
        />
      </section>

      {/* 推荐区：同店推荐 + 看了又看 */}
      {sameShopProducts.length > 0 ? (
        <section className="sdkwork-mall-pc-floor">
          <h2><Store aria-hidden="true" size={18} /> 同店推荐</h2>
          <div className="sdkwork-mall-pc-product-grid">
            {sameShopProducts.map((product) => (
              <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdkwork-mall-pc-product-body">
                  <h3>{product.title}</h3>
                  <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="sdkwork-mall-pc-floor">
          <h2>看了又看</h2>
          <div className="sdkwork-mall-pc-product-grid">
            {recommendations.map((product) => (
              <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdkwork-mall-pc-product-body">
                  <h3>{product.title}</h3>
                  <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
