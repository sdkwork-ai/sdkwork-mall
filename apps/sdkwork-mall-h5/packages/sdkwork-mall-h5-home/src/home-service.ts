import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5HomeProductCard {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  sales?: number;
  title: string;
}

export interface MallH5HomeCategory {
  id: string;
  name: string;
}

export interface MallH5HomeSnapshot {
  categories: MallH5HomeCategory[];
  hotProducts: MallH5HomeProductCard[];
  newProducts: MallH5HomeProductCard[];
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

function readProductCard(item: Record<string, unknown>): MallH5HomeProductCard {
  const image = item.imageUrl ?? item.mainImage ?? item.image;
  return {
    id: String(item.id ?? item.spuId ?? ""),
    imageUrl: typeof image === "string" && image ? image : undefined,
    priceCny: readMoney(item.priceCny ?? item.price ?? item.salePrice),
    sales: readMoney(item.sales ?? item.salesCount) ?? undefined,
    title: String(item.title ?? item.name ?? "商品"),
  };
}

export async function loadMallH5HomeSnapshot(): Promise<MallH5HomeSnapshot> {
  const commerce = getSdkworkCommerceService();
  const [categoriesResult, hotResult, newResult] = await Promise.allSettled([
    commerce.catalog.categories.list({ page: 1, page_size: 10, status: "active" }),
    commerce.catalog.spus.list({ page: 1, page_size: 10, sort: "sales" }),
    commerce.catalog.spus.list({ page: 1, page_size: 10, sort: "newest" }),
  ]);

  const categoriesPayload =
    categoriesResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(categoriesResult.value) ?? { items: [] })
      : { items: [] };
  const hotPayload =
    hotResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(hotResult.value) ?? { items: [] })
      : { items: [] };
  const newPayload =
    newResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(newResult.value) ?? { items: [] })
      : { items: [] };

  return {
    categories: (categoriesPayload.items ?? []).map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? "类目"),
    })),
    hotProducts: (hotPayload.items ?? []).map(readProductCard),
    newProducts: (newPayload.items ?? []).map(readProductCard),
  };
}
