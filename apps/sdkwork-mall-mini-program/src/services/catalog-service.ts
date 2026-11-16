/**
 * Catalogue surfaces (categories, product cards, product detail).
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (catalog row) and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. The catalogue belongs to the
 * mall commerce block (`runtime.commerceClient.catalog`); this module projects it
 * onto mall view models and owns no wire path of its own.
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";

import { readPageInfo } from "./page-info";

export interface MpCategory {
  id: string;
  name: string;
  parentId: string;
}

export interface MpProductCard {
  id: string;
  imageUrl: string;
  priceCny: number | null;
  sales: number | null;
  title: string;
}

export interface MpProductListOptions {
  categoryId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  shopId?: string;
  sort?: string;
}

export interface MpSku {
  id: string;
  imageUrl: string;
  priceCny: number | null;
  stock: number;
  title: string;
}

export interface MpProductDetail {
  description: string;
  id: string;
  imageUrl: string;
  images: string[];
  priceCny: number | null;
  sales: number | null;
  shopId: string;
  shopName: string;
  skus: MpSku[];
  specs: Array<{ name: string; value: string }>;
  title: string;
}

function catalog() {
  return getMallMpRuntime().commerceClient.catalog;
}

async function readCommerceData(call: Promise<{ data: Record<string, unknown> }>): Promise<Record<string, unknown>> {
  const result = await call;
  return (result?.data ?? {}) as Record<string, unknown>;
}

function mapProductCard(item: Record<string, unknown>): MpProductCard {
  const image = item.imageUrl ?? item.mainImage ?? item.image;
  return {
    id: String(item.id ?? item.spuId ?? ""),
    title: String(item.title ?? item.name ?? "商品"),
    imageUrl: typeof image === "string" ? image : "",
    priceCny: Number(item.priceCny ?? item.price ?? item.salePrice) || null,
    sales: Number(item.sales ?? item.salesCount) || null,
  };
}

function readRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(record.items)) {
    return record.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(record.content)) {
    return record.content as Array<Record<string, unknown>>;
  }
  return [];
}

export async function listCategories(): Promise<MpCategory[]> {
  const payload = await readCommerceData(
    catalog().categories.list({ page: 1, pageSize: 50, status: "active" }),
  );
  return readRows(payload).map((item) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? item.title ?? "类目"),
    parentId: String(item.parentId ?? item.parent_id ?? ""),
  }));
}

export async function listProducts(options: MpProductListOptions = {}): Promise<{
  hasMore: boolean;
  items: MpProductCard[];
  total: number;
}> {
  const page = options.page ?? 1;
  const payload = await readCommerceData(catalog().products.list({
    page,
    pageSize: options.pageSize ?? 20,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.keyword ? { q: options.keyword } : {}),
    ...(options.shopId ? { shopId: options.shopId } : {}),
    ...(options.sort ? { sort: options.sort } : {}),
  }));
  const items = readRows(payload);
  const pageInfo = readPageInfo(payload, items.length, page);
  return {
    hasMore: pageInfo.hasMore,
    items: items.map(mapProductCard),
    total: pageInfo.totalItems,
  };
}

export async function getProductDetail(productId: string): Promise<MpProductDetail | null> {
  const record = await readCommerceData(catalog().products.retrieve(productId));
  if (!record || !record.id) {
    return null;
  }
  const skuItems = Array.isArray(record.skus) ? record.skus : [];
  const specItems = Array.isArray(record.specs) ? record.specs : [];
  const mainImageSource = record.imageUrl ?? record.mainImage;
  const mainImage = typeof mainImageSource === "string" ? mainImageSource : "";
  const gallerySource = record.images ?? record.galleryImages;
  const gallery = Array.isArray(gallerySource)
    ? gallerySource.filter((entry): entry is string => typeof entry === "string" && entry !== "")
    : [];
  const images = [...new Set([mainImage, ...gallery].filter(Boolean))];
  return {
    id: String(record.id ?? productId),
    title: String(record.title ?? record.name ?? "商品"),
    description: typeof record.description === "string" ? record.description : "",
    imageUrl: mainImage,
    images,
    priceCny: Number(record.priceCny ?? record.price) || null,
    sales: Number(record.sales ?? record.salesCount) || null,
    shopId: typeof record.shopId === "string" ? record.shopId : "",
    shopName: typeof record.shopName === "string" ? record.shopName : "",
    skus: skuItems.map((sku, index) => ({
      id: String(sku.id ?? `sku-${index + 1}`),
      title: String(sku.title ?? sku.name ?? `规格 ${index + 1}`),
      priceCny: Number(sku.priceCny ?? sku.price) || null,
      stock: Number(sku.stock ?? sku.quantity),
      imageUrl: typeof sku.imageUrl === "string" ? sku.imageUrl : "",
    })),
    specs: specItems.map((spec, index) => ({
      name: String(spec.name ?? `参数 ${index + 1}`),
      value: String(spec.value ?? "-"),
    })),
  };
}
