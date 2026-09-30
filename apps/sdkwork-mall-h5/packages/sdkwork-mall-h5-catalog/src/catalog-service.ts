import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5CategoryOption {
  id: string;
  name: string;
  parentId?: string;
}

export interface MallH5CategoryTreeNode extends MallH5CategoryOption {
  children: MallH5CategoryTreeNode[];
}

export interface MallH5ProductCard {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  sales?: number;
  title: string;
}

export interface MallH5ProductDetail extends MallH5ProductCard {
  description?: string;
  skus: MallH5SkuOption[];
  specs: Array<{ name: string; value: string }>;
  shopId?: string;
  shopName?: string;
}

export interface MallH5SkuOption {
  id: string;
  priceCny: number | null;
  stock: number | null;
  title: string;
}

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readImage(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export async function listMallH5Categories(): Promise<MallH5CategoryOption[]> {
  const response = await getSdkworkCommerceService().catalog.categories.list({
    page: 1,
    page_size: 50,
    status: "active",
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => {
    const parentId = String(item.parentId ?? item.parent_id ?? "").trim();
    return {
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? "类目"),
      ...(parentId ? { parentId } : {}),
    };
  });
}

export function buildMallH5CategoryTree(categories: MallH5CategoryOption[]): MallH5CategoryTreeNode[] {
  const nodesById = new Map<string, MallH5CategoryTreeNode>();
  for (const category of categories) {
    nodesById.set(category.id, { ...category, children: [] });
  }
  const roots: MallH5CategoryTreeNode[] = [];
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

export async function searchMallH5Products(input: {
  categoryId?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  shopId?: string;
  sort?: string;
}): Promise<{ items: MallH5ProductCard[]; total: number }> {
  const remote = getSdkworkCommerceService();
  const page = input.page ?? 1;
  const response = await remote.catalog.spus.list({
    category_id: input.categoryId,
    page,
    page_size: input.pageSize ?? 20,
    q: input.query,
    shop_id: input.shopId,
    sort: input.sort,
  });
  const payload = unwrapSdkworkCommerceResponse<{
    items?: Record<string, unknown>[];
    pageInfo?: { total?: number | string };
  }>(response) ?? {};
  return {
    items: (payload.items ?? []).map((item) => ({
      id: String(item.id ?? item.spuId ?? ""),
      imageUrl: readImage(item.imageUrl ?? item.mainImage ?? item.image),
      priceCny: readMoney(item.priceCny ?? item.price ?? item.salePrice),
      sales: readMoney(item.sales ?? item.salesCount) ?? undefined,
      title: String(item.title ?? item.name ?? "商品"),
    })),
    total: readMoney(payload.pageInfo?.total) ?? 0,
  };
}

export async function retrieveMallH5ProductDetail(productId: string): Promise<MallH5ProductDetail | null> {
  const response = await getSdkworkCommerceService().catalog.spus.retrieve(productId);
  const record = unwrapSdkworkCommerceResponse<Record<string, unknown>>(response);
  if (!record?.id) {
    return null;
  }
  const skuItems = Array.isArray(record.skus) ? (record.skus as Record<string, unknown>[]) : [];
  const specItems = Array.isArray(record.specs) ? (record.specs as Record<string, unknown>[]) : [];
  return {
    description: typeof record.description === "string" ? record.description : undefined,
    id: String(record.id ?? productId),
    imageUrl: readImage(record.imageUrl ?? record.mainImage ?? record.image),
    priceCny: readMoney(record.priceCny ?? record.price ?? record.salePrice),
    sales: readMoney(record.sales ?? record.salesCount) ?? undefined,
    shopId: typeof record.shopId === "string" ? record.shopId : undefined,
    shopName: typeof record.shopName === "string" ? record.shopName : undefined,
    skus: skuItems.map((sku, index) => ({
      id: String(sku.id ?? `sku-${index + 1}`),
      priceCny: readMoney(sku.priceCny ?? sku.price),
      stock: readMoney(sku.stock ?? sku.quantity),
      title: String(sku.title ?? sku.name ?? `规格 ${index + 1}`),
    })),
    specs: specItems.map((spec, index) => ({
      name: String(spec.name ?? `参数 ${index + 1}`),
      value: String(spec.value ?? "-"),
    })),
    title: String(record.title ?? record.name ?? "商品"),
  };
}

export async function addMallH5CartItem(input: {
  productId: string;
  quantity: number;
  skuId: string;
}): Promise<void> {
  await getSdkworkCommerceService().cart.items.create({
    quantity: input.quantity,
    skuId: input.skuId,
    spuId: input.productId,
  });
}

