import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkSearchRemotePort } from "./search-remote-port";

export interface MallSearchProduct {
  id: string;
  imageUrl?: string;
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

function readSearchProduct(record: Record<string, unknown>): MallSearchProduct {
  const media = record.primaryImage ?? record.coverImage;
  const imageUrl =
    typeof media === "object" && media !== null && "url" in media
      ? String((media as { url?: unknown }).url ?? "")
      : undefined;

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

  const stock =
    typeof record.stock === "number"
      ? record.stock
      : typeof record.stockQuantity === "number"
        ? record.stockQuantity
        : undefined;
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

  const rating =
    typeof record.rating === "number"
      ? record.rating
      : typeof record.averageRating === "number"
        ? record.averageRating
        : undefined;

  const salesCount =
    typeof record.salesCount === "number"
      ? record.salesCount
      : typeof record.sales === "number"
        ? record.sales
        : undefined;

  return {
    id: String(record.id ?? record.spuId ?? ""),
    title: String(record.title ?? record.name ?? "商品"),
    priceCny:
      typeof record.salePrice === "number"
        ? record.salePrice
        : typeof record.price === "number"
          ? record.price
          : null,
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
      total?: number;
    };
    const items = payload.items?.map(readSearchProduct) ?? [];
    return { items, total: payload.total ?? items.length };
  }

  // 自由文本搜索走 catalog.spus.list（支持 q），由服务端分页。
  const response = await remote.listSpus({
    categoryId: input.categoryId,
    page,
    pageSize,
    q: input.query,
  });
  const payload = unwrapSdkworkPaymentResponse(response) as {
    items?: Record<string, unknown>[];
    total?: number;
  };
  const items = payload.items?.map(readSearchProduct) ?? [];
  return { items, total: payload.total ?? items.length };
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
    total?: number;
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
    total: payload.total ?? items.length,
  };
}
