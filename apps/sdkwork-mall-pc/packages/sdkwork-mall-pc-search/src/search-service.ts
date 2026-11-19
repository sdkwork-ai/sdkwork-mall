import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkSearchRemotePort } from "./search-remote-port";

export interface MallSearchProduct {
  id: string;
  imageUrl?: string;
  listPriceCny?: number | null;
  priceCny: number | null;
  shopId?: string;
  shopName?: string;
  title: string;
  brand?: string;
  origin?: string;
  inStock?: boolean;
  selfOperated?: boolean;
  freeShipping?: boolean;
  rating?: number;
  salesCount?: number;
}

export interface MallSearchResult {
  items: MallSearchProduct[];
  total: number;
}

function readSearchNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  // Money and counts may ride the wire as decimal strings; Number("4299.00")
  // keeps a paid product from degrading to the "询价" fallback.
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Reads an aggregated SKU price published in minor units, else a decimal one. */
function readSearchMoney(
  record: Record<string, unknown>,
  minorKey: string,
  decimalKeys: readonly string[],
): number | null {
  const minor = readSearchNumber(record[minorKey]);
  const exponent = readSearchNumber(record.minorUnitExponent ?? record.priceScale);
  if (minor != null && exponent != null && Number.isInteger(exponent) && exponent >= 0 && exponent <= 8) {
    return minor / 10 ** exponent;
  }
  for (const key of decimalKeys) {
    const value = readSearchNumber(record[key]);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function readMediaUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const snapshot =
    record.resourceSnapshot && typeof record.resourceSnapshot === "object"
      ? (record.resourceSnapshot as Record<string, unknown>)
      : null;
  const url =
    (typeof record.url === "string" && record.url) ||
    (typeof record.publicUrl === "string" && record.publicUrl) ||
    (typeof snapshot?.url === "string" && snapshot.url) ||
    (typeof snapshot?.publicUrl === "string" && snapshot.publicUrl);
  return url || undefined;
}

function readSearchProduct(record: Record<string, unknown>): MallSearchProduct {
  // Canonical media is a primaryImage/coverImage `{ url }` object; the dev
  // double (and legacy payloads) ship a plain string `imageUrl` plus an
  // `images` array whose first entry is the cover.
  const media = record.primaryImage ?? record.coverImage;
  const objectImageUrl =
    typeof media === "object" && media !== null && "url" in media
      ? String((media as { url?: unknown }).url ?? "")
      : undefined;
  const mediaRows = Array.isArray(record.media) ? record.media : [];
  const firstMediaUrl = mediaRows.map(readMediaUrl).find((url) => Boolean(url));
  const images = Array.isArray(record.images) ? record.images : [];
  const firstListImage = images.find((item) => typeof item === "string" && item !== "");
  const imageUrl =
    objectImageUrl
    ?? (typeof record.imageUrl === "string" && record.imageUrl
      ? record.imageUrl
      : undefined)
    ?? (typeof firstListImage === "string" ? firstListImage : undefined)
    ?? firstMediaUrl;

  const brand =
    typeof record.brand === "string"
      ? record.brand
      : typeof record.brandName === "string"
        ? record.brandName
        : undefined;

  const origin =
    typeof record.origin === "string"
      ? record.origin
      : typeof record.shipFrom === "string"
        ? record.shipFrom
        : typeof record.originPlace === "string"
          ? record.originPlace
          : undefined;

  const stock = readSearchNumber(record.stock) ?? readSearchNumber(record.stockQuantity) ?? undefined;
  const inStock = stock == null ? undefined : stock > 0;

  const selfOperated =
    typeof record.selfOperated === "boolean"
      ? record.selfOperated
      : typeof record.self_operated === "boolean"
        ? record.self_operated
        : typeof record.isSelfOperated === "boolean"
          ? record.isSelfOperated
          : undefined;

  const freeShipping =
    typeof record.freeShipping === "boolean"
      ? record.freeShipping
      : typeof record.free_shipping === "boolean"
        ? record.free_shipping
        : typeof record.isFreeShipping === "boolean"
          ? record.isFreeShipping
          : undefined;

  const rating = readSearchNumber(record.rating) ?? readSearchNumber(record.averageRating) ?? undefined;
  const salesCount = readSearchNumber(record.salesCount) ?? readSearchNumber(record.sales) ?? undefined;

  return {
    id: String(record.id ?? record.spuId ?? ""),
    title: String(record.title ?? record.name ?? "商品"),
    priceCny: readSearchMoney(record, "salePriceMinor", ["salePrice", "price", "priceCny"]),
    listPriceCny: readSearchMoney(record, "listPriceMinor", [
      "listPrice",
      "marketPrice",
      "originalPrice",
    ]),
    shopId:
      typeof record.shopId === "string"
        ? record.shopId
        : typeof record.shop_id === "string"
          ? record.shop_id
          : undefined,
    shopName: typeof record.shopName === "string" ? record.shopName : undefined,
    imageUrl: imageUrl || undefined,
    brand,
    origin,
    inStock,
    selfOperated,
    freeShipping,
    rating,
    salesCount,
  };
}

export interface MallCategoryOption {
  id: string;
  name: string;
  parentId?: string;
}

export async function listMallCategories(): Promise<MallCategoryOption[]> {
  const response = await getSdkworkSearchRemotePort().listCategories({ page: 1, pageSize: 50, status: "active" });
  const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
  return (
    payload.items?.map((item) => {
      const parentId = String(item.parentId ?? item.parent_id ?? "").trim();
      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? item.title ?? "类目"),
        ...(parentId ? { parentId } : {}),
      };
    }) ?? []
  );
}

export interface MallCategoryTreeNode extends MallCategoryOption {
  children: MallCategoryTreeNode[];
}

export function buildMallCategoryTree(categories: MallCategoryOption[]): MallCategoryTreeNode[] {
  const nodesById = new Map<string, MallCategoryTreeNode>();
  for (const category of categories) {
    nodesById.set(category.id, { ...category, children: [] });
  }
  const roots: MallCategoryTreeNode[] = [];
  for (const node of nodesById.values()) {
    const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Reads the server-reported total from either page-info shape.
 *
 * SDKWork v3 publishes `pageInfo: { totalItems: "1200", totalPages, hasMore }`
 * while the dev double and older payloads publish `pageInfo.total` (or a flat
 * `total`). Reading only `payload.total` made every list one page long: the
 * total fell back to the current page length and pagination disappeared.
 */
function readSearchTotal(payload: {
  total?: unknown;
  pageInfo?: { totalItems?: unknown; total?: unknown } | null;
}): number | null {
  const candidates = [payload.pageInfo?.totalItems, payload.pageInfo?.total, payload.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export async function searchMallProducts(input: {
  categoryId?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  shopId?: string;
  sort?: string;
}): Promise<MallSearchResult> {
  const remote = getSdkworkSearchRemotePort();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  // 指定 shopId 时走 catalog.products.list，由服务端按 shop_id + sort +
  // page/page_size 过滤分页，直接使用服务端 total 与已分页 items。
  if (input.shopId) {
    const response = await remote.listProducts({
      categoryId: input.categoryId,
      page,
      pageSize,
      shopId: input.shopId,
      sort: input.sort,
    });
    const payload = unwrapSdkworkPaymentResponse(response) as {
      items?: Record<string, unknown>[];
      pageInfo?: { totalItems?: unknown; total?: unknown } | null;
      total?: unknown;
    };
    const items = payload.items?.map(readSearchProduct) ?? [];
    return { items, total: readSearchTotal(payload) ?? items.length };
  }

  // 自由文本搜索走 catalog.products.list（支持 q 与 sort），由服务端分页。
  const response = await remote.listSpus({
    categoryId: input.categoryId,
    page,
    pageSize,
    q: input.query,
    sort: input.sort,
  });
  const payload = unwrapSdkworkPaymentResponse(response) as {
    items?: Record<string, unknown>[];
    pageInfo?: { totalItems?: unknown; total?: unknown } | null;
    total?: unknown;
  };
  const items = payload.items?.map(readSearchProduct) ?? [];
  return { items, total: readSearchTotal(payload) ?? items.length };
}

export interface MallSearchShop {
  description?: string;
  id: string;
  name: string;
  operationStatus?: string;
}

export async function searchMallShops(input: {
  page?: number;
  pageSize?: number;
  query?: string;
}): Promise<{ items: MallSearchShop[]; total: number }> {
  const response = await getSdkworkSearchRemotePort().listShops({
    page: input.page ?? 1,
    page_size: input.pageSize ?? 10,
    q: input.query,
  });
  const payload = unwrapSdkworkPaymentResponse(response) as {
    items?: Record<string, unknown>[];
    pageInfo?: { totalItems?: unknown; total?: unknown } | null;
    total?: unknown;
  };
  const items =
    payload.items?.map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? item.shopName ?? "店铺"),
      description:
        typeof item.description === "string"
          ? item.description
          : typeof item.summary === "string"
            ? item.summary
            : undefined,
      operationStatus: String(item.operationStatus ?? item.operation_status ?? ""),
    })).filter((shop) => shop.id) ?? [];

  return {
    items,
    total: readSearchTotal(payload) ?? items.length,
  };
}
