import { request, type MpPayload } from "./transport";

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

export async function listCategories(): Promise<MpCategory[]> {
  const payload = await request({ path: "/catalog/categories", query: { page: 1, page_size: 50, status: "active" } });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((item) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? item.title ?? "类目"),
    parentId: String(item.parentId ?? item.parent_id ?? ""),
  }));
}

export async function listProducts(options: MpProductListOptions = {}): Promise<{ items: MpProductCard[]; total: number }> {
  const payload = await request({
    path: "/catalog/spus",
    query: {
      category_id: options.categoryId,
      page: options.page ?? 1,
      page_size: options.pageSize ?? 20,
      q: options.keyword,
      shop_id: options.shopId,
      sort: options.sort,
    },
  });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    items: items.map(mapProductCard),
    total: Number((payload.pageInfo as MpPayload | undefined)?.total) || 0,
  };
}

export async function getProductDetail(productId: string): Promise<MpProductDetail | null> {
  const record = await request({ path: `/catalog/spus/${productId}` });
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
