import { formatMoney } from "@sdkwork/utils/money";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  EmptyState,
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
  isMallLoginRequiredError,
  loadMallProductCoupons,
  loadMallProductDetail,
  retrieveMallCategory,
  setMallProductCartQuantity,
  type MallProductDetail,
  type MallProductSkuAttribute,
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
  if (value == null || !Number.isFinite(value)) return "暂无报价";
  return formatMoney(value, { currency: "CNY", locale: "en-US", mode: "symbol" }) ?? "暂无报价";
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

interface MallSkuSpecValue {
  key: string;
  label: string;
  skuIds: string[];
}

interface MallSkuSpecGroup {
  key: string;
  label: string;
  values: MallSkuSpecValue[];
}

function skuAxisValueKey(attribute: MallProductSkuAttribute): string {
  return attribute.valueId || attribute.valueLabel;
}

/**
 * Groups SKUs into one option list per sales axis.
 *
 * A SKU only carries axis ids, so the label comes from the product-level
 * attribute table. When the payload has no axis rows (dev doubles ship a flat
 * `{ id, title, priceCny }` SKU), an empty list makes the page fall back to a
 * flat SKU picker instead of rendering meaningless groups.
 */
function buildMallSkuSpecGroups(
  skus: MallProductDetail["skus"],
  labels: Record<string, string>,
): MallSkuSpecGroup[] {
  const groups = new Map<string, MallSkuSpecGroup>();
  for (const sku of skus) {
    for (const attribute of sku.attributes) {
      const key = attribute.axisKey;
      const label =
        labels[key] ??
        labels[`no:${attribute.attributeNo}`] ??
        labels[`id:${attribute.attributeId}`] ??
        attribute.attributeNo ??
        "规格";
      let group = groups.get(key);
      if (!group) {
        group = { key, label, values: [] };
        groups.set(key, group);
      }
      const valueKey = skuAxisValueKey(attribute);
      let option = group.values.find((value) => value.key === valueKey);
      if (!option) {
        option = { key: valueKey, label: attribute.valueLabel, skuIds: [] };
        group.values.push(option);
      }
      option.skuIds.push(sku.id);
    }
  }
  return [...groups.values()].filter((group) => group.values.length > 0);
}

/** True when some SKU with this axis value is in stock under the other chosen axes. */
function isMallSkuAxisValueAvailable(input: {
  skus: MallProductDetail["skus"];
  selectedSku: MallProductDetail["skus"][number] | null;
  axisKey: string;
  valueKey: string;
}): boolean {
  return input.skus.some((sku) => {
    const matchesValue = sku.attributes.some(
      (attribute) => attribute.axisKey === input.axisKey && skuAxisValueKey(attribute) === input.valueKey,
    );
    if (!matchesValue || (sku.stock != null && sku.stock <= 0)) {
      return false;
    }
    return sku.attributes.every((attribute) => {
      if (attribute.axisKey === input.axisKey) {
        return true;
      }
      const chosen = input.selectedSku?.attributes.find((entry) => entry.axisKey === attribute.axisKey);
      return chosen == null || skuAxisValueKey(chosen) === skuAxisValueKey(attribute);
    });
  });
}

/**
 * Picks the SKU that results from changing one axis.
 *
 * Other chosen axes are preserved when a SKU exists for the combination, which
 * is what stops a click from silently discarding "曜石黑" when the shopper only
 * changed the storage size.
 */
function pickMallSkuForAxis(input: {
  skus: MallProductDetail["skus"];
  selectedSku: MallProductDetail["skus"][number] | null;
  axisKey: string;
  valueKey: string;
}): string | null {
  const matchesValue = (sku: MallProductDetail["skus"][number]) =>
    sku.attributes.some(
      (attribute) => attribute.axisKey === input.axisKey && skuAxisValueKey(attribute) === input.valueKey,
    );
  const inStock = (sku: MallProductDetail["skus"][number]) => sku.stock == null || sku.stock > 0;
  const preferred = input.skus.find((sku) => {
    if (!matchesValue(sku) || !inStock(sku)) {
      return false;
    }
    return sku.attributes.every((attribute) => {
      if (attribute.axisKey === input.axisKey) {
        return true;
      }
      const chosen = input.selectedSku?.attributes.find((entry) => entry.axisKey === attribute.axisKey);
      return chosen == null || skuAxisValueKey(chosen) === skuAxisValueKey(attribute);
    });
  });
  const fallback = input.skus.find((sku) => matchesValue(sku) && inStock(sku)) ?? input.skus.find(matchesValue);
  return (preferred ?? fallback)?.id ?? null;
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
  { label: "价格升序", value: "price-asc" },
  { label: "价格降序", value: "price-desc" },
  { label: "上新", value: "newest" },
] as const;

const CATEGORY_PAGE_SIZE = 20;

function formatCategoryCny(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "暂无报价";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [banners, setBanners] = useState<MallCmsBanner[]>(() => listEnabledMallCmsBanners());
  const [hotProducts, setHotProducts] = useState<MallSearchProduct[]>([]);
  const [newProducts, setNewProducts] = useState<MallSearchProduct[]>([]);

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
    setLoadError(null);
    setCategoryDetail(null);
    async function load() {
      try {
        const categoryList = await listMallCategories().catch(
          () => [] as Array<{ id: string; name: string }>,
        );
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
        }
      } catch (cause: unknown) {
        // The category pages must distinguish "nothing was seeded" from "the
        // listing could not be read"; the previous code left the skeleton up
        // forever on a transport failure.
        if (active) {
          setLoadError(cause instanceof Error && cause.message ? cause.message : "类目商品加载失败");
          setItems([]);
          setTotal(0);
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
  }, [categoryId, keyword, sort, page, reloadToken]);

  // 侧边栏推荐榜与新品榜：目录没有销量字段，一次「最新」读取后拆成两栏，
  // 避免两个榜单在真实后端返回完全相同的 6 件商品。
  useEffect(() => {
    let active = true;
    searchMallProducts({
      categoryId: categoryId ?? undefined,
      pageSize: 12,
      sort: "newest",
    })
      .then((result) => {
        if (active) {
          setNewProducts(result.items.slice(0, 6));
          setHotProducts(result.items.slice(6, 12));
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

  // Facets for brand/price/service were removed here: the catalog list API
  // exposes only `q`, `category_id`, `shop_id`, `product_type` and `sort`, so
  // those facets filtered the 20 loaded rows while the header claimed a
  // catalog-wide result. They return once the authority accepts the filters.

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

  const totalPages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  const hasRankings = hotProducts.length > 0 || newProducts.length > 0;
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

  if (loadError) {
    return (
      <EmptyState
        actions={(
          <>
            <Button onClick={() => setReloadToken((token) => token + 1)} type="button" variant="outline">
              重试
            </Button>
            <Link to="/admin/default-data">默认数据初始化</Link>
          </>
        )}
        description={`${loadError}${loadError.includes("后台") ? "" : "（若刚完成安装，请确认后台服务已启动）"}`}
        title="类目商品加载失败"
      />
    );
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
          共 {total} 件商品
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

      <div className={hasRankings ? "sdkwork-mall-pc-search-layout" : "sdkwork-mall-pc-search-layout is-single-column"}>
        {/* 侧栏：推荐榜与新品榜（服务端暂不支持品牌/价格/服务筛选） */}
        {hasRankings ? (
        <aside className="sdkwork-mall-pc-search-filters">
          {/* 推荐榜 */}
          {hotProducts.length > 0 ? (
            <div className="sdkwork-mall-pc-filter-section">
              <h3><Flame aria-hidden="true" size={14} /> 精选推荐</h3>
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
        ) : null}

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
          {items.length === 0 ? (
            total === 0 ? (
              <EmptyState
                actions={<Link to="/admin/default-data">初始化默认数据</Link>}
                description="该环境还没有商品数据。全新安装后可先在首页或管理后台初始化默认数据集（类目、店铺、商品与 SKU）。"
                title="暂无商品"
              />
            ) : (
              <EmptyState description="该页暂无可显示的商品，请返回上一页。" title="暂无商品" />
            )
          ) : (
            <div className="sdkwork-mall-pc-product-grid">
              {items.map((product) => (
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
  const location = useLocation();
  const [detail, setDetail] = useState<MallProductDetail | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "warning" | "danger">("default");
  const [busy, setBusy] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [coupons, setCoupons] = useState<Array<{ id: string; title: string }>>([]);
  const [recommendations, setRecommendations] = useState<Awaited<ReturnType<typeof searchMallProducts>>["items"]>([]);
  const [sameShopProducts, setSameShopProducts] = useState<Awaited<ReturnType<typeof searchMallProducts>>["items"]>([]);

  const loadDetail = useCallback(async () => {
    const data = await loadMallProductDetail(productId);
    setDetail(data);
    // Preselect a SKU the shopper could actually buy: the first purchasable one
    // (stock is not reported by every projection), then the first SKU, then
    // none. Preselecting an out-of-stock variant made the CTA enable for an
    // unbuyable line.
    const purchasable = data.skus.find((sku) => sku.stock == null || sku.stock > 0);
    setSelectedSkuId(purchasable?.id ?? data.skus[0]?.id ?? "");
    setFavorited(isMallFavorite(data.id));
    // Breadcrumb category is optional metadata; a failed read only drops one
    // crumb and must not fail the product page.
    setCategoryName(null);
    if (data.categoryId) {
      void retrieveMallCategory(data.categoryId)
        .then((category) => setCategoryName(category?.name ?? null))
        .catch(() => setCategoryName(null));
    }
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
  }, [productId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    loadDetail()
      .catch((cause: unknown) => {
        if (active) {
          setLoadError(cause instanceof Error ? cause.message : "商品详情加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    void loadMallProductCoupons()
      .then((rows) => {
        if (active) {
          setCoupons(rows);
        }
      })
      .catch(() => {
        // 优惠券行为可选增强，失败时静默隐藏。
      });
    return () => {
      active = false;
    };
  }, [loadDetail]);

  const retryLoadDetail = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    loadDetail()
      .catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : "商品详情加载失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadDetail]);

  useEffect(() => {
    // SKU 切换时联动主图：若 SKU 有图片则切换到对应图片，否则保持第一张。
    if (!detail) return;
    const selectedSku = detail.skus.find((sku) => sku.id === selectedSkuId);
    if (selectedSku?.imageUrl) {
      const idx = detail.images.indexOf(selectedSku.imageUrl);
      setActiveImageIndex(idx >= 0 ? idx : 0);
    }
    // 数量不能停留在新规格的库存之外，否则加购会被后端拒绝。
    if (selectedSku?.stock != null) {
      setQuantity((value) => Math.min(value, Math.max(1, selectedSku.stock ?? 1)));
    }
  }, [selectedSkuId, detail]);

  if (loading) {
    return <LoadingBlock label="加载商品详情..." />;
  }

  if (!detail) {
    if (loadError) {
      return (
        <EmptyState
          actions={<Button onClick={retryLoadDetail} type="button" variant="outline">重试</Button>}
          description={loadError}
          title="商品详情加载失败"
        />
      );
    }
    return <EmptyState description="商品可能已下架" title="商品不存在" />;
  }

  const selectedSku = detail.skus.find((sku) => sku.id === selectedSkuId) ?? null;
  const displayPrice = selectedSku?.priceCny ?? detail.priceCny;
  const displayListPrice = selectedSku?.listPriceCny ?? detail.listPriceCny;
  const hasDiscount =
    displayListPrice != null &&
    displayPrice != null &&
    displayListPrice > displayPrice;
  const discountPercent =
    hasDiscount && displayPrice != null && displayListPrice != null
      ? Math.round((1 - displayPrice / displayListPrice) * 100)
      : null;
  const stockStatus = resolveStockStatus(selectedSku?.stock);
  const selectedSkuSoldOut = selectedSku?.stock != null && (selectedSku.stock ?? 0) <= 0;
  const canPurchase = selectedSku != null && !selectedSkuSoldOut;
  const maxPurchasable =
    selectedSku?.stock != null && selectedSku.stock > 0 ? selectedSku.stock : undefined;
  const skuGroups = buildMallSkuSpecGroups(detail.skus, detail.attributeLabels);
  const serviceCommitments =
    detail.serviceCommitments.length > 0 ? detail.serviceCommitments : DEFAULT_SERVICE_COMMITMENTS;
  const faqItems = detail.faq.length > 0 ? detail.faq : DEFAULT_FAQ;
  const activeImage = detail.images[activeImageIndex] ?? detail.images[0];

  const specRows: KeyValueTableRowData[] = detail.specifications.map((row) => ({
    id: row.label,
    label: row.label,
    value: row.value,
  }));

  async function handleAddToCart(): Promise<string | undefined> {
    if (detail!.skus.length === 0) {
      setMessageTone("warning");
      setMessage("该商品暂未返回可售规格，无法加入购物车");
      return undefined;
    }
    if (!selectedSku?.id) {
      setMessageTone("warning");
      setMessage("请选择规格");
      return undefined;
    }
    if (selectedSkuSoldOut) {
      setMessageTone("warning");
      setMessage("该规格暂时缺货，请选择其他规格");
      return undefined;
    }
    if (maxPurchasable != null && quantity > maxPurchasable) {
      setMessageTone("warning");
      setMessage(`该规格最多可购买 ${maxPurchasable} 件`);
      return undefined;
    }
    setBusy(true);
    setMessage(null);
    try {
      const cartItemId = await addMallProductToCart({
        productId: detail!.id,
        skuId: selectedSku.id,
        quantity,
      });
      setMessageTone("success");
      setMessage("已加入购物车");
      return cartItemId;
    } catch (cause: unknown) {
      if (isMallLoginRequiredError(cause)) {
        // Buying is account-scoped; browsing is not. Send the shopper to the
        // login screen and come back to this product instead of showing a 401.
        navigate(`/auth/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
        return undefined;
      }
      setMessageTone("danger");
      setMessage(cause instanceof Error ? cause.message : "加入购物车失败");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sdkwork-mall-pc-pdp">
      {/* 面包屑 */}
      <nav className="sdkwork-mall-pc-pdp-breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        {categoryName && detail.categoryId ? (
          <>
            <ChevronRight aria-hidden="true" size={14} />
            <Link to={`/categories/${detail.categoryId}`}>{categoryName}</Link>
          </>
        ) : null}
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
                <span className="sdkwork-mall-pc-pdp-price-original">{formatCny(displayListPrice)}</span>
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

          {detail.skus.length === 0 ? (
            <div className="sdkwork-mall-pc-pdp-sku-picker">
              <span className="sdkwork-mall-pc-pdp-meta-label">规格</span>
              <StatusNotice tone="warning">
                商品接口未返回可售规格，暂时无法加入购物车。请稍后重试，或联系店铺客服确认货源。
              </StatusNotice>
            </div>
          ) : (
            <div className="sdkwork-mall-pc-pdp-sku-picker">
              <span className="sdkwork-mall-pc-pdp-meta-label">规格</span>
              {skuGroups.length > 0 ? (
                <div className="sdkwork-mall-pc-pdp-sku-groups">
                  {skuGroups.map((group) => (
                    <div className="sdkwork-mall-pc-pdp-sku-axis" key={group.key}>
                      <span className="sdkwork-mall-pc-pdp-sku-axis-label">{group.label}</span>
                      <div className="sdkwork-mall-pc-pdp-sku-options">
                        {group.values.map((value) => {
                          const active =
                            selectedSku?.attributes.some(
                              (attribute) =>
                                attribute.axisKey === group.key && skuAxisValueKey(attribute) === value.key,
                            ) ?? false;
                          const available = isMallSkuAxisValueAvailable({
                            skus: detail.skus,
                            selectedSku,
                            axisKey: group.key,
                            valueKey: value.key,
                          });
                          return (
                            <button
                              aria-pressed={active}
                              className={
                                active
                                  ? "sdkwork-mall-pc-pdp-sku-option is-active"
                                  : "sdkwork-mall-pc-pdp-sku-option"
                              }
                              disabled={!available && !active}
                              key={value.key}
                              onClick={() => {
                                const nextSkuId = pickMallSkuForAxis({
                                  skus: detail.skus,
                                  selectedSku,
                                  axisKey: group.key,
                                  valueKey: value.key,
                                });
                                if (!nextSkuId) {
                                  return;
                                }
                                setSelectedSkuId(nextSkuId);
                                setQuantity(1);
                                setMessage(null);
                              }}
                              type="button"
                            >
                              <span>{value.label}</span>
                              {!available ? <Badge variant="secondary">缺货</Badge> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="sdkwork-mall-pc-pdp-sku-summary">
                    {selectedSku ? `已选：${selectedSku.name}` : "请选择规格"}
                  </p>
                </div>
              ) : (
                <div className="sdkwork-mall-pc-pdp-sku-options">
                  {detail.skus.map((sku) => {
                    const soldOut = sku.stock != null && sku.stock <= 0;
                    const active = sku.id === selectedSkuId;
                    return (
                      <button
                        aria-pressed={active}
                        className={
                          active
                            ? "sdkwork-mall-pc-pdp-sku-option is-active"
                            : "sdkwork-mall-pc-pdp-sku-option"
                        }
                        disabled={soldOut && !active}
                        key={sku.id}
                        onClick={() => {
                          setSelectedSkuId(sku.id);
                          setQuantity(1);
                          setMessage(null);
                        }}
                        type="button"
                      >
                        {sku.imageUrl ? <img alt="" src={sku.imageUrl} /> : null}
                        <span>{sku.name}</span>
                        {soldOut ? <Badge variant="secondary">缺货</Badge> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
                max={maxPurchasable}
                min={1}
                onChange={(event) => {
                  const next = Math.max(1, Number(event.target.value) || 1);
                  setQuantity(maxPurchasable != null ? Math.min(next, maxPurchasable) : next);
                }}
                type="number"
                value={quantity}
              />
              <button
                disabled={maxPurchasable != null && quantity >= maxPurchasable}
                onClick={() => setQuantity((value) => (maxPurchasable != null ? Math.min(value + 1, maxPurchasable) : value + 1))}
                type="button"
              >
                +
              </button>
            </span>
          </label>

          {message ? <StatusNotice tone={messageTone}>{message}</StatusNotice> : null}

          <div className="sdkwork-mall-pc-pdp-actions">
            <Button
              onClick={() => {
                const next = toggleMallFavorite({ id: detail.id, title: detail.title });
                setFavorited(next);
                setMessageTone("default");
                setMessage(next ? "已加入收藏" : "已取消收藏");
              }}
              type="button"
              variant="outline"
            >
              <Heart aria-hidden="true" fill={favorited ? "currentColor" : "none"} size={16} />
              {favorited ? "已收藏" : "收藏"}
            </Button>
            <Button disabled={busy || !canPurchase} onClick={handleAddToCart} type="button">
              加入购物车
            </Button>
            <Button
              disabled={busy || !canPurchase}
              onClick={async () => {
                // 立即购买 settles only the line just created. Falling back to
                // the cart (never to a whole-cart checkout) keeps the buyer from
                // paying for unrelated cart lines if the line id is unavailable.
                const cartItemId = await handleAddToCart();
                if (cartItemId === undefined) {
                  return;
                }
                if (!cartItemId) {
                  navigate("/cart");
                  return;
                }
                try {
                  // An existing line is merged with +1 on add, so pin the line
                  // to the quantity the shopper chose before opening checkout.
                  await setMallProductCartQuantity(cartItemId, quantity);
                } catch (cause: unknown) {
                  setMessageTone("danger");
                  setMessage(cause instanceof Error ? cause.message : "无法设置购买数量");
                  return;
                }
                navigate(`/checkout?items=${encodeURIComponent(cartItemId)}`);
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
                  <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "暂无报价"}</strong>
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
                  <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "暂无报价"}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
